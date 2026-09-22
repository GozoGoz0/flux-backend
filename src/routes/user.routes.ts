import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        verified: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true
          }
        }
      }
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.patch('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name, avatar },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true
      }
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
