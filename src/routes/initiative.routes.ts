import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const { status, view } = req.query;

    const where: any = { teamId: req.user!.teamId! };
    if (status) where.status = status;

    const initiatives = await prisma.initiative.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        tasks: {
          select: { id: true, status: true }
        },
        _count: {
          select: { tasks: true, comments: true }
        }
      },
      orderBy: [
        { status: 'asc' },
        { order: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(initiatives);
  } catch (error) {
    next(error);
  }
});

const createInitiativeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['NOW', 'NEXT', 'LATER', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  ownerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

router.post('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const data = createInitiativeSchema.parse(req.body);

    const initiative = await prisma.initiative.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        teamId: req.user!.teamId!
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        action: 'created',
        entity: 'initiative',
        entityId: initiative.id,
        userId: req.user!.id,
        teamId: req.user!.teamId!,
        initiativeId: initiative.id
      }
    });

    res.status(201).json(initiative);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const initiative = await prisma.initiative.findFirst({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatar: true }
            }
          }
        },
        dependencies: {
          include: {
            to: {
              select: { id: true, title: true, status: true }
            }
          }
        },
        dependents: {
          include: {
            from: {
              select: { id: true, title: true, status: true }
            }
          }
        },
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

    if (!initiative) {
      return res.status(404).json({ error: 'Инициатива не найдена' });
    }

    res.json(initiative);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const data = createInitiativeSchema.partial().parse(req.body);

    const initiative = await prisma.initiative.updateMany({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined
      }
    });

    if (initiative.count === 0) {
      return res.status(404).json({ error: 'Инициатива не найдена' });
    }

    await prisma.activityLog.create({
      data: {
        action: 'updated',
        entity: 'initiative',
        entityId: req.params.id,
        userId: req.user!.id,
        teamId: req.user!.teamId!,
        initiativeId: req.params.id
      }
    });

    const updated = await prisma.initiative.findUnique({
      where: { id: req.params.id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const initiative = await prisma.initiative.deleteMany({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      }
    });

    if (initiative.count === 0) {
      return res.status(404).json({ error: 'Инициатива не найдена' });
    }

    res.json({ message: 'Инициатива удалена' });
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
        initiativeId: req.params.id
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
