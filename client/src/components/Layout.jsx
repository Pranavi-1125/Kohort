import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FocusProvider, useFocus } from '../context/FocusContext';
import { useSelfPresence } from '../hooks/usePresence';
import Icon from './Icon';
import { Avatar } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/planner', label: 'Planner', icon: 'calendar' },
  { to: '/assignments', label: 'Assignments', icon: 'book' },
  { to: '/focus', label: 'Focus', icon: 'timer' },
  { to: '/rooms', label: 'Study Rooms', icon: 'users' },
  { to: '/messages', label: 'Messages', icon: 'message' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

const Logo = () => (
  <span className="brand-mark" aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF9ED" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4v16M8 12l8-8M10 11l7 9" /></svg>
  </span>
);

function TimerPill() {
  const { status, remaining, mode } = useFocus();
  const navigate = useNavigate();
  if (status === 'idle') return null;
  const m = String(Math.floor(remaining / 60)).padStart(2, '0'); const s = String(remaining % 60).padStart(2, '0');
  return (
    <button className="timer-pill" onClick={() => navigate('/focus')} style={{ border: 'none', cursor: 'pointer' }} aria-label="Open focus timer">
      <Icon name="timer" size={16} />{mode === 'focus' ? 'Focus' : 'Break'} {m}:{s}{status === 'paused' ? ' ⏸' : ''}
    </button>
  );
}

function Shell() {
  const { user, firebaseUser, logout } = useAuth();
  useSelfPresence(firebaseUser?.uid);
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><Logo />Kohort</div>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} />{n.label}</NavLink>
          ))}
        </nav>
        <div className="sidebar-foot stack">
          <TimerPill />
          <div className="user-chip">
            <Avatar name={user?.name} src={user?.photo_url} size={36} />
            <div className="grow"><div className="truncate" style={{ fontWeight: 600 }}>{user?.name}</div><div className="tiny muted truncate">{user?.major || user?.email}</div></div>
            <button className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out"><Icon name="logout" size={18} /></button>
          </div>
        </div>
      </aside>

      <div>
        <header className="mobile-bar">
          <div className="brand" style={{ fontSize: '1.2rem' }}><Logo />Kohort</div>
          <div className="row"><TimerPill /><button className="icon-btn" onClick={logout} aria-label="Sign out"><Icon name="logout" /></button></div>
        </header>
        <main className="main"><Outlet /></main>
      </div>

      <nav className="bottom-nav" aria-label="Main mobile">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} size={20} /><span>{n.label.replace('Study ', '')}</span></NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function Layout() {
  return (
    <FocusProvider onRecorded={() => window.dispatchEvent(new Event('kohort:focus-recorded'))}>
      <Shell />
    </FocusProvider>
  );
}
