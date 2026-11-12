import { Router } from 'express';
import { query, one, pool } from '../config/db.js';
import { wrap, str, dateStr, oneOf, intId, HttpError, todayStr } from '../utils/http.js';

const r = Router();
const STATUSES = ['pending', 'in_progress', 'completed'];

const parse = (b) => ({
  course: str(b.course, { field: 'Course', max: 150, required: true }),
  title: str(b.title, { field: 'Title', max: 200, required: true }),
  description: str(b.description, { field: 'Description', max: 2000 }),
  due_date: dateStr(b.due_date, 'Due date'),
  status: oneOf(b.status || 'pending', STATUSES, 'Status'),
});

r.get('/', wrap(async (req, res) => {
  const where = ['user_id = ?']; const p = [req.user.id];
  const today = todayStr(req);
  const { status } = req.query;
  if (status === 'overdue') { where.push("status <> 'completed' AND due_date < ?"); p.push(today); }
  else if (status === 'upcoming') { where.push("status <> 'completed' AND due_date >= ?"); p.push(today); }
  else if (STATUSES.includes(status)) { where.push('status = ?'); p.push(status); }
  res.json(await query(
    `SELECT * FROM assignments WHERE ${where.join(' AND ')} ORDER BY (status='completed') ASC, due_date ASC, id ASC LIMIT 1000`, p));
}));

r.post('/', wrap(async (req, res) => {
  const a = parse(req.body || {});
  const [result] = await pool.query(
    'INSERT INTO assignments (user_id, course, title, description, due_date, status) VALUES (?,?,?,?,?,?)',
    [req.user.id, a.course, a.title, a.description, a.due_date, a.status]);
  res.status(201).json(await one('SELECT * FROM assignments WHERE id=?', [result.insertId]));
}));

r.put('/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  if (!(await one('SELECT id FROM assignments WHERE id=? AND user_id=?', [id, req.user.id]))) {
    throw new HttpError(404, 'Assignment not found');
  }
  const b = req.body || {};
  if (Object.keys(b).length === 1 && 'status' in b) {
    await query('UPDATE assignments SET status=? WHERE id=?', [oneOf(b.status, STATUSES, 'Status'), id]);
  } else {
    const a = parse(b);
    await query('UPDATE assignments SET course=?, title=?, description=?, due_date=?, status=? WHERE id=?',
      [a.course, a.title, a.description, a.due_date, a.status, id]);
  }
  res.json(await one('SELECT * FROM assignments WHERE id=?', [id]));
}));

r.delete('/:id', wrap(async (req, res) => {
  const out = await query('DELETE FROM assignments WHERE id=? AND user_id=?', [intId(req.params.id), req.user.id]);
  if (!out.affectedRows) throw new HttpError(404, 'Assignment not found');
  res.status(204).end();
}));

export default r;
