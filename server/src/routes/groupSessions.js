import { Router } from 'express';
import { query, one, pool } from '../config/db.js';
import { wrap, str, intId, HttpError } from '../utils/http.js';
import { mirrorGroupSession } from '../utils/mirror.js';
import { firestore, firebaseReady } from '../config/firebase.js';

const r = Router();
const SKEW_MS = 2500;

const membersOf = (id) => query(
  `SELECT u.id, u.firebase_uid, u.name, u.photo_url FROM group_session_members m
     JOIN users u ON u.id = m.user_id WHERE m.session_id = ? ORDER BY m.joined_at`, [id]);
const isMember = async (sid, uid) =>
  !!(await one('SELECT 1 AS ok FROM group_session_members WHERE session_id=? AND user_id=?', [sid, uid]));

async function recordCompletion(session, memberIds, elapsedSeconds, finished) {
  for (const uid of memberIds) {
    await query(
      `INSERT INTO focus_sessions (user_id, kind, label, planned_seconds, completed_seconds, completed, group_session_id)
       VALUES (?, 'focus', ?, ?, ?, ?, ?)`,
      [uid, session.title, session.duration_seconds, Math.min(elapsedSeconds, session.duration_seconds), finished ? 1 : 0, session.id]);
  }
}

async function complete(session, finished) {
  const ids = (await query('SELECT user_id FROM group_session_members WHERE session_id=?', [session.id])).map((x) => x.user_id);
  const elapsed = finished ? session.duration_seconds : Math.max(0, session.duration_seconds - currentRemaining(session));
  // Guard against double completion under concurrent calls.
  const out = await query("UPDATE group_sessions SET status='completed', remaining_seconds=0, ends_at=NULL WHERE id=? AND status <> 'completed'", [session.id]);
  if (!out.affectedRows) return;
  if (elapsed >= 60) await recordCompletion(session, ids, elapsed, finished);
  await mirrorGroupSession(session.id);
}

const currentRemaining = (s) =>
  s.status === 'running' && s.ends_at ? Math.max(0, Math.ceil((Number(s.ends_at) - Date.now()) / 1000)) : s.remaining_seconds;

// Complete sessions whose timer has clearly expired even if no client reported it.
async function settle(id) {
  const s = await one('SELECT * FROM group_sessions WHERE id=?', [id]);
  if (s && s.status === 'running' && s.ends_at && Number(s.ends_at) < Date.now() - 5000) {
    await complete(s, true);
    return one('SELECT * FROM group_sessions WHERE id=?', [id]);
  }
  return s;
}

const shape = async (s) => ({ ...s, ends_at: s.ends_at ? Number(s.ends_at) : null, members: await membersOf(s.id) });

r.get('/time', wrap(async (_req, res) => res.json({ now: Date.now() })));

r.get('/', wrap(async (req, res) => {
  const rows = await query(
    `SELECT g.*, u.name AS host_name,
        (SELECT COUNT(*) FROM group_session_members m WHERE m.session_id = g.id) AS member_count,
        EXISTS(SELECT 1 FROM group_session_members m WHERE m.session_id = g.id AND m.user_id = ?) AS is_member
       FROM group_sessions g JOIN users u ON u.id = g.host_id
      WHERE g.status <> 'completed' ORDER BY g.created_at DESC LIMIT 50`, [req.user.id]);
  const live = [];
  for (const g of rows) {
    if (g.status === 'running' && g.ends_at && Number(g.ends_at) < Date.now() - 5000) { await settle(g.id); continue; }
    live.push({ ...g, ends_at: g.ends_at ? Number(g.ends_at) : null, is_member: !!g.is_member });
  }
  res.json(live);
}));

r.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  const title = str(b.title, { field: 'Session title', max: 120, required: true });
  const minutes = Number(b.durationMinutes);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180) throw new HttpError(400, 'Duration must be between 5 and 180 minutes');
  const conn = await pool.getConnection(); let id;
  try {
    await conn.beginTransaction();
    const [o] = await conn.query(
      'INSERT INTO group_sessions (host_id, title, duration_seconds, remaining_seconds) VALUES (?,?,?,?)',
      [req.user.id, title, minutes * 60, minutes * 60]);
    id = o.insertId;
    await conn.query('INSERT INTO group_session_members (session_id, user_id) VALUES (?,?)', [id, req.user.id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await mirrorGroupSession(id);
  res.status(201).json({ id });
}));

