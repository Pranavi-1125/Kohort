import { useEffect } from 'react';
import Icon from './Icon';
import { initials } from '../lib/api';

export function Avatar({ name, src, size = 40, online }) {
  const el = (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} title={name}>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
      {!src && initials(name)}
    </span>
  );
  if (online === undefined) return el;
  return <span className={`presence ${online ? 'on' : ''}`} title={online ? 'Online' : 'Offline'}>{el}</span>;
}

export function Spinner({ label = 'Loading…' }) {
  return <div className="loading" role="status"><div className="spinner" /><span className="sr-only">{label}</span></div>;
}

export function Empty({ icon = 'check', title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} /></div>
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="error-box" role="alert">
      <span>{message}</span>
      {onRetry && <button className="btn btn-sm btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 640 } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const PageHead = ({ title, subtitle, children }) => (
  <div className="page-head">
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {children && <div className="row wrap">{children}</div>}
  </div>
);

export const Field = ({ label, htmlFor, children, className = '' }) => (
  <div className={`field ${className}`}><label htmlFor={htmlFor}>{label}</label>{children}</div>
);
