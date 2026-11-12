import { useMemo, useState } from 'react';
import { api, formatDate, fromDateStr, relativeDue, toDateStr, todayStr, daysUntil } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import Icon from '../components/Icon';
import { Empty, ErrorBox, Field, Modal, PageHead, Spinner } from '../components/ui';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const blank = (date) => ({ title: '', description: '', due_date: date, due_time: '', priority: 'medium' });

function TaskModal({ initial, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ ...initial, due_time: initial.due_time?.slice(0, 5) || '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.title.trim()) return setErr('Give your task a title.');
    if (!f.due_date) return setErr('Choose a due date.');
    setBusy(true);
    try {
      const body = { title: f.title, description: f.description, due_date: f.due_date, due_time: f.due_time || null, priority: f.priority, ...(initial.id ? { completed: !!initial.completed } : {}) };
      const saved = await api(initial.id ? `/tasks/${initial.id}` : '/tasks', { method: initial.id ? 'PUT' : 'POST', body });
      toast.success(initial.id ? 'Task updated' : 'Task added'); onSaved(saved);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={initial.id ? 'Edit task' : 'New task'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid" noValidate id="task-form">
        {err && <div className="form-error full" role="alert">{err}</div>}
        <Field label="Title" htmlFor="t-title" className="full"><input id="t-title" className="input" value={f.title} onChange={set('title')} maxLength={200} autoFocus /></Field>
        <Field label="Description" htmlFor="t-desc" className="full"><textarea id="t-desc" className="input" value={f.description || ''} onChange={set('description')} maxLength={2000} /></Field>
        <Field label="Due date" htmlFor="t-date"><input id="t-date" type="date" className="input" value={f.due_date} onChange={set('due_date')} /></Field>
        <Field label="Time (optional)" htmlFor="t-time"><input id="t-time" type="time" className="input" value={f.due_time} onChange={set('due_time')} /></Field>
        <Field label="Priority" htmlFor="t-pri" className="full">
          <select id="t-pri" className="input" value={f.priority} onChange={set('priority')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        </Field>
        <div className="modal-foot full"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save task'}</button></div>
      </form>
    </Modal>
  );
}

export default function Planner() {
  const toast = useToast();
  const { data: tasks, loading, error, retry, setData } = useAsync(() => api('/tasks', { params: { today: todayStr() } }), []);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(todayStr());
  const [scope, setScope] = useState('all');       // all | day
  const [status, setStatus] = useState('pending'); // all | pending | completed | overdue
  const [editing, setEditing] = useState(null);
  const today = todayStr();

  const byDate = useMemo(() => {
    const m = {}; (tasks || []).forEach((t) => { (m[t.due_date] ||= []).push(t); }); return m;
  }, [tasks]);

  const cells = useMemo(() => {
    const first = new Date(month); const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);

  const visible = useMemo(() => (tasks || []).filter((t) => {
    if (scope === 'day' && t.due_date !== selected) return false;
    if (status === 'pending') return !t.completed;
    if (status === 'completed') return !!t.completed;
    if (status === 'overdue') return !t.completed && t.due_date < today;
    return true;
  }), [tasks, scope, selected, status, today]);

  const overdueCount = (tasks || []).filter((t) => !t.completed && t.due_date < today).length;

  const upsert = (saved) => { setData((l) => (l.some((t) => t.id === saved.id) ? l.map((t) => (t.id === saved.id ? saved : t)) : [...l, saved]).sort((a, b) => a.due_date.localeCompare(b.due_date))); setEditing(null); };
  const toggle = async (t) => {
    try { upsert(await api(`/tasks/${t.id}`, { method: 'PUT', body: { completed: !t.completed } })); } catch (e) { toast.error(e.message); }
  };
  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    try { await api(`/tasks/${t.id}`, { method: 'DELETE' }); setData((l) => l.filter((x) => x.id !== t.id)); toast.success('Task deleted'); } catch (e) { toast.error(e.message); }
  };
  const pickDay = (d) => { const s = toDateStr(d); setSelected(s); setScope('day'); if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); };

  return (
    <>
      <PageHead title="Planner" subtitle="Organise tasks by day and stay ahead of what is due.">
        <button className="btn" onClick={() => setEditing(blank(scope === 'day' ? selected : today))}><Icon name="plus" size={18} />New task</button>
      </PageHead>
      {loading && !tasks ? <Spinner /> : error && !tasks ? <ErrorBox message={error} onRetry={retry} /> : (
        <div className="planner-grid">
          <section className="card">
            <div className="cal-head">
              <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
              <div className="row" style={{ gap: 2 }}>
                <button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="chevL" /></button>
                <button className="btn btn-sm btn-ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(today); setScope('day'); }}>Today</button>
                <button className="icon-btn" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="chevR" /></button>
              </div>
            </div>
            <div className="cal" role="grid">
              {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
              {cells.map((d) => {
                const s = toDateStr(d); const list = byDate[s] || [];
                const late = list.some((t) => !t.completed) && s < today;
                return (
                  <button key={s} className={`cal-day ${d.getMonth() !== month.getMonth() ? 'other' : ''} ${s === today ? 'today' : ''} ${s === selected && scope === 'day' ? 'selected' : ''}`}
                    onClick={() => pickDay(d)} aria-label={`${s}, ${list.length} tasks`}>
                    {d.getDate()}
                    <span className="cal-dots">{list.slice(0, 3).map((t, i) => <i key={i} className={late ? 'late' : ''} />)}</span>
                  </button>
                );
              })}
            </div>
            <p className="tiny muted" style={{ marginTop: 12 }}>Dots show tasks due that day. Red dots are overdue.</p>
          </section>

          <section className="card">
            <div className="card-head wrap">
              <h2>{scope === 'day' ? formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' }) : 'All tasks'}</h2>
              {overdueCount > 0 && <span className="badge badge-danger"><Icon name="alert" size={13} />{overdueCount} overdue</span>}
            </div>
            <div className="row wrap" style={{ marginBottom: 16 }}>
              <div className="tabs" role="tablist" aria-label="Filter by status">
                {[['pending', 'To do'], ['overdue', 'Overdue'], ['completed', 'Done'], ['all', 'All']].map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={status === k} className={`tab ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>{l}</button>
                ))}
              </div>
              <div className="tabs" role="tablist" aria-label="Filter by date">
                <button role="tab" aria-selected={scope === 'day'} className={`tab ${scope === 'day' ? 'active' : ''}`} onClick={() => setScope('day')}>Selected day</button>
                <button role="tab" aria-selected={scope === 'all'} className={`tab ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')}>All dates</button>
              </div>
            </div>
            {visible.length === 0 ? (
              <Empty icon="calendar" title={status === 'completed' ? 'Nothing completed here yet' : 'No tasks to show'} action={<button className="btn btn-sm" onClick={() => setEditing(blank(scope === 'day' ? selected : today))}>Add a task</button>}>
                {scope === 'day' ? 'This day is clear. Add something or pick another date.' : 'Try a different filter or add a new task.'}
              </Empty>
            ) : (
              <div className="list">
                {visible.map((t) => {
                  const late = !t.completed && t.due_date < today;
                  return (
                    <div className="list-item" key={t.id}>
                      <span className={`priority ${t.priority}`} title={`${t.priority} priority`} />
                      <input type="checkbox" className="check" checked={!!t.completed} onChange={() => toggle(t)} aria-label={`Mark ${t.title} as ${t.completed ? 'not done' : 'done'}`} />
                      <div className="grow">
                        <div className={`task-title ${t.completed ? 'done' : ''}`} style={{ fontWeight: 600 }}>{t.title}</div>
                        {t.description && <div className="small muted truncate">{t.description}</div>}
                        <div className="tiny muted row" style={{ gap: 8, marginTop: 2 }}>
                          <span><Icon name="clock" size={12} /> {formatDate(t.due_date)}{t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ''}</span>
                          {late ? <span className="badge badge-danger">{relativeDue(t.due_date)}</span> : !t.completed && daysUntil(t.due_date) <= 1 ? <span className="badge badge-peach">{relativeDue(t.due_date)}</span> : null}
                        </div>
                      </div>
                      <button className="icon-btn" onClick={() => setEditing(t)} aria-label={`Edit ${t.title}`}><Icon name="edit" size={18} /></button>
                      <button className="icon-btn danger" onClick={() => remove(t)} aria-label={`Delete ${t.title}`}><Icon name="trash" size={18} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
      {editing && <TaskModal initial={editing} onClose={() => setEditing(null)} onSaved={upsert} />}
    </>
  );
}
