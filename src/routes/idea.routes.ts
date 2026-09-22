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

    const ideas = await prisma.idea.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        _count: {
          select: { votes: true, comments: true }
        }
      },
      orderBy: [
        { voteCount: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(ideas);
  } catch (error) {
    next(error);
  }
});

const createIdeaSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional()
});

router.post('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const data = createIdeaSchema.parse(req.body);

    const idea = await prisma.idea.create({
      data: {
        ...data,
        creatorId: req.user!.id,
        teamId: req.user!.teamId!
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        action: 'created',
        entity: 'idea',
        entityId: idea.id,
        userId: req.user!.id,
        teamId: req.user!.teamId!,
        ideaId: idea.id
      }
    });

    res.status(201).json(idea);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const idea = await prisma.idea.findFirst({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        votes: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true }
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

    if (!idea) {
      return res.status(404).json({ error: 'Идея не найдена' });
    }

    res.json(idea);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const { title, description, status } = req.body;

    const idea = await prisma.idea.updateMany({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!
      },
      data: { title, description, status }
    });

    if (idea.count === 0) {
      return res.status(404).json({ error: 'Идея не найдена' });
    }

    await prisma.activityLog.create({
      data: {
        action: 'updated',
        entity: 'idea',
        entityId: req.params.id,
        userId: req.user!.id,
        teamId: req.user!.teamId!,
        ideaId: req.params.id
      }
    });

    const updated = await prisma.idea.findUnique({
      where: { id: req.params.id },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/vote', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const existing = await prisma.vote.findUnique({
      where: {
        ideaId_userId: {
          ideaId: req.params.id,
          userId: req.user!.id
        }
      }
    });

    if (existing) {
      await prisma.vote.delete({ where: { id: existing.id } });
      await prisma.idea.update({
        where: { id: req.params.id },
        data: { voteCount: { decrement: 1 } }
      });

      return res.json({ voted: false });
    }

    await prisma.vote.create({
      data: {
        ideaId: req.params.id,
        userId: req.user!.id
      }
    });

    await prisma.idea.update({
      where: { id: req.params.id },
      data: { voteCount: { increment: 1 } }
    });

    res.json({ voted: true });
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
        ideaId: req.params.id
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
