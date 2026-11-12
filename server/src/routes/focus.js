import { Router } from 'express';
import { query, one, pool } from '../config/db.js';
import { wrap, str, oneOf, HttpError } from '../utils/http.js';
import { focusStats } from '../utils/focusStats.js';

const r = Router();
const tz = (req) => Math.max(-840, Math.min(840, Number(req.query.tz) || 0));

r.post('/sessions', wrap(async (req, res) => {
  const b = req.body || {};
  const kind = oneOf(b.kind || 'focus', ['focus', 'break'], 'Kind');
  const planned = Number(b.planned_seconds); const done = Number(b.completed_seconds);
  if (!Number.isInteger(planned) || planned < 60 || planned > 12 * 3600) throw new HttpError(400, 'Planned time must be between 1 minute and 12 hours');
  if (!Number.isInteger(done) || done < 0 || done > planned) throw new HttpError(400, 'Completed time must be between 0 and the planned time');
  const [out] = await pool.query(
    'INSERT INTO focus_sessions (user_id, kind, label, planned_seconds, completed_seconds, completed) VALUES (?,?,?,?,?,?)',
    [req.user.id, kind, str(b.label, { field: 'Label', max: 150 }), planned, done, done >= planned ? 1 : 0]);
  res.status(201).json(await one('SELECT * FROM focus_sessions WHERE id=?', [out.insertId]));
}));

r.get('/sessions', wrap(async (req, res) => {
  res.json(await query(
    `SELECT * FROM focus_sessions WHERE user_id = ? AND kind='focus' AND completed_seconds > 0
      ORDER BY created_at DESC LIMIT 30`, [req.user.id]));
}));

r.get('/stats', wrap(async (req, res) => res.json(await focusStats(req.user.id, tz(req)))));

export default r;
