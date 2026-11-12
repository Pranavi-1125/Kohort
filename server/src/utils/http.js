export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const str = (v, { field, max = 255, required = false } = {}) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new HttpError(400, `${field} is required`);
  if (s.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return s || null;
};
export const dateStr = (v, field, required = true) => {
  if (!v && !required) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw new HttpError(400, `${field} must be a date in YYYY-MM-DD format`);
  }
  return v;
};
export const timeStr = (v) => {
  if (!v) return null;
  if (typeof v !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(v)) throw new HttpError(400, 'due_time must be HH:MM');
  return v.length === 5 ? `${v}:00` : v;
};
export const oneOf = (v, allowed, field) => {
  if (!allowed.includes(v)) throw new HttpError(400, `${field} must be one of: ${allowed.join(', ')}`);
  return v;
};
export const intId = (v, field = 'id') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${field}`);
  return n;
};
export const todayStr = (req) => {
  const t = req.query.today;
  return typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : new Date().toISOString().slice(0, 10);
};
