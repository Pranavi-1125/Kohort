import { query } from '../config/db.js';

const fmt = (d) => d.toISOString().slice(0, 10);

// tzOffset: minutes ahead of UTC for the user (e.g. India = 330)
export async function focusStats(userId, tzOffset = 0) {
  const rows = await query(
    `SELECT completed_seconds, completed, created_at FROM focus_sessions
      WHERE user_id = ? AND kind = 'focus' AND created_at >= DATE_SUB(NOW(), INTERVAL 70 DAY)`, [userId]);
  const byDay = new Map(); let sessions = 0;
  for (const r of rows) {
    const local = new Date(new Date(`${r.created_at.replace(' ', 'T')}Z`).getTime() + tzOffset * 60000);
    const key = fmt(local);
    byDay.set(key, (byDay.get(key) || 0) + Math.round(r.completed_seconds / 60));
    if (r.completed) sessions += 1;
  }
  const nowLocal = new Date(Date.now() + tzOffset * 60000);
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nowLocal.getTime() - i * 86400000);
    daily.push({ date: fmt(d), minutes: byDay.get(fmt(d)) || 0 });
  }
  let streak = 0;
  for (let i = byDay.get(fmt(nowLocal)) ? 0 : 1; ; i++) {
    const d = fmt(new Date(nowLocal.getTime() - i * 86400000));
    if ((byDay.get(d) || 0) > 0) streak += 1; else break;
  }
  return {
    today_minutes: daily[6].minutes,
    week_minutes: daily.reduce((a, d) => a + d.minutes, 0),
    sessions_completed: sessions,
    streak_days: streak,
    daily,
  };
}
