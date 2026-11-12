import { useState } from 'react';
import { api, tzOffset } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import Icon from '../components/Icon';
import { Avatar, Field, PageHead } from '../components/ui';

export default function Profile() {
  const { user, saveProfile, logout } = useAuth(); const toast = useToast();
  const stats = useAsync(() => api('/focus/stats', { params: { tz: tzOffset() } }), []);
  const [f, setF] = useState({ name: user.name || '', photo_url: user.photo_url || '', university: user.university || '', major: user.major || '', year_of_study: user.year_of_study || '', bio: user.bio || '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const dirty = Object.keys(f).some((k) => (f[k] || '') !== (user[k] || ''));

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.name.trim().length < 2) return setErr('Your name needs at least 2 characters.');
    if (f.photo_url && !/^https?:\/\//i.test(f.photo_url.trim())) return setErr('Profile picture must be a link starting with http:// or https://');
    setBusy(true);
    try { await saveProfile(f); toast.success('Profile saved'); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Profile" subtitle="How you appear to classmates." />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)', alignItems: 'start' }}>
        <section className="card stack" style={{ textAlign: 'center', alignItems: 'center' }}>
          <Avatar name={f.name || user.name} src={f.photo_url} size={96} />
          <div><h2>{f.name || user.name}</h2><p className="muted small">{user.email}</p></div>
          {(f.major || f.university) && <p className="small">{[f.major, f.year_of_study, f.university].filter(Boolean).join(' · ')}</p>}
          {f.bio && <p className="small muted">{f.bio}</p>}
          {stats.data && <div className="stats" style={{ width: '100%' }}>
            <div className="stat"><b>{stats.data.streak_days}</b><span className="tiny muted">day streak</span></div>
            <div className="stat"><b>{Math.round(stats.data.week_minutes / 6) / 10}</b><span className="tiny muted">focus hrs / week</span></div></div>}
          <button className="btn btn-ghost" onClick={logout}><Icon name="logout" size={18} />Sign out</button>
        </section>
        <form className="card" onSubmit={submit} noValidate>
          <div className="card-head"><h2>Edit profile</h2></div>
          <div className="form-grid">
            {err && <div className="form-error full" role="alert">{err}</div>}
            <Field label="Full name" htmlFor="p-name"><input id="p-name" className="input" value={f.name} maxLength={100} onChange={set('name')} /></Field>
            <Field label="Email" htmlFor="p-email"><input id="p-email" className="input" value={user.email} disabled /></Field>
            <Field label="University" htmlFor="p-uni"><input id="p-uni" className="input" value={f.university} maxLength={150} onChange={set('university')} /></Field>
            <Field label="Major / program" htmlFor="p-major"><input id="p-major" className="input" value={f.major} maxLength={150} onChange={set('major')} /></Field>
            <Field label="Year of study" htmlFor="p-year">
              <select id="p-year" className="input" value={f.year_of_study} onChange={set('year_of_study')}><option value="">Select…</option>{['1st year', '2nd year', '3rd year', '4th year', 'Postgraduate', 'Other'].map((y) => <option key={y}>{y}</option>)}</select>
            </Field>
            <Field label="Profile picture URL" htmlFor="p-photo"><input id="p-photo" className="input" value={f.photo_url} maxLength={500} onChange={set('photo_url')} placeholder="https://…" /></Field>
            <Field label="Bio" htmlFor="p-bio" className="full"><textarea id="p-bio" className="input" value={f.bio} maxLength={500} onChange={set('bio')} placeholder="What are you studying, and what are you aiming for this term?" /></Field>
            <div className="modal-foot full" style={{ marginTop: 0 }}><button className="btn" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button></div>
          </div>
        </form>
      </div>
    </>
  );
}
