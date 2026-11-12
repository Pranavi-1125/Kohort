import { auth } from '../firebase';

const BASE = import.meta.env.VITE_API_URL || '/api';

export async function api(path, { method = 'GET', body, params } = {}) {
  const user = auth?.currentUser;
  if (!user) throw new Error('You are signed out. Please sign in again.');
  const token = await user.getIdToken();
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    : '';
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the Kohort server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const tzOffset = () => -new Date().getTimezoneOffset();
export const toDateStr = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const todayStr = () => toDateStr(new Date());
export const fromDateStr = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const formatDate = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  fromDateStr(s).toLocaleDateString(undefined, opts);
export const daysUntil = (s) => Math.round((fromDateStr(s) - fromDateStr(todayStr())) / 86400000);
export const relativeDue = (s) => {
  const n = daysUntil(s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${-n} days overdue`;
};
export const initials = (name = '?') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
