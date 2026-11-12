import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Avatar } from './ui';

// Search people by name or exact email. `selected` is an array of users; `onToggle(user)` toggles one.
export default function UserPicker({ selected = [], onToggle, exclude = [], single = false }) {
  const [q, setQ] = useState(''); const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setError(''); return undefined; }
    let alive = true; setLoading(true);
    const t = setTimeout(async () => {
      try { const r = await api('/users/search', { params: { q: q.trim() } }); if (alive) { setResults(r); setError(''); } }
      catch (e) { if (alive) setError(e.message); } finally { if (alive) setLoading(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const shown = results.filter((u) => !exclude.includes(u.id));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <input className="input" placeholder="Search by name, or type an exact email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
      {selected.length > 0 && !single && <div className="row wrap" style={{ gap: 6 }}>{selected.map((u) => <button type="button" key={u.id} className="chip active" onClick={() => onToggle(u)} title="Remove">{u.name} ✕</button>)}</div>}
      {error && <div className="form-error">{error}</div>}
      <div style={{ maxHeight: 220, overflow: 'auto' }}>
        {loading && <p className="small muted" style={{ padding: 8 }}>Searching…</p>}
        {!loading && q.trim().length >= 2 && shown.length === 0 && !error && <p className="small muted" style={{ padding: 8 }}>No people found.</p>}
        {shown.map((u) => {
          const sel = selected.some((x) => x.id === u.id);
          return (
            <button type="button" key={u.id} className={`pick ${sel ? 'sel' : ''}`} onClick={() => onToggle(u)}>
              <Avatar name={u.name} src={u.photo_url} size={34} />
              <span className="grow"><div style={{ fontWeight: 600 }}>{u.name}</div><div className="tiny muted">{[u.major, u.university].filter(Boolean).join(' · ') || 'Kohort member'}</div></span>
              {sel && <span className="badge badge-teal">Selected</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
