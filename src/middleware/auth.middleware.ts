import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    teamId?: string;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, teamId: true, verified: true }
    });

    if (!user || !user.verified) {
      return res.status(401).json({ error: 'Пользователь не найден или не подтверждён' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      teamId: user.teamId || undefined
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    next();
  };
}

export function requireTeam(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.teamId) {
    return res.status(403).json({ error: 'Необходима команда' });
  }
  next();
}
