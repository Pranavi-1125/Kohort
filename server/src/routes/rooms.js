import { Router } from 'express';
import { query, one, pool } from '../config/db.js';
import { wrap, str, intId, HttpError } from '../utils/http.js';
import { mirrorRoom, removeRoomMirror } from '../utils/mirror.js';

const r = Router();

const isMember = async (roomId, userId) =>
  !!(await one('SELECT 1 AS ok FROM room_members WHERE room_id=? AND user_id=?', [roomId, userId]));

const members = (roomId) => query(
  `SELECT u.id, u.firebase_uid, u.name, u.photo_url, u.major, m.joined_at
     FROM room_members m JOIN users u ON u.id = m.user_id WHERE m.room_id = ? ORDER BY m.joined_at`, [roomId]);

const listSql = `SELECT r.*, u.name AS owner_name,
    (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) AS member_count,
    EXISTS(SELECT 1 FROM room_members m WHERE m.room_id = r.id AND m.user_id = ?) AS is_member
  FROM rooms r JOIN users u ON u.id = r.owner_id`;

r.get('/', wrap(async (req, res) => {
  const scope = req.query.scope === 'mine' ? 'mine' : 'public';
  const rows = scope === 'mine'
    ? await query(`${listSql} WHERE EXISTS(SELECT 1 FROM room_members m WHERE m.room_id = r.id AND m.user_id = ?) ORDER BY r.created_at DESC`,
      [req.user.id, req.user.id])
    : await query(`${listSql} WHERE r.is_private = 0 ORDER BY member_count DESC, r.created_at DESC LIMIT 100`, [req.user.id]);
  res.json(rows.map((x) => ({ ...x, is_member: !!x.is_member, is_private: !!x.is_private })));
}));

r.get('/invites', wrap(async (req, res) => {
  res.json(await query(
    `SELECT i.room_id, r.name, r.description, u.name AS invited_by_name, i.created_at
       FROM room_invites i JOIN rooms r ON r.id = i.room_id JOIN users u ON u.id = i.invited_by
      WHERE i.user_id = ? ORDER BY i.created_at DESC`, [req.user.id]));
}));

r.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, { field: 'Room name', max: 100, required: true });
  const description = str(b.description, { field: 'Description', max: 500 });
  const topic = str(b.topic, { field: 'Topic', max: 100 });
  const isPrivate = b.is_private ? 1 : 0;
  const conn = await pool.getConnection();
  let id;
  try {
    await conn.beginTransaction();
    const [out] = await conn.query('INSERT INTO rooms (owner_id, name, description, topic, is_private) VALUES (?,?,?,?,?)',
      [req.user.id, name, description, topic, isPrivate]);
    id = out.insertId;
    await conn.query('INSERT INTO room_members (room_id, user_id) VALUES (?,?)', [id, req.user.id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await mirrorRoom(id);
  res.status(201).json({ id });
}));

r.get('/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const room = await one(`${listSql} WHERE r.id = ?`, [req.user.id, id]);
  if (!room) throw new HttpError(404, 'Room not found');
  const member = !!room.is_member;
  if (room.is_private && !member) {
    const invited = await one('SELECT 1 AS ok FROM room_invites WHERE room_id=? AND user_id=?', [id, req.user.id]);
    if (!invited) throw new HttpError(404, 'Room not found'); // do not reveal private rooms
    return res.json({ id, name: room.name, description: room.description, is_private: true, is_member: false, invited: true });
  }
  res.json({ ...room, is_member: member, is_private: !!room.is_private, members: await members(id) });
}));

r.post('/:id/join', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const room = await one('SELECT * FROM rooms WHERE id=?', [id]);
  if (!room) throw new HttpError(404, 'Room not found');
  if (room.is_private) throw new HttpError(403, 'This room is private. Ask a member to invite you.');
  const { c } = await one('SELECT COUNT(*) AS c FROM room_members WHERE room_id=?', [id]);
  if (c >= room.max_members) throw new HttpError(409, 'This room is full');
  await query('INSERT IGNORE INTO room_members (room_id, user_id) VALUES (?,?)', [id, req.user.id]);
  await mirrorRoom(id);
  res.json({ ok: true });
}));

r.post('/:id/leave', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const room = await one('SELECT * FROM rooms WHERE id=?', [id]);
  if (!room || !(await isMember(id, req.user.id))) throw new HttpError(404, 'You are not in this room');
  await query('DELETE FROM room_members WHERE room_id=? AND user_id=?', [id, req.user.id]);
  const next = await one('SELECT user_id FROM room_members WHERE room_id=? ORDER BY joined_at LIMIT 1', [id]);
  if (!next) {
    await query('DELETE FROM rooms WHERE id=?', [id]);
    await removeRoomMirror(id);
  } else {
    if (room.owner_id === req.user.id) await query('UPDATE rooms SET owner_id=? WHERE id=?', [next.user_id, id]);
    await mirrorRoom(id);
  }
  res.json({ ok: true });
}));

r.delete('/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const out = await query('DELETE FROM rooms WHERE id=? AND owner_id=?', [id, req.user.id]);
  if (!out.affectedRows) throw new HttpError(403, 'Only the room owner can delete a room');
  await removeRoomMirror(id);
  res.status(204).end();
}));

// Any member can invite to a private room; target must exist and not already be a member.
r.post('/:id/invite', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const userId = intId(req.body?.userId, 'userId');
  if (!(await isMember(id, req.user.id))) throw new HttpError(403, 'Only members can invite people');
  if (!(await one('SELECT id FROM users WHERE id=?', [userId]))) throw new HttpError(404, 'User not found');
  if (await isMember(id, userId)) throw new HttpError(409, 'That person is already in the room');
  await query('INSERT IGNORE INTO room_invites (room_id, user_id, invited_by) VALUES (?,?,?)', [id, userId, req.user.id]);
  res.json({ ok: true });
}));

r.post('/:id/invites/accept', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const inv = await one('SELECT 1 AS ok FROM room_invites WHERE room_id=? AND user_id=?', [id, req.user.id]);
  if (!inv) throw new HttpError(404, 'Invite not found');
  await query('INSERT IGNORE INTO room_members (room_id, user_id) VALUES (?,?)', [id, req.user.id]);
  await query('DELETE FROM room_invites WHERE room_id=? AND user_id=?', [id, req.user.id]);
  await mirrorRoom(id);
  res.json({ ok: true });
}));

r.post('/:id/invites/decline', wrap(async (req, res) => {
  await query('DELETE FROM room_invites WHERE room_id=? AND user_id=?', [intId(req.params.id), req.user.id]);
  res.json({ ok: true });
}));

export default r;
