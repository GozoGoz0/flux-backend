import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const { isPrivate } = req.query;

    const where: any = {
      teamId: req.user!.teamId!
    };

    if (isPrivate === 'true') {
      where.isPrivate = true;
      where.authorId = req.user!.id;
    } else if (isPrivate === 'false') {
      where.isPrivate = false;
    }

    const notes = await prisma.note.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        _count: {
          select: { attachments: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(notes);
  } catch (error) {
    next(error);
  }
});

const createNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  isPrivate: z.boolean().optional()
});

router.post('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const data = createNoteSchema.parse(req.body);

    const note = await prisma.note.create({
      data: {
        ...data,
        authorId: req.user!.id,
        teamId: req.user!.teamId!
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        action: 'created',
        entity: 'note',
        entityId: note.id,
        userId: req.user!.id,
        teamId: req.user!.teamId!,
        noteId: note.id
      }
    });

    res.status(201).json(note);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const note = await prisma.note.findFirst({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!,
        OR: [
          { isPrivate: false },
          { authorId: req.user!.id }
        ]
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        attachments: true
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }

    res.json(note);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const data = createNoteSchema.partial().parse(req.body);

    const note = await prisma.note.updateMany({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!,
        authorId: req.user!.id
      },
      data
    });

    if (note.count === 0) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }

    const updated = await prisma.note.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
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
    const note = await prisma.note.deleteMany({
      where: {
        id: req.params.id,
        teamId: req.user!.teamId!,
        authorId: req.user!.id
      }
    });

    if (note.count === 0) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }

    res.json({ message: 'Заметка удалена' });
  } catch (error) {
    next(error);
  }
});

export default router;
