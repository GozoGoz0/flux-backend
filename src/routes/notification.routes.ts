import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { unreadOnly } = req.query;

    const where: any = { userId: req.user!.id };
    if (unreadOnly === 'true') {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      data: { read: true }
    });

    res.json({ message: 'Уведомление отмечено прочитанным' });
  } catch (error) {
    next(error);
  }
});

router.post('/read-all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        read: false
      },
      data: { read: true }
    });

    res.json({ message: 'Все уведомления отмечены прочитанными' });
  } catch (error) {
    next(error);
  }
});

export default router;
