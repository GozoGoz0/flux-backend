import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const { status, assigneeId, initiativeId } = req.query;

    const where: any = { teamId: req.user!.teamId! };
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (initiativeId) where.initiativeId = initiativeId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        creator: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        initiative: {
          select: { id: true, title: true, status: true }
        },
        _count: {
          select: { comments: true, checklistItems: true, attachments: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { order: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().optional(),
  initiativeId: z.string().optional(),
  dueDate: z.string().optional()
});

router.post('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        creatorId: req.user!.id,
        teamId: req.user!.teamId!
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        creator: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        action: 'created',
        entity: 'task',
        entityId: task.id,
        userId: req.user!.id,
        teamId: req.user!.teamId!,
        taskId: task.id
      }
    });

    if (data.assigneeId && data.assigneeId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          type: 'task_assigned',
          title: 'Новая задача',
          content: `Вам назначена задача: ${task.title}`,
          link: `/tasks/${task.id}`,
          userId: data.assigneeId
        }
      });
    }

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        creator: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        initiative: {
          select: { id: true, title: true, status: true }
        },
        checklistItems: {
          orderBy: { order: 'asc' }
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

    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const data = createTaskSchema.partial().parse(req.body);

    const task = await prisma.task.updateMany({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined
      }
    });

    if (task.count === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    await prisma.activityLog.create({
      data: {
        action: 'updated',
        entity: 'task',
        entityId: req.params.id,
        userId: req.user!.id,
        teamId: req.user!.teamId!,
        taskId: req.params.id
      }
    });

    const updated = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        assignee: {
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
    const task = await prisma.task.deleteMany({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      }
    });

    if (task.count === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }

    res.json({ message: 'Задача удалена' });
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
        taskId: req.params.id
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

router.post('/:id/checklist', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const { text } = req.body;

    const item = await prisma.checklistItem.create({
      data: {
        text,
        taskId: req.params.id
      }
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.patch('/checklist/:itemId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { completed, text } = req.body;

    const item = await prisma.checklistItem.update({
      where: { id: req.params.itemId },
      data: { completed, text }
    });

    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.delete('/checklist/:itemId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.checklistItem.delete({
      where: { id: req.params.itemId }
    });

    res.json({ message: 'Элемент удалён' });
  } catch (error) {
    next(error);
  }
});

export default router;
