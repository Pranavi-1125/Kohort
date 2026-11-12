import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, authMessage } from '../context/AuthContext';
import { Field } from '../components/ui';
import Icon from '../components/Icon';

export default function Login() {
  const { firebaseUser, user, login, register, resetPassword } = useAuth();
  const navigate = useNavigate(); const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [info, setInfo] = useState('');

  if (firebaseUser && user) return <Navigate to={location.state?.from || '/'} replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setError(''); setInfo('');
    const email = form.email.trim();
    if (mode === 'register' && form.name.trim().length < 2) return setError('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (mode !== 'reset' && form.password.length < 6) return setError('Your password must be at least 6 characters.');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, form.password);
      else if (mode === 'register') await register(form.name.trim(), email, form.password);
      else { await resetPassword(email); setInfo('If an account exists for that email, a reset link is on its way.'); }
      if (mode !== 'reset') navigate(location.state?.from || '/', { replace: true });
    } catch (err) { setError(authMessage(err)); }
    finally { setBusy(false); }
  };

  const titles = { login: 'Welcome back', register: 'Create your account', reset: 'Reset your password' };
  return (
    <div className="auth-wrap">
      <section className="auth-art">
        <div className="brand"><span className="brand-mark"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#315B55" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4v16M8 12l8-8M10 11l7 9" /></svg></span>Kohort</div>
        <div className="stack" style={{ gap: 28 }}>
          <h1>Make room for progress.</h1>
          <div className="auth-points">
            {[['calendar', 'Plan your week and never miss a deadline'], ['timer', 'Focus alone, or in sync with your cohort'], ['users', 'Study rooms and chats for every class']].map(([i, t]) => (
              <div className="row" key={t}><Icon name={i} /><span>{t}</span></div>
            ))}
          </div>
        </div>
        <span className="small" style={{ opacity: .7, position: 'relative', zIndex: 1 }}>Your daily academic home.</span>
      </section>
      <section className="auth-form">
        <form className="auth-card" onSubmit={submit} noValidate>
          <div><h1>{titles[mode]}</h1><p className="muted" style={{ marginTop: 6 }}>{mode === 'register' ? 'Join your cohort in under a minute.' : mode === 'reset' ? 'We will email you a reset link.' : 'Sign in to pick up where you left off.'}</p></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          {info && <div className="badge badge-teal" style={{ padding: '10px 14px', borderRadius: 10 }}>{info}</div>}
          {mode === 'register' && <Field label="Full name" htmlFor="name"><input id="name" className="input" value={form.name} onChange={set('name')} autoComplete="name" /></Field>}
          <Field label="Email" htmlFor="email"><input id="email" type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" /></Field>
          {mode !== 'reset' && <Field label="Password" htmlFor="pw"><input id="pw" type="password" className="input" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field>}
          <button className="btn btn-lg" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}</button>
          <div className="small muted stack" style={{ gap: 6, textAlign: 'center' }}>
            {mode === 'login' && <><span>New to Kohort? <a href="#register" onClick={(e) => { e.preventDefault(); setMode('register'); setError(''); }}>Create an account</a></span>
              <a href="#reset" onClick={(e) => { e.preventDefault(); setMode('reset'); setError(''); }}>Forgot your password?</a></>}
            {mode !== 'login' && <a href="#login" onClick={(e) => { e.preventDefault(); setMode('login'); setError(''); setInfo(''); }}>Back to sign in</a>}
          </div>
        </form>
      </section>
    </div>
  );
}
