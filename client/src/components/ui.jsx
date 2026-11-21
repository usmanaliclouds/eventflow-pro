import { useEffect, useId, useState, useCallback } from 'react';
import { AlertCircle, BadgeCheck, CalendarX2, Clock, Eye, EyeOff, Loader2, RefreshCw, User, X, Check, AlertTriangle } from 'lucide-react';
import { useApp } from '../context';

export function Button({ variant = 'primary', size, loading, children, className = '', block, ...rest }) {
  const { t } = useApp();
  return (
    <button
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${block ? 'btn-block' : ''} ${className}`}
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <><Loader2 size={18} className="spin" aria-hidden /> <span>{t('Please wait…')}</span></> : children}
    </button>
  );
}

export function Field({ label, error, hint, children, className = '', id }) {
  const auto = useId();
  const fid = id || auto;
  const child = typeof children === 'function' ? children({ id: fid, 'aria-invalid': !!error, 'aria-describedby': error ? `${fid}-err` : hint ? `${fid}-hint` : undefined }) : children;
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && <label htmlFor={fid}>{label}</label>}
      {child}
      {hint && !error && <span className="hint" id={`${fid}-hint`}>{hint}</span>}
      {error && <span className="field-error" id={`${fid}-err`} role="alert"><AlertCircle size={16} aria-hidden />{error}</span>}
    </div>
  );
}

export function PasswordInput(props) {
  const [show, setShow] = useState(false);
  const { t } = useApp();
  return (
    <div className="input-wrap">
      <input className="input" type={show ? 'text' : 'password'} {...props} />
      <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? t('Hide password') : t('Show password')} aria-pressed={show}>
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}

export function Avatar({ color = '#A5ACF0', size = 48, name }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: color }} aria-hidden={!name} title={name}>
      <User size={size * 0.6} strokeWidth={2.4} fill="#fff" />
    </span>
  );
}

export function VerifiedBadge({ small }) {
  const { t } = useApp();
  return <span className="badge badge-verified" style={small ? { fontSize: '.75rem' } : null}><BadgeCheck size={16} aria-hidden />{t('Verified Pro')}</span>;
}

const STATUS = {
  invited: ['badge-indigo', Check, 'Invited'],
  confirmed: ['badge-green', Check, 'Confirmed'],
  uniform_ready: ['badge-green', Check, 'Uniform Ready'],
  pending: ['badge-amber', Clock, 'Pending audit'],
  approved: ['badge-verified', BadgeCheck, 'Verified Pro'],
  rejected: ['badge-red', X, 'Rejected'],
  not_submitted: ['badge-gray', null, 'Not submitted'],
  conflict: ['badge-amber', AlertTriangle, 'Booked elsewhere'],
  completed: ['badge-green', Check, 'Completed'],
  reviewed: ['badge-green', Check, 'Reviewed'],
  planned: ['badge-gray', null, 'Planning'],
};
export function StatusBadge({ status, label }) {
  const { t } = useApp();
  const [cls, Icon, text] = STATUS[status] || ['badge-gray', null, status];
  return <span className={`badge ${cls}`}>{Icon && <Icon size={15} aria-hidden />}{label || t(text)}</span>;
}

export function Stars({ value, size = 18 }) {
  const { t } = useApp();
  return (
    <span className="row" style={{ gap: 4 }} aria-label={t('{n} out of 5 stars', { n: value })}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" fill="none" stroke="#C27C0A" strokeWidth="2" strokeLinejoin="round" /></svg>
      <span className="num">{Number(value).toFixed(1)}</span>
    </span>
  );
}

export function Toggle({ checked, onChange, label, id }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span aria-hidden />
    </span>
  );
}

export function Loading({ label, rows }) {
  const { t } = useApp();
  if (rows) {
    return (
      <div className="stack" aria-busy="true" aria-label={t('Loading…')}>
        {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
      </div>
    );
  }
  return (
    <div className="state" role="status">
      <Loader2 size={40} className="spin" color="var(--indigo-600)" aria-hidden />
      <h3>{label || t('Loading…')}</h3>
      <p className="muted small">{t('Please wait while content loads.')}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry, title }) {
  const { t } = useApp();
  return (
    <div className="state card" role="alert">
      <div className="icon-circle red"><AlertCircle size={32} aria-hidden /></div>
      <h3>{title || t('Couldn’t load this page')}</h3>
      <p className="muted">{error?.message || t('Check your internet and try again.')}</p>
      {onRetry && <Button variant="indigo" onClick={onRetry}><RefreshCw size={18} aria-hidden />{t('Try again')}</Button>}
    </div>
  );
}

export function EmptyState({ icon: Icon = CalendarX2, title, body, action }) {
  return (
    <div className="state card">
      <div className="icon-circle"><Icon size={32} aria-hidden /></div>
      <h3>{title}</h3>
      {body && <p className="muted" style={{ maxWidth: 420 }}>{body}</p>}
      {action}
    </div>
  );
}

// Loads data from the API and handles loading/error state for a page.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn().then((data) => setState({ loading: false, error: null, data }))
      .catch((error) => setState({ loading: false, error, data: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

export function Drawer({ onClose, children, foot, label }) {
  const { t } = useApp();
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="overlay" onMouseDown={onClose} style={{ zIndex: 65 }} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        <div className="row" style={{ justifyContent: 'flex-end', padding: '12px 12px 0' }}>
          <button className="icon-btn" onClick={onClose} aria-label={t('Close')} autoFocus><X size={22} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {foot && <div className="drawer-foot">{foot}</div>}
      </aside>
    </>
  );
}

export function Stepper({ steps, current }) {
  const { t } = useApp();
  return (
    <ol className="steps card" aria-label={t('Progress')} style={{ listStyle: 'none', margin: 0 }}>
      {steps.map((s, i) => (
        <li key={s} style={{ display: 'contents' }}>
          {i > 0 && <span className={`step-line ${i <= current ? 'done' : ''}`} aria-hidden />}
          <span className={`step ${i < current ? 'done' : i === current ? 'current' : ''}`} aria-current={i === current ? 'step' : undefined}>
            <span className="dot">{i < current ? <Check size={18} aria-hidden /> : i + 1}</span>
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function NumberStepper({ value, onChange, min = 1, max = 200, label }) {
  const { t } = useApp();
  return (
    <span className="stepper-num">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={t('Fewer {x}', { x: label })}>–</button>
      <input type="number" inputMode="numeric" min={min} max={max} value={value} aria-label={label}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
      <button type="button" onClick={() => onChange(Math.min(max, Number(value || 0) + 1))} disabled={value >= max} aria-label={t('More {x}', { x: label })}>+</button>
    </span>
  );
}
