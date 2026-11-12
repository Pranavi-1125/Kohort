import { Router } from 'express';
import { query, one, pool } from '../config/db.js';
import { wrap, str, intId, HttpError } from '../utils/http.js';
import { mirrorConversation, removeConversationMirror } from '../utils/mirror.js';

const r = Router();

const isMember = async (cid, uid) =>
  !!(await one('SELECT 1 AS ok FROM conversation_members WHERE conversation_id=? AND user_id=?', [cid, uid]));

const membersOf = (cid) => query(
  `SELECT u.id, u.firebase_uid, u.name, u.photo_url, u.major FROM conversation_members m
     JOIN users u ON u.id = m.user_id WHERE m.conversation_id = ? ORDER BY u.name`, [cid]);

const withMembers = async (rows) => {
  if (!rows.length) return rows;
  const ids = rows.map((x) => x.id);
  const all = await query(
    `SELECT m.conversation_id, u.id, u.firebase_uid, u.name, u.photo_url FROM conversation_members m
       JOIN users u ON u.id = m.user_id WHERE m.conversation_id IN (?)`, [ids]);
  return rows.map((c) => ({ ...c, members: all.filter((m) => m.conversation_id === c.id) }));
};

r.get('/', wrap(async (req, res) => {
  const rows = await query(
    `SELECT c.* FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id
      WHERE m.user_id = ? ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT 100`, [req.user.id]);
  res.json(await withMembers(rows));
}));

r.get('/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  if (!(await isMember(id, req.user.id))) throw new HttpError(404, 'Conversation not found');
  const c = await one('SELECT * FROM conversations WHERE id=?', [id]);
  res.json({ ...c, members: await membersOf(id) });
}));

r.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  const type = b.type === 'group' ? 'group' : 'direct';
  const ids = [...new Set((Array.isArray(b.memberIds) ? b.memberIds : []).map((x) => intId(x, 'member id')))]
    .filter((x) => x !== req.user.id);
  if (!ids.length) throw new HttpError(400, 'Pick at least one person');
  const found = await query('SELECT id FROM users WHERE id IN (?)', [ids]);
  if (found.length !== ids.length) throw new HttpError(404, 'One of the selected people no longer exists');

  if (type === 'direct') {
    if (ids.length !== 1) throw new HttpError(400, 'A direct message is between two people');
    const key = [req.user.id, ids[0]].sort((a, b2) => a - b2).join(':');
    const existing = await one('SELECT id FROM conversations WHERE direct_key=?', [key]);
    if (existing) return res.json({ id: existing.id });
    const conn = await pool.getConnection(); let id;
    try {
      await conn.beginTransaction();
      const [o] = await conn.query("INSERT INTO conversations (type, created_by, direct_key) VALUES ('direct', ?, ?)", [req.user.id, key]);
      id = o.insertId;
      await conn.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?,?),(?,?)', [id, req.user.id, id, ids[0]]);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    await mirrorConversation(id);
    return res.status(201).json({ id });
  }

  const name = str(b.name, { field: 'Group name', max: 100, required: true });
  const conn = await pool.getConnection(); let id;
  try {
    await conn.beginTransaction();
    const [o] = await conn.query("INSERT INTO conversations (type, name, created_by) VALUES ('group', ?, ?)", [name, req.user.id]);
    id = o.insertId;
    for (const uid of [req.user.id, ...ids]) {
      await conn.query('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?,?)', [id, uid]);
    }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await mirrorConversation(id);
  res.status(201).json({ id });
}));

// Called by the client after sending a message so the list can show previews and ordering.
r.post('/:id/touch', wrap(async (req, res) => {
  const id = intId(req.params.id);
  if (!(await isMember(id, req.user.id))) throw new HttpError(403, 'Not a member of this conversation');
  const preview = (str(req.body?.preview, { field: 'Preview', max: 2000 }) || '').slice(0, 200);
  await query('UPDATE conversations SET last_message=?, last_message_at=NOW() WHERE id=?', [preview, id]);
  res.json({ ok: true });
}));

r.put('/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const c = await one('SELECT * FROM conversations WHERE id=?', [id]);
  if (!c || c.type !== 'group' || !(await isMember(id, req.user.id))) throw new HttpError(404, 'Group not found');
  await query('UPDATE conversations SET name=? WHERE id=?', [str(req.body?.name, { field: 'Group name', max: 100, required: true }), id]);
  res.json({ ok: true });
}));

r.post('/:id/members', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const c = await one('SELECT * FROM conversations WHERE id=?', [id]);
  if (!c || c.type !== 'group' || !(await isMember(id, req.user.id))) throw new HttpError(404, 'Group not found');
  if (c.created_by !== req.user.id) throw new HttpError(403, 'Only the group creator can add people');
  const userId = intId(req.body?.userId, 'userId');
  if (!(await one('SELECT id FROM users WHERE id=?', [userId]))) throw new HttpError(404, 'User not found');
  await query('INSERT IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?,?)', [id, userId]);
  await mirrorConversation(id);
  res.json({ ok: true });
}));

r.delete('/:id/members/:userId', wrap(async (req, res) => {
  const id = intId(req.params.id); const target = intId(req.params.userId, 'userId');
  const c = await one('SELECT * FROM conversations WHERE id=?', [id]);
  if (!c || c.type !== 'group' || !(await isMember(id, req.user.id))) throw new HttpError(404, 'Group not found');
  const self = target === req.user.id;
  if (!self && c.created_by !== req.user.id) throw new HttpError(403, 'Only the group creator can remove people');
  await query('DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?', [id, target]);
  const next = await one('SELECT user_id FROM conversation_members WHERE conversation_id=? ORDER BY joined_at LIMIT 1', [id]);
  if (!next) { await query('DELETE FROM conversations WHERE id=?', [id]); await removeConversationMirror(id); }
  else {
    if (c.created_by === target) await query('UPDATE conversations SET created_by=? WHERE id=?', [next.user_id, id]);
    await mirrorConversation(id);
  }
  res.json({ ok: true });
}));

export default r;
