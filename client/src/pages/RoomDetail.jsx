import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { usePresence } from '../hooks/usePresence';
import ChatPanel from '../components/ChatPanel';
import UserPicker from '../components/UserPicker';
import Icon from '../components/Icon';
import { Avatar, ErrorBox, Modal, Spinner } from '../components/ui';

export default function RoomDetail() {
  const { id } = useParams(); const navigate = useNavigate(); const toast = useToast();
  const { user, firebaseUser } = useAuth();
  const { data: room, loading, error, retry, reload } = useAsync(() => api(`/rooms/${id}`), [id]);
  const presence = usePresence(room?.members?.map((m) => m.firebase_uid));
  const [inviting, setInviting] = useState(false); const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const act = async (fn, msg) => { setBusy(true); try { await fn(); if (msg) toast.success(msg); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  const join = () => act(async () => { await api(`/rooms/${id}/join`, { method: 'POST' }); reload(); }, 'Joined room');
  const leave = () => window.confirm('Leave this room?') && act(async () => { await api(`/rooms/${id}/leave`, { method: 'POST' }); navigate('/rooms'); }, 'You left the room');
  const del = () => window.confirm('Delete this room for everyone? This cannot be undone.') && act(async () => { await api(`/rooms/${id}`, { method: 'DELETE' }); navigate('/rooms'); }, 'Room deleted');
  const accept = () => act(async () => { await api(`/rooms/${id}/invites/accept`, { method: 'POST' }); reload(); }, 'Joined room');
  const sendInvites = () => act(async () => {
    for (const u of picked) await api(`/rooms/${id}/invite`, { method: 'POST', body: { userId: u.id } });
    setInviting(false); setPicked([]);
  }, `Invitation${picked.length === 1 ? '' : 's'} sent`);

  if (loading && !room) return <Spinner />;
  if (error && !room) return <><Link to="/rooms" className="small">← Study rooms</Link><div style={{ marginTop: 12 }}><ErrorBox message={error} onRetry={retry} /></div></>;

  if (room.invited) {
    return (
      <div className="card stack" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <span className="badge badge-peach" style={{ alignSelf: 'center' }}><Icon name="lock" size={12} />Private room</span>
        <h1>{room.name}</h1><p className="muted">{room.description || 'You have been invited to join this room.'}</p>
        <div className="row" style={{ justifyContent: 'center' }}><button className="btn" disabled={busy} onClick={accept}>Accept invite</button><Link className="btn btn-ghost" to="/rooms">Not now</Link></div>
      </div>
    );
  }

  const isOwner = room.owner_id === user.id;
  const online = room.members?.filter((m) => presence[m.firebase_uid]).length || 0;

  return (
    <>
      <div style={{ marginBottom: 16 }}><Link to="/rooms" className="small">← Study rooms</Link></div>
      <div className="page-head">
        <div>
          <div className="row wrap" style={{ gap: 10 }}><h1>{room.name}</h1>{room.is_private ? <span className="badge badge-peach"><Icon name="lock" size={12} />Private</span> : <span className="badge badge-teal"><Icon name="globe" size={12} />Public</span>}{room.topic && <span className="badge">{room.topic}</span>}</div>
          <p>{room.description || 'No description yet.'} · Created by {room.owner_name}</p>
        </div>
        <div className="row wrap">
          {room.is_member ? <>
            <button className="btn" onClick={() => setInviting(true)}><Icon name="plus" size={18} />Invite</button>
            <button className="btn btn-ghost" disabled={busy} onClick={leave}>Leave</button>
            {isOwner && <button className="btn btn-danger" disabled={busy} onClick={del}><Icon name="trash" size={16} />Delete</button>}
          </> : <button className="btn btn-lg" disabled={busy} onClick={join}>Join room</button>}
        </div>
      </div>

      {!room.is_member ? (
        <section className="card"><div className="stack"><h2>{room.member_count} member{room.member_count === 1 ? '' : 's'}</h2><p className="muted">Join this room to see who is inside and chat with them.</p></div></section>
      ) : (
        <div className="focus-wide chat-wide" style={{ alignItems: 'stretch' }}>
          <div style={{ height: 'min(640px, 78vh)' }}>
            <ChatPanel path={`rooms/${id}`} header={<div className="chat-head"><Icon name="message" /><b>Room chat</b></div>} placeholder={`Message ${room.name}…`} />
          </div>
          <section className="card" style={{ alignSelf: 'start' }}>
            <div className="card-head"><h2>Members ({room.members.length})</h2><span className="badge badge-teal">{online} online</span></div>
            <div className="list">
              {room.members.map((m) => (
                <div className="list-item" key={m.id}>
                  <Avatar name={m.name} src={m.photo_url} size={38} online={!!presence[m.firebase_uid]} />
                  <div className="grow"><div className="truncate" style={{ fontWeight: 600 }}>{m.name}{m.firebase_uid === firebaseUser.uid ? ' (you)' : ''}</div><div className="tiny muted truncate">{m.major || 'Student'}</div></div>
                  {m.id === room.owner_id && <span className="badge">Owner</span>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {inviting && (
        <Modal title="Invite people" onClose={() => { setInviting(false); setPicked([]); }}
          footer={<><button className="btn btn-ghost" onClick={() => { setInviting(false); setPicked([]); }}>Cancel</button><button className="btn" disabled={!picked.length || busy} onClick={sendInvites}>Send {picked.length || ''} invite{picked.length === 1 ? '' : 's'}</button></>}>
          <p className="small muted" style={{ marginBottom: 10 }}>They will get an invitation they can accept or decline.</p>
          <UserPicker selected={picked} exclude={room.members.map((m) => m.id)} onToggle={(u) => setPicked((l) => (l.some((x) => x.id === u.id) ? l.filter((x) => x.id !== u.id) : [...l, u]))} />
        </Modal>
      )}
    </>
  );
}
