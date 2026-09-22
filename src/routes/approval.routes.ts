import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const { status } = req.query;

    const where: any = { teamId: req.user!.teamId! };
    if (status) where.status = status;

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        requester: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        responses: {
          include: {
            approver: {
              select: { id: true, name: true, email: true, avatar: true }
            }
          }
        },
        _count: {
          select: { comments: true, attachments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(approvals);
  } catch (error) {
    next(error);
  }
});

const createApprovalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  dueDate: z.string().optional(),
  requireAll: z.boolean().optional()
});

router.post('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const data = createApprovalSchema.parse(req.body);

    const approval = await prisma.approval.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        requesterId: req.user!.id,
        teamId: req.user!.teamId!
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        action: 'created',
        entity: 'approval',
        entityId: approval.id,
        userId: req.user!.id,
        teamId: req.user!.teamId!,
        approvalId: approval.id
      }
    });

    res.status(201).json(approval);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const approval = await prisma.approval.findFirst({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        responses: {
          include: {
            approver: {
              select: { id: true, name: true, email: true, avatar: true }
            }
          }
        },
        attachments: true,
        comments: {
          include: {
            author: {
              select: { id: true, name: true, email: true, avatar: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!approval) {
      return res.status(404).json({ error: 'Согласование не найдено' });
    }

    res.json(approval);
  } catch (error) {
    next(error);
  }
});

const respondSchema = z.object({
  decision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT']),
  comment: z.string().optional()
});

router.post('/:id/respond', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const { decision, comment } = respondSchema.parse(req.body);

    const approval = await prisma.approval.findFirst({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      },
      include: { responses: true }
    });

    if (!approval) {
      return res.status(404).json({ error: 'Согласование не найдено' });
    }

    if (approval.status !== 'PENDING') {
      return res.status(400).json({ error: 'Согласование уже завершено' });
    }

    const existingResponse = approval.responses.find(r => r.approverId === req.user!.id);
    if (existingResponse) {
      return res.status(400).json({ error: 'Вы уже ответили на это согласование' });
    }

    const response = await prisma.approvalResponse.create({
      data: {
        decision,
        comment,
        approvalId: req.params.id,
        approverId: req.user!.id
      },
      include: {
        approver: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    let newStatus = approval.status;
    if (decision === 'REJECT') {
      newStatus = 'REJECTED';
    } else if (decision === 'REQUEST_CHANGES') {
      newStatus = 'CHANGES_REQUESTED';
    } else if (decision === 'APPROVE' && !approval.requireAll) {
      newStatus = 'APPROVED';
    }

    await prisma.approval.update({
      where: { id: req.params.id },
      data: { status: newStatus }
    });

    await prisma.notification.create({
      data: {
        type: 'approval_response',
        title: 'Получен ответ на согласование',
        content: `${req.user!.email} ответил на согласование: ${approval.title}`,
        link: `/approvals/${approval.id}`,
        userId: approval.requesterId
      }
    });

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comments', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const { content } = req.body;

    const comment = await prisma.comment.create({
      data: {
        content,
        authorId: req.user!.id,
        approvalId: req.params.id
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

export default router;
