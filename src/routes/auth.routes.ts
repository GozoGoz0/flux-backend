import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../lib/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../lib/jwt';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional()
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Пользователь уже существует' });
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        verified: false
      },
      select: { id: true, email: true, name: true, verified: true }
    });

    res.status(201).json({ 
      user,
      message: 'Регистрация успешна. Введите код приглашения.'
    });
  } catch (error) {
    next(error);
  }
});

const verifyInviteSchema = z.object({
  email: z.string().email(),
  code: z.string()
});

router.post('/verify-invite', async (req, res, next) => {
  try {
    const { email, code } = verifyInviteSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.verified) {
      return res.status(400).json({ error: 'Пользователь уже подтверждён' });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { code },
      include: { team: true }
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Код приглашения не найден' });
    }

    if (invitation.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Код приглашения неактивен' });
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' }
      });
      return res.status(400).json({ error: 'Код приглашения истёк' });
    }

    if (invitation.usedCount >= invitation.maxUses) {
      return res.status(400).json({ error: 'Код приглашения исчерпан' });
    }

    if (invitation.email && invitation.email !== email) {
      return res.status(403).json({ error: 'Код приглашения не для этой почты' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        teamId: invitation.teamId,
        role: invitation.role
      },
      select: { id: true, email: true, name: true, role: true, verified: true, teamId: true }
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { usedCount: { increment: 1 } }
    });

    const accessToken = generateAccessToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role
    });

    const refreshToken = generateRefreshToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role
    });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: updatedUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      user: updatedUser,
      accessToken,
      refreshToken,
      team: invitation.team
    });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { team: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверные учётные данные' });
    }

    const validPassword = await comparePassword(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверные учётные данные' });
    }

    if (!user.verified) {
      return res.status(403).json({ 
        error: 'Аккаунт не подтверждён',
        requiresInvite: true
      });
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: user.teamId
      },
      accessToken,
      refreshToken,
      team: user.team
    });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token не предоставлен' });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Недействительный refresh token' });
    }

    const payload = verifyRefreshToken(refreshToken);

    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await prisma.refreshToken.delete({
        where: { token: refreshToken }
      }).catch(() => {});
    }

    res.json({ message: 'Выход выполнен' });
  } catch (error) {
    next(error);
  }
});

export default router;
