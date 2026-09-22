const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_NAME = 'token';

/* ------------------------------------------------------------------
   CORS — отражаем origin, иначе браузер рубит запросы с credentials
   ------------------------------------------------------------------ */
const extraOrigins = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // нет Origin → curl, Postman, health-check
      if (!origin) return cb(null, true);

      // любой vercel-домен: прод и превью-деплои
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return cb(null, true);

      // localhost для локального фронта
      if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);

      if (extraOrigins.includes(origin)) return cb(null, true);

      console.warn('[cors] blocked origin:', origin);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(cookieParser());

/* ------------------------------------------------------------------
   Хранилище в памяти — перезапуск = сброс данных.
   Подключишь Postgres — заменишь этот блок, роуты останутся как есть.
   ------------------------------------------------------------------ */
const users = [];
const items = [];
let userSeq = 1;
let itemSeq = 1;

users.push({
  id: userSeq++,
  email: 'admin@test.com',
  name: 'Admin',
  password: bcrypt.hashSync('admin123', 10),
});

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

const signToken = (user) =>
  jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,        // https обязателен на Render
    sameSite: 'none',    // нужно для кросс-доменных кук Vercel → Render
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function currentUser(req) {
  const raw = req.cookies?.[COOKIE_NAME] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!raw) return null;
  try {
    const { userId } = jwt.verify(raw, JWT_SECRET);
    return users.find((u) => u.id === userId) || null;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

/* ------------------------------------------------------------------
   Логгер — чтобы видеть, какие роуты реально дёргает фронт
   ------------------------------------------------------------------ */
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.originalUrl}`);
  next();
});

/* ---------------------------- health ------------------------------ */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', users: users.length, items: items.length });
});

/* ----------------------------- auth ------------------------------- */
// Алиас — некоторые клиенты шлют POST /api/auth вместо /api/auth/login
app.post('/api/auth', (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find(
    (u) => u.email.toLowerCase() === String(email || '').toLowerCase()
  );
  if (!user || !bcrypt.compareSync(String(password || ''), user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/signup', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const user = {
    id: userSeq++,
    email: String(email),
    name: name || String(email).split('@')[0],
    password: bcrypt.hashSync(String(password), 10),
  };
  users.push(user);

  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find(
    (u) => u.email.toLowerCase() === String(email || '').toLowerCase()
  );

  if (!user || !bcrypt.compareSync(String(password || ''), user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/', sameSite: 'none', secure: true });
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: publicUser(user) });
});

// некоторые сборки дёргают просто GET /api/auth
app.get('/api/auth', (req, res) => {
  const user = currentUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

/* ----------------------------- items ------------------------------ */
app.get('/api/items', (req, res) => {
  const user = currentUser(req);
  const mine = user ? items.filter((i) => i.userId === user.id) : items;
  res.json({ items: mine });
});

app.post('/api/items', requireAuth, (req, res) => {
  const { title, description, status } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const item = {
    id: itemSeq++,
    userId: req.user.id,
    title: String(title),
    description: description || '',
    status: status || 'todo',
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  res.status(201).json({ item });
});

app.put('/api/items/:id', requireAuth, (req, res) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  Object.assign(item, req.body || {}, { id: item.id, userId: item.userId });
  res.json({ item });
});

app.delete('/api/items/:id', requireAuth, (req, res) => {
  const idx = items.findIndex((i) => i.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  if (items[idx].userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  items.splice(idx, 1);
  res.json({ ok: true });
});

/* --------------------------- fallback ----------------------------- */
app.use((req, res) => {
  console.warn(`[404] нет роута: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `No route: ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Seed login: admin@test.com / admin123`);
});
