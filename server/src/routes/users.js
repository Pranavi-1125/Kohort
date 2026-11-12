import { Router } from 'express';
import { query, one } from '../config/db.js';
import { wrap, str, HttpError, intId } from '../utils/http.js';

const r = Router();
const PUBLIC = 'id, firebase_uid, name, photo_url, university, major, year_of_study, bio';

r.get('/me', wrap(async (req, res) => res.json(req.user)));

r.put('/me', wrap(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, { field: 'Name', max: 100, required: true });
  const photo = str(b.photo_url, { field: 'Photo URL', max: 500 });
  if (photo && !/^https?:\/\//i.test(photo)) throw new HttpError(400, 'Photo URL must start with http:// or https://');
  await query(
    'UPDATE users SET name=?, photo_url=?, university=?, major=?, year_of_study=?, bio=? WHERE id=?',
    [name, photo, str(b.university, { field: 'University', max: 150 }), str(b.major, { field: 'Major', max: 150 }),
      str(b.year_of_study, { field: 'Year', max: 30 }), str(b.bio, { field: 'Bio', max: 500 }), req.user.id]);
  res.json(await one('SELECT * FROM users WHERE id=?', [req.user.id]));
}));

r.get('/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const like = `%${q.replace(/[%_]/g, '')}%`;
  res.json(await query(
    `SELECT ${PUBLIC} FROM users WHERE id <> ? AND (name LIKE ? OR email = ?) ORDER BY name LIMIT 10`,
    [req.user.id, like, q]));
}));

// People the user shares a room or conversation with (used for "online classmates").
r.get('/contacts', wrap(async (req, res) => {
  res.json(await query(
    `SELECT DISTINCT u.id, u.firebase_uid, u.name, u.photo_url FROM users u WHERE u.id <> ? AND u.id IN (
       SELECT m2.user_id FROM room_members m1 JOIN room_members m2 ON m1.room_id = m2.room_id WHERE m1.user_id = ?
       UNION
       SELECT c2.user_id FROM conversation_members c1 JOIN conversation_members c2 ON c1.conversation_id = c2.conversation_id WHERE c1.user_id = ?
     ) ORDER BY u.name LIMIT 50`, [req.user.id, req.user.id, req.user.id]));
}));

r.get('/:id', wrap(async (req, res) => {
  const u = await one(`SELECT ${PUBLIC} FROM users WHERE id=?`, [intId(req.params.id)]);
  if (!u) throw new HttpError(404, 'User not found');
  res.json(u);
}));

export default r;
