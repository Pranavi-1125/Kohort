import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from './ToastContext';

const Ctx = createContext(null);
export const useFocus = () => useContext(Ctx);

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.28].forEach((t) => {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.frequency.value = 660; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.15, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.22);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.25);
    });
  } catch { /* audio is optional */ }
}

export function FocusProvider({ children, onRecorded }) {
  const toast = useToast();
  const [focusMin, setFocusMinState] = useState(25);
  const [breakMin, setBreakMinState] = useState(5);
  const [mode, setMode] = useState('focus');
  const [status, setStatus] = useState('idle'); // idle | running | paused
  const [remaining, setRemaining] = useState(25 * 60);
  const [label, setLabel] = useState('');
  const [summary, setSummary] = useState(null);
  const endAt = useRef(0);

  const total = (mode === 'focus' ? focusMin : breakMin) * 60;

  const record = useCallback(async (kind, planned, done, lbl) => {
    try {
      await api('/focus/sessions', { method: 'POST', body: { kind, planned_seconds: planned, completed_seconds: done, label: lbl || undefined } });
      onRecorded?.();
    } catch (e) { toast.error(`Could not save this session: ${e.message}`); }
  }, [onRecorded, toast]);

  const finish = useCallback(async () => {
    setStatus('idle');
    beep();
    if (mode === 'focus') {
      setSummary({ kind: 'focus', minutes: focusMin, label });
      await record('focus', focusMin * 60, focusMin * 60, label);
    } else {
      setSummary({ kind: 'break', minutes: breakMin });
    }
    const next = mode === 'focus' ? 'break' : 'focus';
    setMode(next); setRemaining((next === 'focus' ? focusMin : breakMin) * 60);
  }, [mode, focusMin, breakMin, label, record]);

  useEffect(() => {
    if (status !== 'running') return undefined;
    const tick = () => {
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) finish();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [status, finish]);

  useEffect(() => {
    if (status === 'running') {
      const m = String(Math.floor(remaining / 60)).padStart(2, '0'); const s = String(remaining % 60).padStart(2, '0');
      document.title = `${m}:${s} · ${mode === 'focus' ? 'Focus' : 'Break'} — Kohort`;
    } else document.title = 'Kohort — Make room for progress';
  }, [status, remaining, mode]);

  const value = useMemo(() => ({
    mode, status, remaining, total, focusMin, breakMin, label, summary,
    setLabel, dismissSummary: () => setSummary(null),
    setFocusMin(m) { setFocusMinState(m); if (status === 'idle' && mode === 'focus') setRemaining(m * 60); },
    setBreakMin(m) { setBreakMinState(m); if (status === 'idle' && mode === 'break') setRemaining(m * 60); },
    switchMode(next) { if (status !== 'idle') return; setMode(next); setRemaining((next === 'focus' ? focusMin : breakMin) * 60); },
    start() { setSummary(null); endAt.current = Date.now() + remaining * 1000; setStatus('running'); },
    pause() { setRemaining(Math.max(0, Math.round((endAt.current - Date.now()) / 1000))); setStatus('paused'); },
    resume() { endAt.current = Date.now() + remaining * 1000; setStatus('running'); },
    async reset() {
      const elapsed = total - remaining;
      const wasFocus = mode === 'focus' && status !== 'idle' && elapsed >= 60;
      setStatus('idle'); setRemaining(total);
      if (wasFocus) { await record('focus', total, elapsed, label); toast.success(`Saved ${Math.floor(elapsed / 60)} min of focus.`); }
    },
  }), [mode, status, remaining, total, focusMin, breakMin, label, summary, record, toast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
