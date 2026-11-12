import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { usePresence } from '../hooks/usePresence';
import ChatPanel from '../components/ChatPanel';
import Icon from '../components/Icon';
import { Avatar, ErrorBox, Spinner } from '../components/ui';

const R = 140; const C = 2 * Math.PI * R;
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function GroupSession() {
  const { id } = useParams(); const navigate = useNavigate(); const toast = useToast();
  const { firebaseUser } = useAuth();
  const rest = useAsync(() => api(`/group-sessions/${id}`), [id]);
  const [live, setLive] = useState(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const completing = useRef(false);

  const isMember = rest.data?.is_member;

  // Server clock offset so every participant counts down the same moment.
  useEffect(() => {
    let ok = true; const t0 = Date.now();
    api('/group-sessions/time').then((r) => { if (ok) setOffset(r.now - (t0 + Date.now()) / 2); }).catch(() => {});
    return () => { ok = false; };
  }, []);

  // Live state from Firestore (members only).
  useEffect(() => {
    if (!isMember) return undefined;
    return onSnapshot(doc(db, 'groupSessions', id), (s) => setLive(s.exists() ? s.data() : null), () => setLive(null));
  }, [id, isMember]);

  // Refresh member names when membership changes.
  const memberKey = (live?.memberUids || []).join(',');
  useEffect(() => { if (isMember && memberKey) rest.reload(); }, [memberKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback polling when realtime state is unavailable.
  useEffect(() => {
    if (!isMember || live) return undefined;
    const t = setInterval(rest.reload, 8000); return () => clearInterval(t);
  }, [isMember, live, rest.reload]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  const s = useMemo(() => {
    if (!rest.data || !isMember) return null;
    if (live) return { status: live.status, durationSec: live.durationSec, remainingSec: live.remainingSec, endsAt: live.endsAt, hostUid: live.hostUid };
    return { status: rest.data.status, durationSec: rest.data.duration_seconds, remainingSec: rest.data.remaining_seconds, endsAt: rest.data.ends_at, hostUid: rest.data.host_uid };
  }, [live, rest.data, isMember]);

  const remaining = !s ? 0 : s.status === 'running' && s.endsAt ? Math.max(0, Math.ceil((s.endsAt - (now + offset)) / 1000)) : s.status === 'completed' ? 0 : s.remainingSec;

  // When the shared timer hits zero, any member reports completion (server verifies; idempotent).
  useEffect(() => {
    if (s?.status === 'running' && remaining === 0 && !completing.current) {
      completing.current = true;
      api(`/group-sessions/${id}/complete`, { method: 'POST' }).catch(() => { completing.current = false; });
    }
    if (s?.status !== 'running') completing.current = false;
  }, [s?.status, remaining, id]);

  const members = rest.data?.members || [];
  const presence = usePresence(members.map((m) => m.firebase_uid));
  const isHost = s?.hostUid === firebaseUser.uid;

  const act = async (action, success) => {
    setBusy(true);
    try { await api(`/group-sessions/${id}/${action}`, { method: 'POST' }); if (success) toast.success(success); }
    catch (e) { toast.error(e.message); rest.reload(); }
    finally { setBusy(false); }
  };
  const join = async () => { try { await api(`/group-sessions/${id}/join`, { method: 'POST' }); rest.retry(); } catch (e) { toast.error(e.message); } };
  const leave = async () => {
    try { await api(`/group-sessions/${id}/leave`, { method: 'POST' }); navigate('/focus?tab=group'); } catch (e) { toast.error(e.message); }
  };

  if (rest.loading && !rest.data) return <Spinner />;
  if (rest.error && !rest.data) return <><Link to="/focus?tab=group" className="small">← Back to sessions</Link><div style={{ marginTop: 12 }}><ErrorBox message={rest.error} onRetry={rest.retry} /></div></>;

  if (!isMember) {
    const d = rest.data;
    return (
      <div className="card stack" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <h1>{d.title}</h1>
        <p className="muted">{Math.round(d.duration_seconds / 60)} minute session · {d.members.length} studying</p>
        {d.status === 'completed' ? <p>This session has finished.</p> : <button className="btn btn-lg" onClick={join}>Join session</button>}
        <Link to="/focus?tab=group" className="small">Back to sessions</Link>
      </div>
    );
  }

  const done = s.status === 'completed';
  const progress = done ? 1 : s.durationSec ? 1 - remaining / s.durationSec : 0;
  const label = { waiting: 'Waiting to start', running: 'Focusing together', paused: 'Paused by host', completed: 'Session complete' }[s.status];

  return (
    <>
      <div style={{ marginBottom: 16 }}><Link to="/focus?tab=group" className="small">← All sessions</Link></div>
      <div className="page-head">
        <div><h1>{rest.data.title}</h1><p>{Math.round(s.durationSec / 60)} minute session · {members.length} member{members.length === 1 ? '' : 's'}</p></div>
        <button className="btn btn-ghost" onClick={leave}>Leave session</button>
      </div>
      <div className="focus-wide chat-wide">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card">
            <div className="focus-stage">
              <div className="ring" role="timer" aria-label="Shared session timer">
                <svg viewBox="0 0 300 300"><circle className="ring-track" cx="150" cy="150" r={R} fill="none" strokeWidth="10" />
                  <circle className="ring-bar" cx="150" cy="150" r={R} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} /></svg>
                <div><div className="time">{fmt(remaining)}</div><div className="mode">{label}</div></div>
              </div>
            </div>
            {done ? (
              <div className="summary"><div className="big">{Math.round(s.durationSec / 60)} min</div><p className="muted">Great work, everyone. This session is now in each member’s focus history.</p>
                <Link className="btn" style={{ marginTop: 14 }} to="/focus?tab=group">Back to sessions</Link></div>
            ) : isHost ? (
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                {s.status === 'waiting' && <button className="btn btn-lg" disabled={busy} onClick={() => act('start')}><Icon name="play" size={18} />Start for everyone</button>}
                {s.status === 'running' && <button className="btn btn-lg btn-secondary" disabled={busy} onClick={() => act('pause')}><Icon name="pause" size={18} />Pause</button>}
                {s.status === 'paused' && <button className="btn btn-lg" disabled={busy} onClick={() => act('resume')}><Icon name="play" size={18} />Resume</button>}
                {s.status !== 'waiting' && <button className="btn btn-lg btn-ghost" disabled={busy} onClick={() => act('reset')}><Icon name="reset" size={18} />Reset</button>}
                {s.status !== 'waiting' && <button className="btn btn-lg btn-danger" disabled={busy} onClick={() => window.confirm('End the session now? Time studied so far will be saved for everyone.') && act('complete')}>End session</button>}
              </div>
            ) : <p className="muted small" style={{ textAlign: 'center' }}>The host controls the timer. You will see it start, pause and finish live.</p>}
          </section>
          <section className="card">
            <div className="card-head"><h2>Studying together</h2><span className="badge badge-teal">{members.filter((m) => presence[m.firebase_uid]).length} online</span></div>
            <div className="grid grid-2">
              {members.map((m) => (
                <div className="row" key={m.id}><Avatar name={m.name} src={m.photo_url} size={40} online={!!presence[m.firebase_uid]} />
                  <div className="grow"><div className="truncate" style={{ fontWeight: 600 }}>{m.name}{m.firebase_uid === s.hostUid ? ' ' : ''}{m.firebase_uid === s.hostUid && <span className="badge" style={{ marginLeft: 6 }}>Host</span>}</div>
                    <div className="tiny muted">{presence[m.firebase_uid] ? 'Online' : 'Offline'}</div></div></div>
              ))}
            </div>
          </section>
        </div>
        <div style={{ height: 'min(640px, 80vh)' }}>
          <ChatPanel path={`groupSessions/${id}`} header={<div className="chat-head"><Icon name="message" /><b>Session chat</b></div>} placeholder="Cheer your cohort on…" emptyText="Say hi to your study group." />
        </div>
      </div>
    </>
  );
}
