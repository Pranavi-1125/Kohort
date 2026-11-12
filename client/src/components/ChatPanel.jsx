import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';
import { Spinner } from './ui';

const timeOf = (ts) => ts?.toDate ? ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending…';
const dayOf = (ts) => ts?.toDate ? ts.toDate().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : null;

/**
 * Real-time chat backed by Firestore at `${path}/messages`.
 * Access is enforced by Firestore security rules (see firestore.rules).
 */
export default function ChatPanel({ path, onSent, placeholder = 'Write a message…', header, showNames = true, emptyText = 'No messages yet. Say hello!' }) {
  const { firebaseUser, user } = useAuth();
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    setMessages(null); setError('');
    const q = query(collection(db, `${path}/messages`), orderBy('createdAt', 'desc'), limit(150));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).reverse());
    }, (e) => setError(e.code === 'permission-denied' ? 'You do not have access to this chat.' : 'Could not load messages. Check your connection.'));
  }, [path]);

  useEffect(() => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError('');
    try {
      await addDoc(collection(db, `${path}/messages`), {
        text: body.slice(0, 2000), senderUid: firebaseUser.uid, senderName: user?.name || 'Student', createdAt: serverTimestamp(),
      });
      setText('');
      onSent?.(body);
    } catch { setError('Message not sent. Please try again.'); }
    finally { setSending(false); }
  };

  let lastDay = null;
  return (
    <div className="chat">
      {header}
      <div className="chat-body" ref={bodyRef} aria-live="polite">
        {messages === null && !error && <Spinner label="Loading messages" />}
        {error && <div className="form-error">{error}</div>}
        {messages?.length === 0 && <p className="muted small" style={{ margin: 'auto' }}>{emptyText}</p>}
        {messages?.map((m) => {
          const mine = m.senderUid === firebaseUser.uid; const day = dayOf(m.createdAt);
          const sep = day && day !== lastDay ? <div className="day-sep" key={`d${m.id}`}>{day}</div> : null;
          if (day) lastDay = day;
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {sep}
              <div className={`msg ${mine ? 'mine' : ''}`}>
                {!mine && showNames && <span className="msg-meta"><b>{m.senderName}</b></span>}
                <div className="bubble">{m.text}</div>
                <span className="msg-meta">{timeOf(m.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={2000} aria-label="Message" />
        <button className="btn" disabled={!text.trim() || sending} aria-label="Send"><Icon name="send" size={18} /></button>
      </form>
    </div>
  );
}
