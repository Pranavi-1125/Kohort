import { auth, firebaseReady } from '../config/firebase.js';
import { one, query } from '../config/db.js';
import { HttpError, wrap } from '../utils/http.js';

export const requireAuth = wrap(async (req, _res, next) => {
  if (!firebaseReady()) throw new HttpError(503, 'Server is missing Firebase credentials. See the README for setup.');
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required');

  let decoded;
  try { decoded = await auth().verifyIdToken(token); }
  catch { throw new HttpError(401, 'Your session has expired. Please sign in again.'); }

  let user = await one('SELECT * FROM users WHERE firebase_uid = ?', [decoded.uid]);
  if (!user) {
    const email = decoded.email || `${decoded.uid}@unknown.local`;
    const name = (decoded.name || email.split('@')[0]).slice(0, 100);
    await query(
      'INSERT IGNORE INTO users (firebase_uid, name, email, photo_url) VALUES (?, ?, ?, ?)',
      [decoded.uid, name, email, decoded.picture || null]
    );
    user = await one('SELECT * FROM users WHERE firebase_uid = ?', [decoded.uid]);
  }
  req.user = user;
  next();
});

export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
};
