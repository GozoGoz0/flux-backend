import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: err.errors
    });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Запись уже существует'
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Внутренняя ошибка сервера';

  res.status(statusCode).json({ error: message });
}
