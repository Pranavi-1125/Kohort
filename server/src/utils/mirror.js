// Mirrors membership/state into Firestore so security rules can authorise realtime reads and chat writes.
import { firestore, firebaseReady, serverTs } from '../config/firebase.js';
import { query, one } from '../config/db.js';

const uidsOf = async (sql, id) => (await query(sql, [id])).map((r) => r.firebase_uid);

export async function mirrorRoom(roomId) {
  if (!firebaseReady()) return;
  const room = await one('SELECT * FROM rooms WHERE id = ?', [roomId]);
  if (!room) return;
  const members = await uidsOf(
    'SELECT u.firebase_uid FROM room_members m JOIN users u ON u.id = m.user_id WHERE m.room_id = ?', roomId);
  await firestore().doc(`rooms/${roomId}`).set(
    { name: room.name, isPrivate: !!room.is_private, memberUids: members }, { merge: true });
}
export async function removeRoomMirror(roomId) {
  if (!firebaseReady()) return;
  await firestore().doc(`rooms/${roomId}`).delete().catch(() => {});
}

export async function mirrorConversation(id) {
  if (!firebaseReady()) return;
  const c = await one('SELECT * FROM conversations WHERE id = ?', [id]);
  if (!c) return;
  const members = await uidsOf(
    'SELECT u.firebase_uid FROM conversation_members m JOIN users u ON u.id = m.user_id WHERE m.conversation_id = ?', id);
  await firestore().doc(`conversations/${id}`).set({ type: c.type, memberUids: members }, { merge: true });
}
export async function removeConversationMirror(id) {
  if (!firebaseReady()) return;
  await firestore().doc(`conversations/${id}`).delete().catch(() => {});
}

export async function mirrorGroupSession(id) {
  if (!firebaseReady()) return;
  const s = await one(
    'SELECT g.*, u.firebase_uid AS host_uid FROM group_sessions g JOIN users u ON u.id = g.host_id WHERE g.id = ?', [id]);
  if (!s) return;
  const members = await uidsOf(
    'SELECT u.firebase_uid FROM group_session_members m JOIN users u ON u.id = m.user_id WHERE m.session_id = ?', id);
  await firestore().doc(`groupSessions/${id}`).set({
    title: s.title,
    hostUid: s.host_uid,
    memberUids: members,
    status: s.status,
    durationSec: s.duration_seconds,
    remainingSec: s.remaining_seconds,
    endsAt: s.ends_at ? Number(s.ends_at) : null,
    updatedAt: serverTs(),
  }, { merge: true });
}