r.get('/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const s = await settle(id);
  if (!s) throw new HttpError(404, 'Session not found');
  const member = await isMember(id, req.user.id);
  // Non-members only get a summary until they join (chat and live state are members-only).
  if (!member) {
    const members = await membersOf(id);
    return res.json({ id: s.id, title: s.title, status: s.status, duration_seconds: s.duration_seconds, is_member: false, members });
  }
  res.json({ ...(await shape(s)), is_member: true, host_uid: (await one('SELECT firebase_uid FROM users WHERE id=?', [s.host_id])).firebase_uid });
}));

r.post('/:id/join', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const s = await settle(id);
  if (!s) throw new HttpError(404, 'Session not found');
  if (s.status === 'completed') throw new HttpError(409, 'This session has already finished');
  const { c } = await one('SELECT COUNT(*) AS c FROM group_session_members WHERE session_id=?', [id]);
  if (c >= 30) throw new HttpError(409, 'This session is full');
  await query('INSERT IGNORE INTO group_session_members (session_id, user_id) VALUES (?,?)', [id, req.user.id]);
  await mirrorGroupSession(id);
  res.json({ ok: true });
}));

r.post('/:id/leave', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const s = await one('SELECT * FROM group_sessions WHERE id=?', [id]);
  if (!s || !(await isMember(id, req.user.id))) throw new HttpError(404, 'You are not in this session');
  await query('DELETE FROM group_session_members WHERE session_id=? AND user_id=?', [id, req.user.id]);
  const next = await one('SELECT user_id FROM group_session_members WHERE session_id=? ORDER BY joined_at LIMIT 1', [id]);
  if (!next) {
    await query('DELETE FROM group_sessions WHERE id=?', [id]);
    if (firebaseReady()) await firestore().doc(`groupSessions/${id}`).delete().catch(() => {});
  } else {
    if (s.host_id === req.user.id) await query('UPDATE group_sessions SET host_id=? WHERE id=?', [next.user_id, id]);
    await mirrorGroupSession(id);
  }
  res.json({ ok: true });
}));

const hostAction = (fn) => wrap(async (req, res) => {
  const id = intId(req.params.id);
  const s = await settle(id);
  if (!s) throw new HttpError(404, 'Session not found');
  if (s.host_id !== req.user.id) throw new HttpError(403, 'Only the host can control the timer');
  if (s.status === 'completed') throw new HttpError(409, 'This session has already finished');
  await fn(s);
  await mirrorGroupSession(id);
  res.json({ ok: true });
});

r.post('/:id/start', hostAction(async (s) => {
  if (s.status !== 'waiting' && s.status !== 'paused') throw new HttpError(409, 'The timer is already running');
  await query("UPDATE group_sessions SET status='running', ends_at=? WHERE id=?", [Date.now() + s.remaining_seconds * 1000, s.id]);
}));
r.post('/:id/resume', hostAction(async (s) => {
  if (s.status !== 'paused') throw new HttpError(409, 'The timer is not paused');
  await query("UPDATE group_sessions SET status='running', ends_at=? WHERE id=?", [Date.now() + s.remaining_seconds * 1000, s.id]);
}));
r.post('/:id/pause', hostAction(async (s) => {
  if (s.status !== 'running') throw new HttpError(409, 'The timer is not running');
  await query("UPDATE group_sessions SET status='paused', remaining_seconds=?, ends_at=NULL WHERE id=?", [currentRemaining(s), s.id]);
}));
r.post('/:id/reset', hostAction(async (s) => {
  await query("UPDATE group_sessions SET status='waiting', remaining_seconds=duration_seconds, ends_at=NULL WHERE id=?", [s.id]);
}));

// Any member may report that the timer finished; the host may also end a session early.
r.post('/:id/complete', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const s = await one('SELECT * FROM group_sessions WHERE id=?', [id]);
  if (!s || !(await isMember(id, req.user.id))) throw new HttpError(404, 'Session not found');
  if (s.status === 'completed') return res.json({ ok: true });
  const expired = s.status === 'running' && s.ends_at && Number(s.ends_at) <= Date.now() + SKEW_MS;
  if (expired) await complete(s, true);
  else if (s.host_id === req.user.id) await complete(s, false);
  else throw new HttpError(409, 'The timer has not finished yet');
  res.json({ ok: true });
}));

export default r;
