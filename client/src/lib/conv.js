export const convName = (c, myUid) =>
  c.type === 'group' ? c.name : (c.members || []).find((m) => m.firebase_uid !== myUid)?.name || 'Conversation';
export const convOther = (c, myUid) => (c.members || []).find((m) => m.firebase_uid !== myUid);
export const timeAgo = (s) => {
  if (!s) return '';
  const d = new Date(`${s.replace(' ', 'T')}Z`); const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return 'now'; if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
