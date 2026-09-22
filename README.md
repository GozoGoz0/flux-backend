# Flux / Ploshadka Backend

Express API без внешней БД (данные в памяти).

## Локально

```bash
npm install
npm start
```

## Render

- Build Command: `npm install`
- Start Command: `npm start`
- Env: `JWT_SECRET` (любая случайная строка)

## Дефолтный логин

- `admin@test.com` / `admin123`

## Роуты

- GET  /api/health
- POST /api/auth/login
- POST /api/auth/signup
- POST /api/auth/logout
- GET  /api/auth/me
- GET  /api/items
- POST /api/items
- PUT  /api/items/:id
- DELETE /api/items/:id

Данные сбрасываются при каждом рестарте сервиса.
