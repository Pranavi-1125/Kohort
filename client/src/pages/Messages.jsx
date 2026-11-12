import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { usePresence } from '../hooks/usePresence';
import { convName, convOther, timeAgo } from '../lib/conv';
import ChatPanel from '../components/ChatPanel';
import UserPicker from '../components/UserPicker';
import Icon from '../components/Icon';
import { Avatar, Empty, ErrorBox, Field, Modal, PageHead, Spinner } from '../components/ui';

function NewChat({ onClose, onCreated }) {
  const toast = useToast();
  const [type, setType] = useState('direct'); const [picked, setPicked] = useState([]); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const toggle = (u) => setPicked((l) => (l.some((x) => x.id === u.id) ? l.filter((x) => x.id !== u.id) : type === 'direct' ? [u] : [...l, u]));
  const submit = async () => {
    setErr('');
    if (!picked.length) return setErr('Pick at least one person.');
    if (type === 'group' && !name.trim()) return setErr('Give your group a name.');
    setBusy(true);
    try { const r = await api('/conversations', { method: 'POST', body: { type, name, memberIds: picked.map((u) => u.id) } }); toast.success(type === 'group' ? 'Group created' : 'Chat ready'); onCreated(r.id); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title="New conversation" onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={submit} disabled={busy}>{busy ? 'Creating…' : type === 'group' ? 'Create group' : 'Start chat'}</button></>}>
      <div className="stack">
        <div className="tabs" style={{ alignSelf: 'flex-start' }}>
          <button className={`tab ${type === 'direct' ? 'active' : ''}`} onClick={() => { setType('direct'); setPicked((p) => p.slice(0, 1)); }}>Direct message</button>
          <button className={`tab ${type === 'group' ? 'active' : ''}`} onClick={() => setType('group')}>Group chat</button>
        </div>
        {err && <div className="form-error" role="alert">{err}</div>}
        {type === 'group' && <Field label="Group name" htmlFor="gname"><input id="gname" className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Physics project team" /></Field>}
        <UserPicker selected={picked} onToggle={toggle} single={type === 'direct'} />
      </div>
    </Modal>
  );
}

function Manage({ conv, onClose, onChanged }) {
  const { user, firebaseUser } = useAuth(); const toast = useToast(); const navigate = useNavigate();
  const isOwner = conv.created_by === user.id; const [picked, setPicked] = useState([]); const [name, setName] = useState(conv.name || '');
  const run = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); onChanged(); } catch (e) { toast.error(e.message); } };
  return (
    <Modal title="Group details" onClose={onClose}>
      <div className="stack" style={{ gap: 18 }}>
        <div className="row"><input className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} aria-label="Group name" />
          <button className="btn btn-sm" disabled={!name.trim() || name === conv.name} onClick={() => run(() => api(`/conversations/${conv.id}`, { method: 'PUT', body: { name } }), 'Group renamed')}>Rename</button></div>
        <div><h3 style={{ marginBottom: 8 }}>Participants ({conv.members.length})</h3>
          <div className="list">{conv.members.map((m) => (
            <div className="list-item" key={m.id}><Avatar name={m.name} src={m.photo_url} size={34} /><span className="grow">{m.name}{m.firebase_uid === firebaseUser.uid ? ' (you)' : ''}</span>
              {m.id === conv.created_by && <span className="badge">Admin</span>}
              {isOwner && m.id !== user.id && <button className="btn btn-sm btn-danger" onClick={() => window.confirm(`Remove ${m.name}?`) && run(() => api(`/conversations/${conv.id}/members/${m.id}`, { method: 'DELETE' }), 'Removed')}>Remove</button>}
            </div>))}</div></div>
        {isOwner && <div><h3 style={{ marginBottom: 8 }}>Add people</h3>
          <UserPicker selected={picked} exclude={conv.members.map((m) => m.id)} onToggle={(u) => setPicked((l) => (l.some((x) => x.id === u.id) ? l.filter((x) => x.id !== u.id) : [...l, u]))} />
          <button className="btn btn-sm" style={{ marginTop: 10 }} disabled={!picked.length} onClick={() => run(async () => { for (const u of picked) await api(`/conversations/${conv.id}/members`, { method: 'POST', body: { userId: u.id } }); setPicked([]); }, 'People added')}>Add {picked.length || ''}</button></div>}
        <button className="btn btn-danger" onClick={() => window.confirm('Leave this group?') && run(async () => { await api(`/conversations/${conv.id}/members/${user.id}`, { method: 'DELETE' }); navigate('/messages'); onClose(); }, 'You left the group')}>Leave group</button>
      </div>
    </Modal>
  );
}

