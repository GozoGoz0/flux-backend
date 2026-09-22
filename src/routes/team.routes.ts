import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, requireTeam, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import crypto from 'crypto';

const router = Router();

router.get('/', authenticate, requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.user!.teamId! },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            createdAt: true
          }
        }
      }
    });

    res.json(team);
  } catch (error) {
    next(error);
  }
});

const createInviteSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'OBSERVER']),
  expiresInDays: z.number().min(1).max(30),
  maxUses: z.number().min(1).max(100)
});

router.post('/invitations', authenticate, requireRole('OWNER', 'ADMIN'), requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const data = createInviteSchema.parse(req.body);

    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + data.expiresInDays);

    const invitation = await prisma.invitation.create({
      data: {
        code,
        email: data.email,
        role: data.role,
        expiresAt,
        maxUses: data.maxUses,
        teamId: req.user!.teamId!
      }
    });

    res.status(201).json(invitation);
  } catch (error) {
    next(error);
  }
});

router.get('/invitations', authenticate, requireRole('OWNER', 'ADMIN'), requireTeam, async (req: AuthRequest, res, next) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: { teamId: req.user!.teamId! },
      orderBy: { createdAt: 'desc' }
    });

    res.json(invitations);
  } catch (error) {
    next(error);
  }
});

router.delete('/invitations/:id', authenticate, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    await prisma.invitation.update({
      where: { id: req.params.id },
      data: { status: 'REVOKED' }
    });

    res.json({ message: 'Приглашение отозвано' });
  } catch (error) {
    next(error);
  }
});

export default router;
