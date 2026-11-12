import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import Icon from '../components/Icon';
import { Empty, ErrorBox, Field, Modal, PageHead, Spinner } from '../components/ui';

function RoomCard({ r, onJoin }) {
  return (
    <article className="card room-card">
      <div className="row-between"><h3 className="truncate">{r.name}</h3>{r.is_private ? <span className="badge badge-peach"><Icon name="lock" size={12} />Private</span> : <span className="badge badge-teal"><Icon name="globe" size={12} />Public</span>}</div>
      {r.topic && <span className="badge" style={{ alignSelf: 'flex-start' }}>{r.topic}</span>}
      <p className="small muted" style={{ minHeight: 40 }}>{r.description || 'No description yet.'}</p>
      <div className="row-between">
        <span className="small muted"><Icon name="users" size={14} /> {r.member_count} member{r.member_count === 1 ? '' : 's'}</span>
        {r.is_member ? <Link className="btn btn-sm" to={`/rooms/${r.id}`}>Open</Link> : <button className="btn btn-sm" onClick={() => onJoin(r)}>Join</button>}
      </div>
    </article>
  );
}

export default function Rooms() {
  const navigate = useNavigate(); const toast = useToast();
  const [tab, setTab] = useState('discover');
  const pub = useAsync(() => api('/rooms', { params: { scope: 'public' } }), []);
  const mine = useAsync(() => api('/rooms', { params: { scope: 'mine' } }), []);
  const invites = useAsync(() => api('/rooms/invites'), []);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ name: '', description: '', topic: '', is_private: false });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [query, setQuery] = useState('');

  const refresh = () => { pub.reload(); mine.reload(); invites.reload(); };
  const join = async (r) => { try { await api(`/rooms/${r.id}/join`, { method: 'POST' }); toast.success(`Joined ${r.name}`); navigate(`/rooms/${r.id}`); } catch (e) { toast.error(e.message); refresh(); } };
  const respond = async (inv, accept) => {
    try { await api(`/rooms/${inv.room_id}/invites/${accept ? 'accept' : 'decline'}`, { method: 'POST' }); if (accept) navigate(`/rooms/${inv.room_id}`); else { toast.success('Invite declined'); refresh(); } }
    catch (e) { toast.error(e.message); refresh(); }
  };
  const create = async (e) => {
    e.preventDefault(); setErr('');
    if (f.name.trim().length < 3) return setErr('Room names need at least 3 characters.');
    setBusy(true);
    try { const r = await api('/rooms', { method: 'POST', body: f }); toast.success('Room created'); navigate(`/rooms/${r.id}`); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  };

  const current = tab === 'mine' ? mine : pub;
  const q = query.trim().toLowerCase();
  const list = (current.data || []).filter((r) => !q || `${r.name} ${r.topic || ''} ${r.description || ''}`.toLowerCase().includes(q));
  const invCount = invites.data?.length || 0;

  return (
    <>
      <PageHead title="Study rooms" subtitle="Drop into a room for your course, topic or study crew.">
        <button className="btn" onClick={() => setCreating(true)}><Icon name="plus" size={18} />Create room</button>
      </PageHead>
      <div className="row-between wrap" style={{ marginBottom: 18 }}>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'discover'} className={`tab ${tab === 'discover' ? 'active' : ''}`} onClick={() => setTab('discover')}>Discover</button>
          <button role="tab" aria-selected={tab === 'mine'} className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>My rooms</button>
          <button role="tab" aria-selected={tab === 'invites'} className={`tab ${tab === 'invites' ? 'active' : ''}`} onClick={() => setTab('invites')}>Invites{invCount ? ` (${invCount})` : ''}</button>
        </div>
        {tab !== 'invites' && <input className="input" style={{ maxWidth: 260 }} placeholder="Search rooms" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search rooms" />}
      </div>

      {tab === 'invites' ? (
        invites.loading && !invites.data ? <Spinner /> : invites.error ? <ErrorBox message={invites.error} onRetry={invites.retry} /> : invCount === 0 ? (
          <section className="card"><Empty icon="mail" title="No pending invites">When someone invites you to a private room, it shows up here.</Empty></section>
        ) : (
          <div className="grid grid-2">{invites.data.map((i) => (
            <article className="card stack" key={i.room_id}><div className="row-between"><h3>{i.name}</h3><span className="badge badge-peach"><Icon name="lock" size={12} />Private</span></div>
              <p className="small muted">{i.description || 'No description'}<br />Invited by {i.invited_by_name}</p>
              <div className="row"><button className="btn btn-sm" onClick={() => respond(i, true)}>Accept</button><button className="btn btn-sm btn-ghost" onClick={() => respond(i, false)}>Decline</button></div></article>))}</div>
        )
      ) : current.loading && !current.data ? <Spinner /> : current.error && !current.data ? <ErrorBox message={current.error} onRetry={current.retry} /> : list.length === 0 ? (
        <section className="card"><Empty icon="users" title={tab === 'mine' ? 'You are not in any rooms yet' : q ? 'No rooms match your search' : 'No public rooms yet'} action={<button className="btn btn-sm" onClick={() => setCreating(true)}>Create a room</button>}>
          {tab === 'mine' ? 'Join a public room or create one for your class.' : 'Be the first to start one.'}</Empty></section>
      ) : <div className="grid grid-3">{list.map((r) => <RoomCard key={r.id} r={r} onJoin={join} />)}</div>}

      {creating && (
        <Modal title="Create a study room" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="stack" noValidate>
            {err && <div className="form-error" role="alert">{err}</div>}
            <Field label="Room name" htmlFor="r-name"><input id="r-name" className="input" value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus placeholder="e.g. CS201 Study Crew" /></Field>
            <Field label="Topic / course (optional)" htmlFor="r-topic"><input id="r-topic" className="input" value={f.topic} maxLength={100} onChange={(e) => setF({ ...f, topic: e.target.value })} /></Field>
            <Field label="Description" htmlFor="r-desc"><textarea id="r-desc" className="input" value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <label className="row" style={{ cursor: 'pointer' }}><input type="checkbox" className="check" checked={f.is_private} onChange={(e) => setF({ ...f, is_private: e.target.checked })} />
              <span><b>Private room</b><div className="small muted">Hidden from Discover. People can only join by invitation.</div></span></label>
            <div className="modal-foot"><button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create room'}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
