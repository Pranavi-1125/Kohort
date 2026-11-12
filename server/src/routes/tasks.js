import { Router } from 'express';
import { query, one, pool } from '../config/db.js';
import { wrap, str, dateStr, timeStr, oneOf, intId, HttpError, todayStr } from '../utils/http.js';

const r = Router();

const parse = (b) => ({
  title: str(b.title, { field: 'Title', max: 200, required: true }),
  description: str(b.description, { field: 'Description', max: 2000 }),
  due_date: dateStr(b.due_date, 'Due date'),
  due_time: timeStr(b.due_time),
  priority: oneOf(b.priority || 'medium', ['low', 'medium', 'high'], 'Priority'),
});

r.get('/', wrap(async (req, res) => {
  const where = ['user_id = ?']; const p = [req.user.id];
  const today = todayStr(req);
  const { status, from, to } = req.query;
  if (status === 'completed') where.push('completed = 1');
  else if (status === 'pending') where.push('completed = 0');
  else if (status === 'overdue') { where.push('completed = 0 AND due_date < ?'); p.push(today); }
  if (from) { where.push('due_date >= ?'); p.push(dateStr(from, 'from')); }
  if (to) { where.push('due_date <= ?'); p.push(dateStr(to, 'to')); }
  res.json(await query(
    `SELECT * FROM tasks WHERE ${where.join(' AND ')} ORDER BY completed ASC, due_date ASC, due_time ASC, id ASC LIMIT 1000`, p));
}));

r.post('/', wrap(async (req, res) => {
  const t = parse(req.body || {});
  const [result] = await pool.query(
    'INSERT INTO tasks (user_id, title, description, due_date, due_time, priority) VALUES (?,?,?,?,?,?)',
    [req.user.id, t.title, t.description, t.due_date, t.due_time, t.priority]);
  res.status(201).json(await one('SELECT * FROM tasks WHERE id=?', [result.insertId]));
}));

r.put('/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const existing = await one('SELECT * FROM tasks WHERE id=? AND user_id=?', [id, req.user.id]);
  if (!existing) throw new HttpError(404, 'Task not found');
  const b = req.body || {};
  // Partial toggle of completion only
  if (Object.keys(b).length === 1 && 'completed' in b) {
    const done = b.completed ? 1 : 0;
    await query('UPDATE tasks SET completed=?, completed_at=? WHERE id=?', [done, done ? new Date() : null, id]);
  } else {
    const t = parse(b);
    const done = b.completed === undefined ? existing.completed : (b.completed ? 1 : 0);
    await query(
      'UPDATE tasks SET title=?, description=?, due_date=?, due_time=?, priority=?, completed=?, completed_at=? WHERE id=?',
      [t.title, t.description, t.due_date, t.due_time, t.priority, done, done ? (existing.completed_at || new Date()) : null, id]);
  }
  res.json(await one('SELECT * FROM tasks WHERE id=?', [id]));
}));

r.delete('/:id', wrap(async (req, res) => {
  const out = await query('DELETE FROM tasks WHERE id=? AND user_id=?', [intId(req.params.id), req.user.id]);
  if (!out.affectedRows) throw new HttpError(404, 'Task not found');
  res.status(204).end();
}));

export default r;
