import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, tzOffset } from '../lib/api';
import { useFocus } from '../context/FocusContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import Icon from '../components/Icon';
import { Empty, ErrorBox, Field, Modal, PageHead, Spinner } from '../components/ui';

const R = 140; const C = 2 * Math.PI * R;
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function SoloFocus() {
  const f = useFocus();
  const stats = useAsync(() => api('/focus/stats', { params: { tz: tzOffset() } }), []);
  const recent = useAsync(() => api('/focus/sessions'), []);
  useEffect(() => {
    const r = () => { stats.reload(); recent.reload(); };
    window.addEventListener('kohort:focus-recorded', r); return () => window.removeEventListener('kohort:focus-recorded', r);
  }, [stats, recent]);
  const idle = f.status === 'idle';
  const progress = f.total ? 1 - f.remaining / f.total : 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || lo));

  return (
    <div className="focus-wide">
      <section className="card">
        <div className="row" style={{ justifyContent: 'center' }}>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={f.mode === 'focus'} className={`tab ${f.mode === 'focus' ? 'active' : ''}`} disabled={!idle} onClick={() => f.switchMode('focus')}>Focus</button>
            <button role="tab" aria-selected={f.mode === 'break'} className={`tab ${f.mode === 'break' ? 'active' : ''}`} disabled={!idle} onClick={() => f.switchMode('break')}>Break</button>
          </div>
        </div>
        <div className="focus-stage">
          <div className="ring" role="timer" aria-label={`${f.mode} timer`}>
            <svg viewBox="0 0 300 300"><circle className="ring-track" cx="150" cy="150" r={R} fill="none" strokeWidth="10" />
              <circle className={`ring-bar ${f.mode}`} cx="150" cy="150" r={R} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} /></svg>
            <div><div className="time">{fmt(f.remaining)}</div><div className="mode">{f.mode === 'focus' ? (f.status === 'paused' ? 'Paused' : 'Deep focus') : 'Take a breather'}</div></div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'center', marginBottom: 20 }}>
          {f.status === 'idle' && <button className="btn btn-lg" onClick={f.start}><Icon name="play" size={18} />Start {f.mode}</button>}
          {f.status === 'running' && <button className="btn btn-lg btn-secondary" onClick={f.pause}><Icon name="pause" size={18} />Pause</button>}
          {f.status === 'paused' && <button className="btn btn-lg" onClick={f.resume}><Icon name="play" size={18} />Resume</button>}
          <button className="btn btn-lg btn-ghost" onClick={f.reset} disabled={idle && f.remaining === f.total}><Icon name="reset" size={18} />Reset</button>
        </div>
        {idle && (
          <div className="stack" style={{ gap: 16, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
            <div className="presets">{[15, 25, 45, 60, 90].map((m) => <button key={m} className={`chip ${f.focusMin === m ? 'active' : ''}`} onClick={() => f.setFocusMin(m)}>{m} min</button>)}</div>
            <div className="form-grid">
              <Field label="Focus length (minutes)" htmlFor="fm"><input id="fm" type="number" min="1" max="180" className="input" value={f.focusMin} onChange={(e) => f.setFocusMin(clamp(e.target.value, 1, 180))} /></Field>
              <Field label="Break length (minutes)" htmlFor="bm"><input id="bm" type="number" min="1" max="60" className="input" value={f.breakMin} onChange={(e) => f.setBreakMin(clamp(e.target.value, 1, 60))} /></Field>
              <Field label="What are you working on? (optional)" htmlFor="fl" className="full"><input id="fl" className="input" value={f.label} maxLength={150} onChange={(e) => f.setLabel(e.target.value)} placeholder="e.g. Chapter 4 problem set" /></Field>
            </div>
          </div>
        )}
      </section>

      <aside className="stack" style={{ gap: 20 }}>
        <section className="card">
          <div className="card-head"><h2>Your focus</h2>{stats.data && <span className="badge"><Icon name="flame" size={14} />{stats.data.streak_days} day streak</span>}</div>
          {stats.data ? (
            <div className="stats">
              <div className="stat"><b>{stats.data.today_minutes}</b><span className="small muted">min today</span></div>
              <div className="stat"><b>{stats.data.week_minutes}</b><span className="small muted">min this week</span></div>
              <div className="stat"><b>{stats.data.sessions_completed}</b><span className="small muted">sessions done</span></div>
            </div>
          ) : stats.error ? <ErrorBox message={stats.error} onRetry={stats.retry} /> : <Spinner />}
        </section>
        <section className="card">
          <div className="card-head"><h2>Recent sessions</h2></div>
          {recent.data?.length ? (
            <div className="list">{recent.data.slice(0, 6).map((s) => (
              <div className="list-item" key={s.id}>
                <div className="grow"><div className="truncate" style={{ fontWeight: 600 }}>{s.label || 'Focus session'}</div>
                  <div className="tiny muted">{new Date(`${s.created_at.replace(' ', 'T')}Z`).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{s.group_session_id ? ' · group' : ''}</div></div>
                <span className={`badge ${s.completed ? 'badge-teal' : 'badge-muted'}`}>{Math.round(s.completed_seconds / 60)} min</span>
              </div>))}</div>
          ) : recent.error ? <ErrorBox message={recent.error} onRetry={recent.retry} /> : recent.loading ? <Spinner /> : <Empty icon="timer" title="No sessions yet">Finish a focus session and it will show up here.</Empty>}
        </section>
      </aside>

      {f.summary && (
        <Modal title={f.summary.kind === 'focus' ? 'Session complete' : 'Break over'} onClose={f.dismissSummary}
          footer={<><button className="btn btn-ghost" onClick={f.dismissSummary}>Close</button><button className="btn" onClick={() => { f.dismissSummary(); f.start(); }}>Start {f.mode}</button></>}>
          <div className="summary">
            <div className="big">{f.summary.minutes} min</div>
            <p className="muted">{f.summary.kind === 'focus' ? `Nicely done${f.summary.label ? ` on “${f.summary.label}”` : ''}. This session has been saved to your history.` : 'Ready to dive back in?'}</p>
            {f.summary.kind === 'focus' && <p className="small" style={{ marginTop: 10 }}>Next up: a {f.breakMin}-minute break.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function GroupList() {
  const navigate = useNavigate(); const toast = useToast();
  const { data, loading, error, retry, reload } = useAsync(() => api('/group-sessions'), []);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ title: '', durationMinutes: 25 }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  const create = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.title.trim()) return setErr('Give your session a name.');
    const m = Number(f.durationMinutes);
    if (!Number.isInteger(m) || m < 5 || m > 180) return setErr('Duration must be a whole number between 5 and 180 minutes.');
    setBusy(true);
    try { const r = await api('/group-sessions', { method: 'POST', body: { title: f.title, durationMinutes: m } }); navigate(`/focus/group/${r.id}`); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  };
  const join = async (s) => {
    try { if (!s.is_member) await api(`/group-sessions/${s.id}/join`, { method: 'POST' }); navigate(`/focus/group/${s.id}`); }
    catch (e) { toast.error(e.message); reload(); }
  };

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <p className="muted">Study side by side with a shared timer and live chat.</p>
        <button className="btn" onClick={() => setCreating(true)}><Icon name="plus" size={18} />New group session</button>
      </div>
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox message={error} onRetry={retry} /> : data.length === 0 ? (
        <section className="card"><Empty icon="users" title="No active sessions" action={<button className="btn" onClick={() => setCreating(true)}>Start the first one</button>}>Create a session, then share the page with your cohort so they can join.</Empty></section>
      ) : (
        <div className="grid grid-3">
          {data.map((s) => (
            <article className="card room-card" key={s.id}>
              <div className="row-between"><h3 className="truncate">{s.title}</h3><span className={`badge ${s.status === 'running' ? 'badge-teal' : 'badge-muted'}`}>{s.status === 'running' ? 'In progress' : s.status === 'paused' ? 'Paused' : 'Waiting'}</span></div>
              <p className="small muted">Hosted by {s.host_name} · {Math.round(s.duration_seconds / 60)} min</p>
              <div className="row-between"><span className="small"><Icon name="users" size={14} /> {s.member_count} joined</span>
                <button className="btn btn-sm" onClick={() => join(s)}>{s.is_member ? 'Open' : 'Join'}</button></div>
            </article>
          ))}
        </div>
      )}
      {creating && (
        <Modal title="New group focus session" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="stack" noValidate>
            {err && <div className="form-error" role="alert">{err}</div>}
            <Field label="Session name" htmlFor="g-title"><input id="g-title" className="input" value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Calculus revision sprint" autoFocus /></Field>
            <Field label="Length (minutes)" htmlFor="g-dur"><input id="g-dur" type="number" min="5" max="180" className="input" value={f.durationMinutes} onChange={(e) => setF({ ...f, durationMinutes: e.target.value })} /></Field>
            <div className="presets" style={{ justifyContent: 'flex-start' }}>{[25, 45, 60, 90].map((m) => <button type="button" key={m} className={`chip ${Number(f.durationMinutes) === m ? 'active' : ''}`} onClick={() => setF({ ...f, durationMinutes: m })}>{m} min</button>)}</div>
            <div className="modal-foot"><button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create session'}</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function Focus() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'group' ? 'group' : 'solo';
  return (
    <>
      <PageHead title="Focus" subtitle="Protect your attention. Alone or together.">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'solo'} className={`tab ${tab === 'solo' ? 'active' : ''}`} onClick={() => setParams({})}>Solo</button>
          <button role="tab" aria-selected={tab === 'group'} className={`tab ${tab === 'group' ? 'active' : ''}`} onClick={() => setParams({ tab: 'group' })}>Group</button>
        </div>
      </PageHead>
      {tab === 'solo' ? <SoloFocus /> : <GroupList />}
    </>
  );
}
