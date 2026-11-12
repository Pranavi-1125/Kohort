import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import { requireAuth, errorHandler } from './middleware/auth.js';
import { firebaseReady } from './config/firebase.js';
import { pool } from './config/db.js';
import users from './routes/users.js';
import tasks from './routes/tasks.js';
import assignments from './routes/assignments.js';
import rooms from './routes/rooms.js';
import conversations from './routes/conversations.js';
import focus from './routes/focus.js';
import groupSessions from './routes/groupSessions.js';
import dashboard from './routes/dashboard.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', async (_req, res) => {
  let db = false;
  try { await pool.query('SELECT 1'); db = true; } catch { /* reported below */ }
  res.status(db && firebaseReady() ? 200 : 503).json({ ok: db && firebaseReady(), database: db, firebase: firebaseReady() });
});

app.use('/api', requireAuth);
app.use('/api/users', users);
app.use('/api/tasks', tasks);
app.use('/api/assignments', assignments);
app.use('/api/rooms', rooms);
app.use('/api/conversations', conversations);
app.use('/api/focus', focus);
app.use('/api/group-sessions', groupSessions);
app.use('/api/dashboard', dashboard);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Kohort API listening on :${port}`));
