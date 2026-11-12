import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile as fbUpdateProfile, sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase';
import { api } from '../lib/api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const FRIENDLY = {
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
};
export const authMessage = (e) => FRIENDLY[e?.code] || e?.message || 'Something went wrong. Please try again.';

export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initialising, setInitialising] = useState(Boolean(auth));
  const [profileError, setProfileError] = useState(null);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    try { setProfile(await api('/users/me')); }
    catch (e) { setProfile(null); setProfileError(e.message); }
  }, []);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (u) await loadProfile(); else { setProfile(null); setProfileError(null); }
      setInitialising(false);
    });
  }, [loadProfile]);

  const value = useMemo(() => ({
    firebaseUser: fbUser,
    user: profile,
    loading: initialising,
    profileError,
    retryProfile: loadProfile,
    async register(name, email, password) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await fbUpdateProfile(cred.user, { displayName: name });
      await cred.user.getIdToken(true);
      // The first /users/me call can race with sign-up, so set the real name explicitly.
      await api('/users/me', { method: 'PUT', body: { name } });
      await loadProfile();
    },
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    async saveProfile(data) {
      const updated = await api('/users/me', { method: 'PUT', body: data });
      setProfile(updated);
      return updated;
    },
  }), [fbUser, profile, initialising, profileError, loadProfile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
