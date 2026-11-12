import { Router } from 'express';
import { query } from '../config/db.js';
import { wrap, todayStr } from '../utils/http.js';
import { focusStats } from '../utils/focusStats.js';

const r = Router();

r.get('/', wrap(async (req, res) => {
  const uid = req.user.id; const today = todayStr(req);
  const tz = Math.max(-840, Math.min(840, Number(req.query.tz) || 0));
  const [todayTasks, assignments, rooms, conversations, sessions, counts, stats] = await Promise.all([
    query('SELECT * FROM tasks WHERE user_id=? AND due_date = ? ORDER BY completed, due_time, id', [uid, today]),
    query(`SELECT * FROM assignments WHERE user_id=? AND status <> 'completed' ORDER BY due_date ASC LIMIT 5`, [uid]),
    query(`SELECT r.id, r.name, r.topic, r.is_private,
             (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) AS member_count
             FROM rooms r JOIN room_members me ON me.room_id = r.id AND me.user_id = ?
            ORDER BY r.created_at DESC LIMIT 4`, [uid]),
    query(`SELECT c.* FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id
            WHERE m.user_id = ? ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT 4`, [uid]),
    query(`SELECT g.id, g.title, g.status, g.duration_seconds,
             (SELECT COUNT(*) FROM group_session_members m WHERE m.session_id = g.id) AS member_count
             FROM group_sessions g WHERE g.status <> 'completed' ORDER BY g.created_at DESC LIMIT 3`),
    query(`SELECT
             (SELECT COUNT(*) FROM tasks WHERE user_id=? AND completed=0 AND due_date < ?) AS overdue_tasks,
             (SELECT COUNT(*) FROM tasks WHERE user_id=? AND completed=1) AS tasks_done,
             (SELECT COUNT(*) FROM tasks WHERE user_id=?) AS tasks_total,
             (SELECT COUNT(*) FROM assignments WHERE user_id=? AND status<>'completed' AND due_date < ?) AS overdue_assignments,
             (SELECT COUNT(*) FROM assignments WHERE user_id=? AND status='completed') AS assignments_done,
             (SELECT COUNT(*) FROM assignments WHERE user_id=?) AS assignments_total`,
      [uid, today, uid, uid, uid, today, uid, uid]),
    focusStats(uid, tz),
  ]);
  // Attach other-party names to conversations for display.
  let convs = conversations;
  if (convs.length) {
    const mem = await query(
      `SELECT m.conversation_id, u.id, u.firebase_uid, u.name, u.photo_url FROM conversation_members m
         JOIN users u ON u.id = m.user_id WHERE m.conversation_id IN (?)`, [convs.map((c) => c.id)]);
    convs = convs.map((c) => ({ ...c, members: mem.filter((m) => m.conversation_id === c.id) }));
  }
  res.json({ todayTasks, assignments, rooms, conversations: convs, groupSessions: sessions, counts: counts[0], focus: stats });
}));

export default r;