export default function Messages() {
  const { id } = useParams(); const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const list = useAsync(() => api('/conversations'), []);
  const detail = useAsync(() => (id ? api(`/conversations/${id}`) : Promise.resolve(null)), [id]);
  const [creating, setCreating] = useState(false); const [managing, setManaging] = useState(false); const [search, setSearch] = useState('');

  const allUids = useMemo(() => [...new Set((list.data || []).flatMap((c) => c.members.map((m) => m.firebase_uid)))], [list.data]);
  const presence = usePresence(allUids);
  const conv = detail.data;
  useEffect(() => { document.title = 'Messages — Kohort'; }, []);

  const touch = async (text) => { try { await api(`/conversations/${id}/touch`, { method: 'POST', body: { preview: text } }); list.reload(); } catch { /* preview is best-effort */ } };
  const q = search.trim().toLowerCase();
  const shown = (list.data || []).filter((c) => !q || convName(c, firebaseUser.uid).toLowerCase().includes(q));

  const chatHeader = conv && (() => {
    const other = convOther(conv, firebaseUser.uid); const on = conv.members.filter((m) => presence[m.firebase_uid]).length;
    return (
      <div className="chat-head">
        <Link to="/messages" className="icon-btn mobile-only-back" aria-label="Back to conversations" style={{ display: 'var(--back-display, none)' }}><Icon name="chevL" /></Link>
        <Avatar name={convName(conv, firebaseUser.uid)} src={conv.type === 'direct' ? other?.photo_url : null} size={40} online={conv.type === 'direct' ? !!presence[other?.firebase_uid] : undefined} />
        <div className="grow"><div style={{ fontWeight: 700 }} className="truncate">{convName(conv, firebaseUser.uid)}</div>
          <div className="tiny muted">{conv.type === 'direct' ? (presence[other?.firebase_uid] ? 'Online' : 'Offline') + (other?.major ? ` · ${other.major}` : '') : `${conv.members.length} participants · ${on} online`}</div></div>
        {conv.type === 'group' && <button className="btn btn-sm btn-ghost" onClick={() => setManaging(true)}><Icon name="users" size={16} />Manage</button>}
      </div>
    );
  })();

  return (
    <>
      <PageHead title="Messages" subtitle="Private chats and group conversations.">
        <button className="btn" onClick={() => setCreating(true)}><Icon name="plus" size={18} />New chat</button>
      </PageHead>
      <div className={`messages-layout ${id ? 'has-chat' : ''}`}>
        <section className="panel conv-panel">
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}><input className="input" placeholder="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search conversations" /></div>
          <div className="conv-list">
            {list.loading && !list.data ? <Spinner /> : list.error && !list.data ? <ErrorBox message={list.error} onRetry={list.retry} /> : shown.length === 0 ? (
              <Empty icon="message" title={q ? 'No matches' : 'No conversations yet'} action={!q && <button className="btn btn-sm" onClick={() => setCreating(true)}>Start one</button>}>{q ? 'Try a different name.' : 'Message a classmate or create a group.'}</Empty>
            ) : shown.map((c) => {
              const other = convOther(c, firebaseUser.uid);
              return (
                <Link key={c.id} to={`/messages/${c.id}`} className={`conv ${String(c.id) === id ? 'active' : ''}`}>
                  <Avatar name={convName(c, firebaseUser.uid)} src={c.type === 'direct' ? other?.photo_url : null} size={44} online={c.type === 'direct' ? !!presence[other?.firebase_uid] : undefined} />
                  <div className="grow"><div className="row-between"><b className="truncate">{convName(c, firebaseUser.uid)}</b><span className="tiny muted">{timeAgo(c.last_message_at)}</span></div>
                    <div className="small muted truncate">{c.type === 'group' && <Icon name="users" size={12} />} {c.last_message || 'No messages yet'}</div></div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="chat-panel" style={{ minHeight: 0 }}>
          {!id ? <div className="panel" style={{ height: '100%', display: 'grid', placeItems: 'center' }}><Empty icon="message" title="Select a conversation">Choose a chat on the left, or start a new one.</Empty></div>
            : detail.loading && !conv ? <div className="panel" style={{ height: '100%' }}><Spinner /></div>
            : detail.error ? <div className="panel" style={{ height: '100%', padding: 20 }}><ErrorBox message={detail.error} onRetry={detail.retry} /></div>
            : conv && <ChatPanel key={conv.id} path={`conversations/${conv.id}`} header={chatHeader} onSent={touch} showNames={conv.type === 'group'} />}
        </section>
      </div>
      {creating && <NewChat onClose={() => setCreating(false)} onCreated={(cid) => { setCreating(false); list.reload(); navigate(`/messages/${cid}`); }} />}
      {managing && conv && <Manage conv={conv} onClose={() => setManaging(false)} onChanged={() => { list.reload(); detail.reload(); }} />}
    </>
  );
}
