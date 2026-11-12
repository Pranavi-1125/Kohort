import { useMemo, useState } from 'react';
import { api, daysUntil, formatDate, relativeDue, todayStr } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import Icon from '../components/Icon';
import { Empty, ErrorBox, Field, Modal, PageHead, Spinner } from '../components/ui';

const STATUS_LABEL = { pending: 'Not started', in_progress: 'In progress', completed: 'Completed' };
const blank = () => ({ course: '', title: '', description: '', due_date: todayStr(), status: 'pending' });

function AssignmentModal({ initial, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(initial); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.course.trim()) return setErr('Which course or subject is this for?');
    if (!f.title.trim()) return setErr('Give the assignment a title.');
    if (!f.due_date) return setErr('Choose a due date.');
    setBusy(true);
    try {
      const saved = await api(initial.id ? `/assignments/${initial.id}` : '/assignments', { method: initial.id ? 'PUT' : 'POST',
        body: { course: f.course, title: f.title, description: f.description, due_date: f.due_date, status: f.status } });
      toast.success(initial.id ? 'Assignment updated' : 'Assignment added'); onSaved(saved);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={initial.id ? 'Edit assignment' : 'New assignment'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid" noValidate>
        {err && <div className="form-error full" role="alert">{err}</div>}
        <Field label="Course / subject" htmlFor="a-course"><input id="a-course" className="input" value={f.course} onChange={set('course')} maxLength={150} autoFocus placeholder="e.g. Data Structures" /></Field>
        <Field label="Due date" htmlFor="a-date"><input id="a-date" type="date" className="input" value={f.due_date} onChange={set('due_date')} /></Field>
        <Field label="Title" htmlFor="a-title" className="full"><input id="a-title" className="input" value={f.title} onChange={set('title')} maxLength={200} /></Field>
        <Field label="Description" htmlFor="a-desc" className="full"><textarea id="a-desc" className="input" value={f.description || ''} onChange={set('description')} maxLength={2000} /></Field>
        <Field label="Status" htmlFor="a-status" className="full">
          <select id="a-status" className="input" value={f.status} onChange={set('status')}>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <div className="modal-foot full"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save assignment'}</button></div>
      </form>
    </Modal>
  );
}

export default function Assignments() {
  const toast = useToast();
  const { data, loading, error, retry, setData } = useAsync(() => api('/assignments', { params: { today: todayStr() } }), []);
  const [filter, setFilter] = useState('active'); const [editing, setEditing] = useState(null);
  const today = todayStr();

  const stats = useMemo(() => {
    const l = data || [];
    return { pending: l.filter((a) => a.status !== 'completed').length, overdue: l.filter((a) => a.status !== 'completed' && a.due_date < today).length,
      done: l.filter((a) => a.status === 'completed').length, total: l.length };
  }, [data, today]);

  const list = useMemo(() => (data || []).filter((a) => {
    if (filter === 'active') return a.status !== 'completed';
    if (filter === 'overdue') return a.status !== 'completed' && a.due_date < today;
    if (filter === 'completed') return a.status === 'completed';
    return true;
  }), [data, filter, today]);

  const upsert = (s) => { setData((l) => (l.some((a) => a.id === s.id) ? l.map((a) => (a.id === s.id ? s : a)) : [...l, s]).sort((a, b) => (a.status === 'completed') - (b.status === 'completed') || a.due_date.localeCompare(b.due_date))); setEditing(null); };
  const setStatus = async (a, status) => { try { upsert(await api(`/assignments/${a.id}`, { method: 'PUT', body: { status } })); } catch (e) { toast.error(e.message); } };
  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try { await api(`/assignments/${a.id}`, { method: 'DELETE' }); setData((l) => l.filter((x) => x.id !== a.id)); toast.success('Assignment deleted'); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHead title="Assignments" subtitle="Every deadline in one place.">
        <button className="btn" onClick={() => setEditing(blank())}><Icon name="plus" size={18} />New assignment</button>
      </PageHead>
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox message={error} onRetry={retry} /> : (
        <>
          <div className="stats" style={{ marginBottom: 20 }}>
            <div className="stat"><b>{stats.pending}</b><span className="small muted">Pending</span></div>
            <div className="stat"><b style={{ color: stats.overdue ? 'var(--danger)' : undefined }}>{stats.overdue}</b><span className="small muted">Overdue</span></div>
            <div className="stat"><b>{stats.done}</b><span className="small muted">Completed</span></div>
            <div className="stat"><b>{stats.total ? Math.round((stats.done / stats.total) * 100) : 0}%</b><span className="small muted">Done overall</span></div>
          </div>
          <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
            {[['active', 'Pending'], ['overdue', 'Overdue'], ['completed', 'Completed'], ['all', 'All']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={`tab ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <section className="card">
            {list.length === 0 ? (
              <Empty icon="book" title={filter === 'completed' ? 'No completed assignments yet' : filter === 'overdue' ? 'Nothing overdue — nice work' : 'No assignments here'} action={<button className="btn btn-sm" onClick={() => setEditing(blank())}>Add assignment</button>}>
                Add your coursework so deadlines never sneak up on you.
              </Empty>
            ) : (
              <div className="list">
                {list.map((a) => {
                  const done = a.status === 'completed'; const late = !done && daysUntil(a.due_date) < 0;
                  return (
                    <div className="list-item" key={a.id} style={{ alignItems: 'flex-start' }}>
                      <input type="checkbox" className="check" style={{ marginTop: 2 }} checked={done} onChange={() => setStatus(a, done ? 'pending' : 'completed')} aria-label={`Mark ${a.title} as ${done ? 'not completed' : 'completed'}`} />
                      <div className="grow">
                        <div className="row wrap" style={{ gap: 8 }}><span className={`task-title ${done ? 'done' : ''}`} style={{ fontWeight: 600 }}>{a.title}</span><span className="badge badge-teal">{a.course}</span></div>
                        {a.description && <div className="small muted" style={{ marginTop: 2 }}>{a.description}</div>}
                        <div className="row wrap tiny muted" style={{ gap: 8, marginTop: 6 }}>
                          <span><Icon name="clock" size={12} /> Due {formatDate(a.due_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {!done && <span className={`badge ${late ? 'badge-danger' : daysUntil(a.due_date) <= 2 ? 'badge-peach' : 'badge-muted'}`}>{relativeDue(a.due_date)}</span>}
                          {done && <span className="badge badge-teal">Completed</span>}
                        </div>
                      </div>
                      {!done && <select className="input" style={{ width: 'auto', padding: '6px 10px' }} value={a.status} onChange={(e) => setStatus(a, e.target.value)} aria-label="Status">
                        <option value="pending">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>}
                      <button className="icon-btn" onClick={() => setEditing(a)} aria-label={`Edit ${a.title}`}><Icon name="edit" size={18} /></button>
                      <button className="icon-btn danger" onClick={() => remove(a)} aria-label={`Delete ${a.title}`}><Icon name="trash" size={18} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
      {editing && <AssignmentModal initial={editing} onClose={() => setEditing(null)} onSaved={upsert} />}
    </>
  );
}
