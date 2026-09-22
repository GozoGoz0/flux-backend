# Flux Backend

Чистый JS бэк для Flux (без TypeScript).

## Локальный запуск

```bash
npm install
npm start
```

## Деплой на Render

1. Push в GitHub
2. Render → New Web Service → Connect GitHub
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment Variables:
   - DATABASE_URL (из Render PostgreSQL)
   - JWT_SECRET
   - NODE_ENV=production

## Endpoints

- GET /api/health
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/invites/validate
