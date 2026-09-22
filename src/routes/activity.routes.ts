import { Router } from 'express';
import { authenticate, requireTeam, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const { entity, entityId } = req.query;

    const where: any = { teamId: req.user!.teamId! };
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;

    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

export default router;
