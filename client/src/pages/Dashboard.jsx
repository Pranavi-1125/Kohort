import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatDate, relativeDue, daysUntil, todayStr, tzOffset } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useFocus } from '../context/FocusContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { usePresence } from '../hooks/usePresence';
import { convName, convOther, timeAgo } from '../lib/conv';
import Icon from '../components/Icon';
import { Avatar, Empty, ErrorBox, Spinner } from '../components/ui';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

export default function Dashboard() {
  const { user, firebaseUser } = useAuth();
  const toast = useToast(); const navigate = useNavigate(); const focus = useFocus();
  const { data, loading, error, retry, reload, setData } = useAsync(() => api('/dashboard', { params: { today: todayStr(), tz: tzOffset() } }), []);
  const contacts = useAsync(() => api('/users/contacts'), []);
  const presence = usePresence(contacts.data?.map((c) => c.firebase_uid));

  useEffect(() => { window.addEventListener('kohort:focus-recorded', reload); return () => window.removeEventListener('kohort:focus-recorded', reload); }, [reload]);

  const toggleTask = async (t) => {
    setData((d) => ({ ...d, todayTasks: d.todayTasks.map((x) => (x.id === t.id ? { ...x, completed: t.completed ? 0 : 1 } : x)) }));
    try { await api(`/tasks/${t.id}`, { method: 'PUT', body: { completed: !t.completed } }); reload(); }
    catch (e) { toast.error(e.message); reload(); }
  };
  const quickFocus = (m) => { focus.setFocusMin(m); navigate('/focus'); };

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox message={error} onRetry={retry} />;
  const { todayTasks, assignments, rooms, conversations, groupSessions, counts, focus: f } = data;
  const onlineContacts = (contacts.data || []).filter((c) => presence[c.firebase_uid]);
  const taskPct = counts.tasks_total ? Math.round((counts.tasks_done / counts.tasks_total) * 100) : 0;
  const maxBar = Math.max(30, ...f.daily.map((d) => d.minutes));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {counts.overdue_tasks + counts.overdue_assignments > 0 ? ` · ${counts.overdue_tasks + counts.overdue_assignments} overdue item(s) need attention` : ' · You are all caught up on deadlines'}</p>
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => quickFocus(25)}><Icon name="timer" size={18} />Start focus</button>
          <Link className="btn btn-ghost" to="/focus?tab=group"><Icon name="users" size={18} />Group focus</Link>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card span-7">
          <div className="card-head"><h2>Today</h2><Link to="/planner" className="small">Open planner</Link></div>
          {todayTasks.length === 0 ? <Empty icon="calendar" title="Nothing planned for today" action={<Link className="btn btn-sm btn-ghost" to="/planner">Add a task</Link>}>Enjoy the breathing room, or plan something small.</Empty> : (
            <div className="list">
              {todayTasks.map((t) => (
                <div className="list-item" key={t.id}>
                  <input type="checkbox" className="check" checked={!!t.completed} onChange={() => toggleTask(t)} aria-label={`Mark ${t.title} as ${t.completed ? 'not done' : 'done'}`} />
                  <div className="grow"><div className={`task-title ${t.completed ? 'done' : ''}`}>{t.title}</div>{t.due_time && <div className="tiny muted">{t.due_time.slice(0, 5)}</div>}</div>
                  <span className={`badge ${t.priority === 'high' ? 'badge-peach' : 'badge-muted'}`}>{t.priority}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card span-5">
          <div className="card-head"><h2>Productivity</h2><span className="badge"><Icon name="flame" size={14} />{f.streak_days} day streak</span></div>
          <div className="stats">
            <div className="stat"><b>{f.today_minutes}</b><span className="small muted">focus min today</span></div>
            <div className="stat"><b>{f.week_minutes}</b><span className="small muted">min this week</span></div>
          </div>
          <div className="bars" style={{ marginTop: 18 }} aria-label="Focus minutes over the last 7 days">
            {f.daily.map((d, i) => (
              <div className="bar-col" key={d.date} title={`${d.minutes} min`}>
                <div className={`bar ${i === 6 ? 'today' : ''}`} style={{ height: `${Math.max(4, (d.minutes / maxBar) * 100)}%` }} />
                <span className="tiny muted">{new Date(`${d.date}T00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="row-between small"><span>Tasks completed</span><b>{counts.tasks_done}/{counts.tasks_total}</b></div>
            <div className="progress" style={{ marginTop: 6 }}><i style={{ width: `${taskPct}%` }} /></div>
          </div>
        </section>

        <section className="card span-5">
          <div className="card-head"><h2>Upcoming deadlines</h2><Link to="/assignments" className="small">View all</Link></div>
          {assignments.length === 0 ? <Empty icon="book" title="No pending assignments">Add assignments to track due dates here.</Empty> : (
            <div className="list">
              {assignments.map((a) => {
                const late = daysUntil(a.due_date) < 0;
                return (
                  <Link className="list-item item-link" to="/assignments" key={a.id}>
                    <div className="grow"><div className="truncate" style={{ fontWeight: 600 }}>{a.title}</div><div className="tiny muted truncate">{a.course}</div></div>
                    <div style={{ textAlign: 'right' }}><div className="small">{formatDate(a.due_date)}</div><span className={`badge ${late ? 'badge-danger' : daysUntil(a.due_date) <= 2 ? 'badge-peach' : 'badge-muted'}`}>{relativeDue(a.due_date)}</span></div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="card span-7">
          <div className="card-head"><h2>Focus together</h2><Link to="/focus?tab=group" className="small">All sessions</Link></div>
          <div className="presets" style={{ justifyContent: 'flex-start', marginBottom: 16 }}>
            {[15, 25, 45, 60].map((m) => <button key={m} className="chip" onClick={() => quickFocus(m)}>{m} min solo</button>)}
          </div>
          {groupSessions.length === 0 ? <Empty icon="users" title="No group sessions running" action={<Link className="btn btn-sm" to="/focus?tab=group">Start one</Link>}>Create a session and invite your cohort to join.</Empty> : (
            <div className="list">
              {groupSessions.map((g) => (
                <Link className="list-item item-link" key={g.id} to={`/focus/group/${g.id}`}>
                  <span className="dot on" /><div className="grow"><div style={{ fontWeight: 600 }}>{g.title}</div><div className="tiny muted">{g.member_count} studying · {Math.round(g.duration_seconds / 60)} min · {g.status}</div></div>
                  <span className="btn btn-sm btn-ghost">Join</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card span-4">
          <div className="card-head"><h2>Recent chats</h2><Link to="/messages" className="small">Messages</Link></div>
          {conversations.length === 0 ? <Empty icon="message" title="No conversations yet">Start chatting with a classmate.</Empty> : (
            <div className="list">
              {conversations.map((c) => { const other = convOther(c, firebaseUser.uid); return (
                <Link className="list-item item-link" key={c.id} to={`/messages/${c.id}`}>
                  <Avatar name={convName(c, firebaseUser.uid)} src={c.type === 'direct' ? other?.photo_url : null} size={38} />
                  <div className="grow"><div className="truncate" style={{ fontWeight: 600 }}>{convName(c, firebaseUser.uid)}</div><div className="tiny muted truncate">{c.last_message || 'No messages yet'}</div></div>
                  <span className="tiny muted">{timeAgo(c.last_message_at)}</span>
                </Link>); })}
            </div>
          )}
        </section>

        <section className="card span-4">
          <div className="card-head"><h2>Your study rooms</h2><Link to="/rooms" className="small">Browse</Link></div>
          {rooms.length === 0 ? <Empty icon="users" title="You have not joined a room" action={<Link className="btn btn-sm btn-ghost" to="/rooms">Find a room</Link>}>Rooms keep a course or topic together.</Empty> : (
            <div className="list">
              {rooms.map((r) => (
                <Link className="list-item item-link" key={r.id} to={`/rooms/${r.id}`}>
                  <div className="grow"><div className="truncate" style={{ fontWeight: 600 }}>{r.name}</div><div className="tiny muted">{r.member_count} members{r.topic ? ` · ${r.topic}` : ''}</div></div>
                  {!!r.is_private && <Icon name="lock" size={16} />}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card span-4">
          <div className="card-head"><h2>Online now</h2><span className="badge badge-teal">{onlineContacts.length}</span></div>
          {onlineContacts.length === 0 ? <Empty icon="user" title="Nobody online right now">Classmates from your rooms and chats appear here when they are active.</Empty> : (
            <div className="list">
              {onlineContacts.slice(0, 6).map((c) => (
                <div className="list-item" key={c.id}><Avatar name={c.name} src={c.photo_url} size={36} online /><span className="grow truncate">{c.name}</span>
                  <button className="btn btn-sm btn-ghost" onClick={async () => { try { const r = await api('/conversations', { method: 'POST', body: { type: 'direct', memberIds: [c.id] } }); navigate(`/messages/${r.id}`); } catch (e) { toast.error(e.message); } }}>Message</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
