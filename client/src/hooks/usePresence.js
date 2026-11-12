import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase';

// Publishes the signed-in user's online/offline state to Firebase Realtime Database.
export function useSelfPresence(uid) {
  useEffect(() => {
    if (!uid || !rtdb) return undefined;
    const me = ref(rtdb, `status/${uid}`);
    const unsub = onValue(ref(rtdb, '.info/connected'), (snap) => {
      if (snap.val() === false) return;
      onDisconnect(me).set({ state: 'offline', lastChanged: serverTimestamp() })
        .then(() => set(me, { state: 'online', lastChanged: serverTimestamp() }))
        .catch(() => {});
    });
    return () => { unsub(); set(me, { state: 'offline', lastChanged: serverTimestamp() }).catch(() => {}); };
  }, [uid]);
}

// Returns { [uid]: boolean } for the given Firebase UIDs.
export function usePresence(uids) {
  const key = useMemo(() => [...new Set((uids || []).filter(Boolean))].sort().join(','), [uids]);
  const [map, setMap] = useState({});
  useEffect(() => {
    if (!rtdb || !key) { setMap({}); return undefined; }
    const list = key.split(',');
    const unsubs = list.map((uid) => onValue(ref(rtdb, `status/${uid}`), (snap) => {
      const online = snap.val()?.state === 'online';
      setMap((m) => (m[uid] === online ? m : { ...m, [uid]: online }));
    }, () => {}));
    return () => unsubs.forEach((u) => u());
  }, [key]);
  return map;
}
