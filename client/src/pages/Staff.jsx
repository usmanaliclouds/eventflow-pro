import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useBlocker } from 'react-router-dom';
import {
  ShieldCheck, MapPin, Phone, Shirt, CalendarX2, Check, X, Camera, Image as ImageIcon, AlertTriangle, CheckCircle2,
  Clock, FileText, RefreshCw, WifiOff, ChevronRight, Settings as SettingsIcon, LogOut, Info, BadgeCheck,
} from 'lucide-react';
import { useApp } from '../context';
import { get, post, put } from '../api';
import { rs, dayLabel, daysUntil } from '../format';
import { Avatar, Button, ErrorState, Loading, StatusBadge, VerifiedBadge } from '../components/ui';
import { MTop } from '../components/StaffLayout';
import { NotificationsPanel } from '../components/Layout';
import Settings from './Settings';

// ---------- offline cache (FR-24: shifts and uniform guide stay viewable offline) ----------
const cacheGet = (k) => { try { return JSON.parse(localStorage.getItem(`ef_cache_${k}`)); } catch { return null; } };
const cacheSet = (k, v) => { try { localStorage.setItem(`ef_cache_${k}`, JSON.stringify({ at: Date.now(), v })); } catch { /* full or blocked */ } };

function useCached(key, fn, deps = []) {
  const [s, setS] = useState({ loading: true, data: null, error: null, fromCache: null });
  const run = useCallback(() => {
    setS((x) => ({ ...x, loading: true, error: null }));
    return fn().then((data) => { cacheSet(key, data); setS({ loading: false, data, error: null, fromCache: null }); })
      .catch((error) => {
        const c = error.code === 'OFFLINE' ? cacheGet(key) : null;
        setS(c ? { loading: false, data: c.v, error: null, fromCache: c.at } : { loading: false, data: null, error, fromCache: null });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...s, reload: run, setData: (d) => setS((x) => ({ ...x, data: d })) };
}

function OfflineNote({ at }) {
  const { t } = useApp();
  if (!at) return null;
  const time = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return <div className="banner banner-dark" style={{ margin: 0 }} role="status"><WifiOff size={18} aria-hidden /><span className="small">{t('Offline – showing saved shifts (updated {t})', { t: time })}</span></div>;
}

const whenLabel = (date, t) => {
  const d = daysUntil(date);
  return d === 0 ? t('Today') : d === 1 ? t('Tomorrow') : d < 7 ? t('This week') : t('Later');
};

// ---------- S12 Shift feed ----------
function ShiftCard({ s, next, onChanged }) {
  const { t, lang, toast, confirm } = useApp();
  const nav = useNavigate();
  const [busy, setBusy] = useState(null);
  const act = async (what) => {
    if (what === 'decline' && !(await confirm({ title: t('Decline this shift?'), body: t('The manager will be told and the slot goes to someone else. This cannot be undone.'), ok: t('Decline'), cancel: t('Keep shift'), danger: true }))) return;
    setBusy(what);
    try {
      await post(`/staff-app/shifts/${s.bookingId}/${what}`);
      toast(what === 'accept' ? t('Shift accepted. The manager can see it.') : t('Shift declined.'), { kind: 'success' });
      onChanged();
    } catch (e) { toast(e.message, { kind: 'error' }); } finally { setBusy(null); }
  };
  return (
    <article className={`m-card ${next ? 'next' : ''}`} aria-label={s.event.name}>
      {next && <div className="m-label" style={{ color: 'var(--indigo-600)' }}>{t('Next shift')} · {whenLabel(s.event.date, t)}</div>}
      <div className="m-row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{t(s.event.type)} · {t(s.role)}</div>
          <div className="small muted">{s.event.name}</div>
        </div>
        <b className="num">{rs(s.rate)}</b>
      </div>
      <div className="small">{dayLabel(s.event.date, lang)} · <span className="latin" dir="ltr">{s.event.start}–{s.event.end}</span></div>
      <div className="small muted m-row" style={{ gap: 6 }}><MapPin size={15} aria-hidden />{s.event.venue}</div>
      <div><StatusBadge status={s.status} /></div>
      {s.status === 'invited' ? (
        <div className="m-btns">
          <Button variant="secondary" loading={busy === 'decline'} onClick={() => act('decline')}>{t('Decline')}</Button>
          <Button loading={busy === 'accept'} onClick={() => act('accept')}>{t('Accept')}</Button>
        </div>
      ) : (
        <div className="m-btns">
          <Button variant={next ? 'primary' : 'secondary'} onClick={() => nav(`/staff/uniform/${s.bookingId}`)}><Shirt size={18} aria-hidden />{t('Uniform Guide')}</Button>
          <Button variant="text" onClick={() => nav(`/staff/shifts/${s.bookingId}`)}>{t('Shift details')}</Button>
        </div>
      )}
    </article>
  );
}

function VerifyPrompt({ status }) {
  const { t } = useApp();
  const nav = useNavigate();
  const label = { not_submitted: t('Not submitted'), pending: t('Pending audit'), rejected: t('Rejected – please re-upload') }[status];
  return (
    <div className={`m-card ${status === 'rejected' ? 'danger' : 'info'}`}>
      <div className="m-row"><ShieldCheck size={24} color={status === 'rejected' ? 'var(--red-600)' : 'var(--indigo-600)'} aria-hidden />
        <b style={{ fontSize: '1.0625rem' }}>{status === 'pending' ? t('Your documents are being checked') : t('Get verified to get more shifts')}</b></div>
      <div className="small">{t('Status')}: <b>{label}</b></div>
      <Button variant="secondary" onClick={() => nav('/staff/verify')}>{status === 'pending' ? t('See status') : status === 'rejected' ? t('Re-upload') : t('Get Verified')}</Button>
    </div>
  );
}

export function StaffShifts() {
  const { t } = useApp();
  const { data, loading, error, reload, fromCache } = useCached('home', () => get('/staff-app/home'), []);
  const [showPast, setShowPast] = useState(false);
  return (
    <>
      <MTop title={t('My Shifts')} />
      <div className="m-content">
        {error ? <ErrorState error={error} onRetry={reload} title={t('Couldn’t load your shifts')} />
          : loading && !data ? <Loading rows={3} /> : (
            <>
              <OfflineNote at={fromCache} />
              {data.verification === 'verified'
                ? <div className="m-row"><VerifiedBadge /><span className="small muted">{t('Rank {r}', { r: data.rank })}</span></div>
                : <VerifyPrompt status={data.verification} />}
              {data.upcoming.length === 0 ? (
                <div className="state card" style={{ padding: 32 }}>
                  <div className="icon-circle"><CalendarX2 size={30} aria-hidden /></div>
                  <h3>{t('No shifts yet')}</h3>
                  <p className="muted small">{data.verification === 'verified' ? t('When a manager hires you, the invite shows up here and you get a notification.') : t('Managers can only hire Verified Pro staff. Get verified first.')}</p>
                </div>
              ) : (
                <>
                  <ShiftCard s={data.upcoming[0]} next onChanged={reload} />
                  {data.upcoming.length > 1 && <div className="m-label">{t('Later')}</div>}
                  {data.upcoming.slice(1).map((s) => <ShiftCard key={s.bookingId} s={s} onChanged={reload} />)}
                </>
              )}
              {data.past.length > 0 && (
                <>
                  <button className="btn btn-text" onClick={() => setShowPast((x) => !x)} aria-expanded={showPast}>{showPast ? t('Hide past shifts') : t('Show past shifts ({n})', { n: data.past.length })}</button>
                  {showPast && data.past.map((s) => (
                    <div key={s.bookingId} className="m-card" style={{ opacity: 0.85 }}>
                      <b>{s.event.name}</b><span className="small muted">{t(s.role)} · {dayLabel(s.event.date)} · {rs(s.rate)}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
      </div>
    </>
  );
}

// Shift details
export function ShiftDetail() {
  const { id } = useParams();
  const { t, lang } = useApp();
  const nav = useNavigate();
  const { data: s, loading, error, reload, fromCache } = useCached(`shift_${id}`, () => get(`/staff-app/shifts/${id}`), [id]);
  return (
    <>
      <MTop title={t('Shift details')} back="/staff/shifts" />
      <div className="m-content">
        {error ? <ErrorState error={error} onRetry={reload} /> : loading && !s ? <Loading /> : (
          <>
            <OfflineNote at={fromCache} />
            <div className="m-card">
              <h2 style={{ fontSize: '1.375rem' }}>{s.event.name}</h2>
              <div>{t(s.event.type)} · {t(s.role)} · <b className="num">{rs(s.rate)}</b></div>
              <div>{dayLabel(s.event.date, lang)} · <span className="latin" dir="ltr">{s.event.start}–{s.event.end}</span></div>
              <StatusBadge status={s.status} />
            </div>
            <div className="m-card">
              <div className="m-label">{t('Where')}</div>
              <div className="m-row"><MapPin size={18} aria-hidden />{s.event.venue}</div>
              <a className="btn btn-secondary" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.event.venue)}`} target="_blank" rel="noreferrer">{t('Open in Maps')}</a>
            </div>
            <div className="m-card">
              <div className="m-label">{t('Manager')}</div>
              <div><b>{s.manager.name}</b><div className="small muted">{s.manager.company}</div></div>
              <a className="btn btn-secondary" href={`tel:${s.manager.phone}`}><Phone size={18} aria-hidden />{t('Call manager')}</a>
            </div>
            <Button onClick={() => nav(`/staff/uniform/${s.bookingId}`)}><Shirt size={18} aria-hidden />{t('Uniform Guide')} · {t(s.uniform.name)}</Button>
          </>
        )}
      </div>
    </>
  );
}

// ---------- S14 Uniform guide ----------
function Figure({ colors, wrong }) {
  const c = wrong ? { top: '#8FB8DE', bottom: '#4A6FA5', accent: null, shoes: '#F4F4F4' } : colors;
  return (
    <svg viewBox="0 0 120 200" width="100%" style={{ maxWidth: 130 }} aria-hidden>
      <circle cx="60" cy="28" r="18" fill="#C68B59" />
      <path d="M38 22c2-14 42-14 44 0-8-6-36-6-44 0z" fill="#2A1E16" />
      <path d="M30 56c0-6 6-10 12-10h36c6 0 12 4 12 10v56H30z" fill={c.top} stroke="#14161C" strokeWidth="1.5" />
      <rect x="22" y="56" width="10" height="52" rx="5" fill={c.top} stroke="#14161C" strokeWidth="1.5" />
      <rect x="88" y="56" width="10" height="52" rx="5" fill={c.top} stroke="#14161C" strokeWidth="1.5" />
      {wrong && <path d="M44 70l8 6-6 8 10 6M66 92l8-4-4 10" stroke="#5F87B5" strokeWidth="1.5" fill="none" />}
      {c.accent && <path d="M53 50l7 6 7-6-3 10h-8z" fill={c.accent} stroke="#14161C" strokeWidth="1" />}
      {!wrong && <rect x="68" y="64" width="12" height="7" rx="1.5" fill="#E99A1C" />}
      <path d="M36 112h48l-4 70H64l-4-50-4 50H40z" fill={c.bottom} stroke="#14161C" strokeWidth="1.5" />
      <rect x="34" y="182" width="24" height="10" rx="4" fill={c.shoes} stroke="#14161C" strokeWidth="1.5" />
      <rect x="62" y="182" width="24" height="10" rx="4" fill={c.shoes} stroke="#14161C" strokeWidth="1.5" />
    </svg>
  );
}

export function UniformTab() {
  const { t } = useApp();
  const nav = useNavigate();
  const { data, loading } = useCached('home', () => get('/staff-app/home'), []);
  useEffect(() => {
    const next = data?.upcoming.find((s) => s.status !== 'invited') || data?.upcoming[0];
    if (next) nav(`/staff/uniform/${next.bookingId}`, { replace: true });
  }, [data, nav]);
  if (loading || data?.upcoming.length) return <><MTop title={t('Uniform Guide')} /><Loading /></>;
  return (
    <>
      <MTop title={t('Uniform Guide')} />
      <div className="m-content">
        <div className="state card"><div className="icon-circle"><Shirt size={30} aria-hidden /></div><h3>{t('No upcoming shift')}</h3>
          <p className="muted small">{t('The uniform guide for your next shift will appear here.')}</p></div>
      </div>
    </>
  );
}

export function UniformGuide() {
  const { id } = useParams();
  const { t, lang, toast, confirm } = useApp();
  const nav = useNavigate();
  const { data: s, loading, error, reload, fromCache, setData } = useCached(`shift_${id}`, () => get(`/staff-app/shifts/${id}`), [id]);
  const [checked, setChecked] = useState(null);
  const [asText, setAsText] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (s && checked === null) setChecked(cacheGet(`check_${id}`)?.v || s.checklist || []); }, [s, checked, id]);

  if (error) return <><MTop title={t('Uniform Guide')} back /><div className="m-content"><ErrorState error={error} onRetry={reload} /></div></>;
  if ((loading && !s) || checked === null) return <><MTop title={t('Uniform Guide')} back /><Loading /></>;
  const items = s.uniform.items;
  const toggle = (it) => { const n = checked.includes(it) ? checked.filter((x) => x !== it) : [...checked, it]; setChecked(n); cacheSet(`check_${id}`, n); };
  const ready = s.status === 'uniform_ready';
  const markReady = async () => {
    const missing = items.length - checked.length;
    if (missing > 0 && !(await confirm({ title: t('{n} items not ticked', { n: missing }), body: t('Mark yourself ready anyway?'), ok: t('Mark ready'), cancel: t('Go back') }))) return;
    setSaving(true);
    try { setData(await post(`/staff-app/shifts/${id}/uniform`, { checked, ready: true })); toast(t('You’re Uniform Ready. Your manager can see it.'), { kind: 'success' }); }
    catch (e) { toast(e.code === 'OFFLINE' ? t('No internet. Your ticks are saved on this phone – try again when you are online.') : e.message, { kind: 'error' }); }
    finally { setSaving(false); }
  };
  return (
    <>
      <MTop title={t('Uniform Guide')} back />
      <div className="m-content">
        <OfflineNote at={fromCache} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{t(s.event.type)} · {t(s.role)} · {dayLabel(s.event.date, lang)} <span className="latin" dir="ltr">{s.event.start}</span></div>
          <div className="small muted">{t(s.uniform.name)}</div>
        </div>
        {asText ? (
          <div className="m-card">
            <div><span className="badge badge-green"><Check size={14} aria-hidden />{t('Correct')}</span><p style={{ marginTop: 6 }}>{s.uniform.correct}</p></div>
            <div><span className="badge badge-red"><X size={14} aria-hidden />{t('Incorrect')}</span><p style={{ marginTop: 6 }}>{s.uniform.incorrect}</p></div>
          </div>
        ) : (
          <div className="figure-pair">
            <figure><Figure colors={s.uniform.colors} /><figcaption><span className="badge badge-green"><Check size={14} aria-hidden />{t('Correct')}</span></figcaption></figure>
            <figure><Figure wrong /><figcaption><span className="badge badge-red"><X size={14} aria-hidden />{t('Incorrect')}</span></figcaption></figure>
          </div>
        )}
        <button className="btn btn-text btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAsText((x) => !x)}>
          <FileText size={16} aria-hidden />{asText ? t('Show pictures') : t('Can’t see the pictures? Read it as text')}
        </button>
        <div className="m-row"><b style={{ flex: 1 }}>{t('Before you leave, check:')}</b><span className="small muted num">{checked.length}/{items.length}</span></div>
        <div className="stack" style={{ gap: 8 }}>
          {items.map((it) => (
            <label key={it} className={`check-row ${checked.includes(it) ? 'done' : ''}`}>
              <input type="checkbox" checked={checked.includes(it)} onChange={() => toggle(it)} disabled={ready} />{t(it)}
            </label>
          ))}
        </div>
        {ready ? (
          <div className="m-card info" role="status"><div className="m-row"><CheckCircle2 color="var(--green-700)" aria-hidden /><b>{t('You’re Uniform Ready')}</b></div>
            <span className="small">{t('Your manager can see it.')}</span><Button variant="secondary" onClick={() => nav('/staff/shifts')}>{t('Back to shifts')}</Button></div>
        ) : s.status === 'invited' ? (
          <p className="small muted"><Info size={14} aria-hidden style={{ verticalAlign: -2 }} /> {t('Accept the shift first, then mark yourself Uniform Ready.')}</p>
        ) : <Button block loading={saving} onClick={markReady}>{t('I’m Uniform Ready')}</Button>}
      </div>
    </>
  );
}

// ---------- S13 Credential vault ----------
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
function compress(file, maxSide = 1800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad')); };
    img.src = url;
  });
}

function CaptureStep({ title, stepText, value, onChange, onNext, onBack, onSkip }) {
  const { t } = useApp();
  const [pending, setPending] = useState(null); // { file, problem }
  const [err, setErr] = useState('');
  const camRef = useRef(null); const galRef = useRef(null);
  const pick = async (file) => {
    setErr(''); setPending(null);
    if (!file) return;
    if (!OK_TYPES.includes(file.type)) { setErr(t('This file type is not supported. Use a JPG or PNG photo.')); return; }
    if (file.size > 5 * 1048576) { setPending({ file }); return; } // FR-04: warn and offer to compress
    try { onChange({ data: await compress(file), size: file.size, type: file.type }); } catch { setErr(t('This photo could not be opened. Try another one.')); }
  };
  const useCompressed = async () => {
    try { onChange({ data: await compress(pending.file, 1600, 0.8), size: pending.file.size, type: pending.file.type, compressed: true }); setPending(null); }
    catch { setErr(t('This photo could not be opened. Try another one.')); }
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="m-label">{stepText}</div>
      <h2 style={{ fontSize: '1.25rem' }}>{title}</h2>
      <div className="cam-frame">
        {value ? <img src={value.data} alt={t('Your photo')} /> : <div className="state" style={{ padding: 12 }}><Camera size={36} color="var(--indigo-600)" aria-hidden /><span className="small muted">{t('Place the document inside the frame')}</span></div>}
      </div>
      {!value && !pending && (
        <ul className="small" style={{ margin: 0, paddingInlineStart: 0, listStyle: 'none' }}>
          {[t('Avoid glare'), t('Show all 4 corners'), t('Use good light')].map((x) => <li key={x} className="m-row" style={{ gap: 8 }}><Check size={16} color="var(--green-700)" aria-hidden />{x}</li>)}
        </ul>
      )}
      {pending && (
        <div className="m-card" style={{ background: 'var(--amber-50)', borderColor: '#F5D9A6' }} role="alert">
          <div className="m-row"><AlertTriangle color="var(--amber-700)" aria-hidden /><b>{t('This photo is {s} (max 5 MB)', { s: mb(pending.file.size) })}</b></div>
          <span className="small">{t('We can make it smaller for you.')}</span>
          <div className="m-btns"><Button variant="secondary" onClick={() => { setPending(null); camRef.current?.click(); }}>{t('Retake')}</Button><Button onClick={useCompressed}>{t('Compress and use')}</Button></div>
        </div>
      )}
      {value && <p className="small m-row" style={{ gap: 6 }}><CheckCircle2 size={16} color="var(--green-700)" aria-hidden />{value.compressed ? t('Made smaller · ready to send') : t('Clear photo · {s}', { s: mb(value.size) })}</p>}
      {err && <p className="field-error" role="alert"><AlertTriangle size={16} aria-hidden />{err}</p>}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
      <input ref={galRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
      {value ? (
        <div className="m-btns"><Button variant="secondary" onClick={() => onChange(null)}>{t('Retake')}</Button><Button onClick={onNext}>{t('Next')}</Button></div>
      ) : !pending && (
        <>
          <Button onClick={() => camRef.current?.click()}><Camera size={18} aria-hidden />{t('Take photo')}</Button>
          <Button variant="secondary" onClick={() => galRef.current?.click()}><ImageIcon size={18} aria-hidden />{t('Choose from gallery')}</Button>
        </>
      )}
      {onSkip && !value && <Button variant="text" onClick={onSkip}>{t('I don’t have this certificate – skip')}</Button>}
      <Button variant="text" onClick={onBack}>{t('Cancel')}</Button>
    </div>
  );
}

function CnicDetails({ flow, setFlow, total }) {
  const { t } = useApp();
  const [e, setE] = useState({});
  const d = flow.details;
  const set = (k, v) => setFlow({ ...flow, details: { ...d, [k]: v } });
  const fmtCnic = (v) => { const x = v.replace(/\D/g, '').slice(0, 13); return [x.slice(0, 5), x.slice(5, 12), x.slice(12)].filter(Boolean).join('-'); };
  const next = () => {
    const er = {};
    if (d.fatherName.trim().length < 3) er.fatherName = t('Enter your father’s name as written on the CNIC.');
    if (!d.dob) er.dob = t('Enter your date of birth.');
    else { const age = (Date.now() - new Date(d.dob).getTime()) / (365.25 * 864e5); if (age < 16 || age > 80) er.dob = t('You must be at least 16 years old to work at events.'); }
    if (!/^\d{5}-\d{7}-\d$/.test(d.cnic)) er.cnic = t('Enter the 13-digit CNIC number, e.g. 33100-1234567-1.');
    setE(er);
    if (!Object.keys(er).length) setFlow({ ...flow, step: 0 });
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="progress"><span style={{ width: `${(1 / total) * 100}%` }} /></div>
      <div className="m-label">{t('Step {a} of {b}', { a: 1, b: total })} · {t('CNIC details')}</div>
      <h2 style={{ fontSize: '1.25rem' }}>{t('Type the details from your CNIC')}</h2>
      <p className="small muted">{t('The admin checks these against your photos.')}</p>
      <div className={`field ${e.cnic ? 'has-error' : ''}`}><label htmlFor="cn">{t('CNIC number')}</label>
        <input id="cn" className="input latin" dir="ltr" inputMode="numeric" placeholder="33100-1234567-1" value={d.cnic} aria-invalid={!!e.cnic} onChange={(ev) => set('cnic', fmtCnic(ev.target.value))} />
        {e.cnic && <span className="field-error" role="alert">{e.cnic}</span>}</div>
      <div className={`field ${e.fatherName ? 'has-error' : ''}`}><label htmlFor="fn">{t('Father’s name')}</label>
        <input id="fn" className="input" value={d.fatherName} aria-invalid={!!e.fatherName} onChange={(ev) => set('fatherName', ev.target.value)} />
        {e.fatherName && <span className="field-error" role="alert">{e.fatherName}</span>}</div>
      <div className={`field ${e.dob ? 'has-error' : ''}`}><label htmlFor="db">{t('Date of birth')}</label>
        <input id="db" type="date" className="input latin" value={d.dob} aria-invalid={!!e.dob} onChange={(ev) => set('dob', ev.target.value)} />
        {e.dob && <span className="field-error" role="alert">{e.dob}</span>}</div>
      <Button onClick={next}>{t('Next')}</Button>
      <Button variant="text" onClick={() => setFlow(null)}>{t('Cancel')}</Button>
    </div>
  );
}

function Tracker({ overall }) {
  const { t } = useApp();
  const idx = { not_submitted: 0, rejected: 0, pending: 1, verified: 2 }[overall];
  const steps = [[t('Not submitted'), t('Upload CNIC and certificate')], [t('Pending audit'), t('Usually within 24 hours')], [t('Verified Pro'), t('Badge shown to managers')]];
  return (
    <ol className="track" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label={t('Verification status')}>
      {steps.map(([a, b], i) => (
        <li key={a} className={`track-step ${i < idx || overall === 'verified' ? 'done' : i === idx ? 'current' : ''}`} aria-current={i === idx ? 'step' : undefined}>
          <span className="dot">{i < idx || overall === 'verified' ? <Check size={16} aria-hidden /> : i + 1}</span><span>{a}</span><span className="tiny muted" style={{ fontWeight: 400 }}>{b}</span>
        </li>
      ))}
    </ol>
  );
}

export function Verify() {
  const { t, toast } = useApp();
  const nav = useNavigate();
  const [state, setState] = useState({ loading: true });
  const [flow, setFlow] = useState(null); // { type, step, images: [] }
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const load = () => get('/staff-app/verification').then((d) => setState({ data: d })).catch((e) => setState({ error: e }));
  useEffect(() => { load(); }, []);

  const start = (type) => { setFlow({ type, step: type === 'CNIC' ? -1 : 0, images: [], details: { fatherName: '', dob: '', cnic: '' } }); setErr(''); setDone(false); };
  const need = flow?.type === 'CNIC' ? 2 : 1;
  const submit = async () => {
    setSending(true); setErr('');
    try {
      await post('/staff-app/documents', { docType: flow.type, images: flow.images.map((x) => x.data), ...(flow.type === 'CNIC' ? { details: flow.details } : {}) });
      setDone(true); setFlow(null); load();
      toast(t('Submitted – pending audit'), { kind: 'success' });
    } catch (e) {
      setErr(e.code === 'OFFLINE' ? t('No internet. Your photos are kept here – tap Submit again when you are back online.') : e.message);
    } finally { setSending(false); }
  };

  if (state.error) return <><MTop title={t('Verify')} /><div className="m-content"><ErrorState error={state.error} onRetry={load} /></div></>;
  if (!state.data) return <><MTop title={t('Verify')} /><Loading /></>;
  const d = state.data;

  if (flow) {
    const stepLabels = flow.type === 'CNIC' ? [t('CNIC front'), t('CNIC back')] : [t('{c} certificate', { c: t(flow.type) })];
    const total = need + 1 + (flow.type === 'CNIC' ? 1 : 0);
    const off = flow.type === 'CNIC' ? 2 : 1;
    if (flow.step === -1) return <><MTop title={t('Verify')} /><div className="m-content"><CnicDetails flow={flow} setFlow={setFlow} total={total} /></div></>;
    if (flow.step < need) {
      return (
        <>
          <MTop title={t('Verify')} />
          <div className="m-content">
            <div className="progress" role="progressbar" aria-valuenow={flow.step + 1} aria-valuemin={1} aria-valuemax={total} aria-label={t('Progress')}><span style={{ width: `${((flow.step + off) / total) * 100}%` }} /></div>
            <CaptureStep
              stepText={t('Step {a} of {b}', { a: flow.step + off, b: total }) + ' · ' + stepLabels[flow.step]}
              title={flow.type === 'CNIC' ? (flow.step === 0 ? t('Place CNIC front inside the frame') : t('Now the back of your CNIC')) : t('Photo of your {c} certificate', { c: t(flow.type) })}
              value={flow.images[flow.step]}
              onChange={(v) => { const im = [...flow.images]; im[flow.step] = v; setFlow({ ...flow, images: im }); }}
              onNext={() => setFlow({ ...flow, step: flow.step + 1 })}
              onBack={() => setFlow(null)}
              onSkip={flow.type !== 'CNIC' ? () => setFlow(null) : null}
            />
          </div>
        </>
      );
    }
    return (
      <>
        <MTop title={t('Verify')} />
        <div className="m-content">
          <div className="progress"><span style={{ width: '100%' }} /></div>
          <div className="m-label">{t('Step {a} of {b}', { a: total, b: total })} · {t('Review')}</div>
          <h2 style={{ fontSize: '1.25rem' }}>{t('Check your photos')}</h2>
          <div className="figure-pair" style={need === 1 ? { gridTemplateColumns: '1fr' } : null}>
            {flow.images.map((im, i) => (
              <figure key={i}><img src={im.data} alt={stepLabels[i]} style={{ width: '100%', borderRadius: 8, aspectRatio: 1.58, objectFit: 'cover' }} />
                <figcaption className="m-row small">{stepLabels[i]}<button className="btn btn-text btn-sm" onClick={() => setFlow({ ...flow, step: i })}>{t('Change')}</button></figcaption></figure>
            ))}
          </div>
          {flow.type === 'CNIC' && <p className="small">{flow.details.fatherName} · <span className="latin">{flow.details.cnic}</span> <button className="btn btn-text btn-sm" onClick={() => setFlow({ ...flow, step: -1 })}>{t('Change')}</button></p>}
          <p className="small muted">{t('Only the EventFlow admin team sees these photos. Managers only see your Verified Pro badge.')}</p>
          {err && <p className="field-error" role="alert"><AlertTriangle size={16} aria-hidden />{err}</p>}
          <Button block loading={sending} onClick={submit}>{t('Submit')}</Button>
          <Button variant="text" onClick={() => setFlow({ ...flow, step: need - 1 })}>{t('Back')}</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <MTop title={t('Verify')} />
      <div className="m-content">
        {done ? (
          <div className="state card" role="status">
            <div className="icon-circle green"><CheckCircle2 size={32} aria-hidden /></div>
            <h3>{t('Submitted – Pending audit')}</h3><p className="muted small">{t('Usually within 24 hours. We will send you a notification.')}</p>
            <Button variant="indigo" onClick={() => nav('/staff/shifts')}>{t('See my shifts')}</Button>
          </div>
        ) : (
          <div className="m-card">
            <div className="m-row"><BadgeCheck size={26} color="var(--indigo-600)" aria-hidden /><h2 style={{ fontSize: '1.25rem' }}>{t('Get Verified Pro')}</h2></div>
            <p className="small muted">{t('Managers hire verified staff first.')}</p>
            <Tracker overall={d.overall} />
          </div>
        )}
        {d.docs.filter((x) => x.status === 'rejected').map((x) => (
          <div key={x.type} className="m-card danger" role="alert">
            <div className="m-row"><X color="var(--red-600)" aria-hidden /><b>{t('Rejected')}: {t(x.type)}</b></div>
            {x.rejectReasons.length > 0 && <div className="small"><b>{t('Reason')}:</b> {x.rejectReasons.map((r) => t(r)).join(', ')}</div>}
            {x.rejectMessage && <p className="small">“{x.rejectMessage}”</p>}
            <Button variant="danger" onClick={() => start(x.type)}><RefreshCw size={16} aria-hidden />{t('Re-upload')}</Button>
          </div>
        ))}
        <div className="m-label">{t('Your documents')}</div>
        {d.docs.map((x) => (
          <div key={x.type} className="m-card" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <FileText size={22} className="muted" aria-hidden />
            <div style={{ flex: 1 }}><b>{x.type === 'CNIC' ? t('CNIC (front + back)') : t('{c} certificate', { c: t(x.type) })}</b>
              <div style={{ marginTop: 4 }}><StatusBadge status={x.status} /></div></div>
            {['not_submitted', 'rejected'].includes(x.status) && <Button size="sm" variant={x.type === 'CNIC' ? 'primary' : 'secondary'} onClick={() => start(x.type)}>{x.status === 'rejected' ? t('Re-upload') : t('Upload')}</Button>}
            {x.status === 'pending' && <Clock size={20} color="var(--amber-700)" aria-label={t('Pending audit')} />}
          </div>
        ))}
        {d.overall === 'not_submitted' && <p className="small muted">{t('Start with your CNIC. Certificates are optional but raise your rank.')}</p>}
      </div>
    </>
  );
}

// ---------- S15 Profile & availability ----------
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = ['morning', 'afternoon', 'evening'];

export function StaffProfile() {
  const { t, toast, confirm, logout } = useApp();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const drag = useRef(null);
  const load = () => get('/staff-app/profile').then((d) => { setP(d); setForm({ role: d.role, rate: String(d.rate), city: d.city, availability: d.availability }); setErr(null); }).catch(setErr);
  useEffect(() => { load(); }, []);
  const dirty = p && form && (form.role !== p.role || Number(form.rate) !== p.rate || form.city !== p.city || [...form.availability].sort().join() !== [...p.availability].sort().join());
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !!dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({ title: t('Leave without saving?'), body: t('Your profile changes will be lost.'), ok: t('Leave'), cancel: t('Stay'), danger: true }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm, t]);
  useEffect(() => { const up = () => { drag.current = null; }; window.addEventListener('pointerup', up); return () => window.removeEventListener('pointerup', up); }, []);

  if (err) return <><MTop title={t('Profile')} /><div className="m-content"><ErrorState error={err} onRetry={load} /></div></>;
  if (!p || !form) return <><MTop title={t('Profile')} /><Loading /></>;
  const setCell = (key, on) => setForm((f) => ({ ...f, availability: on ? [...new Set([...f.availability, key])] : f.availability.filter((x) => x !== key) }));
  const save = async () => {
    const e = {};
    const rate = Number(form.rate);
    if (!form.rate || rate < 500) e.rate = t('Rate must be at least Rs 500.');
    else if (rate > 20000) e.rate = t('Rate must be at most Rs 20,000.');
    if (form.city.trim().length < 2) e.city = t('Enter your city.');
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try { await put('/staff-app/profile', { ...form, rate }); toast(t('Profile saved'), { kind: 'success' }); await load(); }
    catch (er) { toast(er.message, { kind: 'error' }); } finally { setSaving(false); }
  };
  return (
    <>
      <MTop title={t('Profile')} />
      <div className="m-content">
        <div className="m-card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Avatar color={p.color} size={96} />
          <h2 style={{ fontSize: '1.375rem' }}>{p.name}</h2>
          {p.verification === 'verified' ? <VerifiedBadge /> : <StatusBadge status={p.verification === 'pending' ? 'pending' : 'not_submitted'} label={p.verification === 'pending' ? t('Pending audit') : t('Not verified')} />}
          <div className="m-row" style={{ gap: 18 }}>
            <span>{t('Rank')} <b className="num">{p.rank}</b></span><span>★ <b className="num">{p.rating.toFixed(1)}</b></span><span><b className="num">{p.jobs}</b> {t('jobs')}</span>
          </div>
        </div>
        <div className="m-card">
          <div className="m-label">{t('Your details')}</div>
          <div className="small muted">{t('Mobile number')}: <span className="latin" dir="ltr">{p.phone}</span></div>
          <div className="field"><label htmlFor="pr-role">{t('Work you do')}</label>
            <select id="pr-role" className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{p.roles.map((r) => <option key={r} value={r}>{t(r)}</option>)}</select></div>
          <div className={`field ${errors.rate ? 'has-error' : ''}`}><label htmlFor="pr-rate">{t('Your rate per shift (Rs)')}</label>
            <input id="pr-rate" className="input latin" inputMode="numeric" value={form.rate} aria-invalid={!!errors.rate} onChange={(e) => setForm({ ...form, rate: e.target.value.replace(/\D/g, '') })} />
            {errors.rate && <span className="field-error" role="alert">{errors.rate}</span>}</div>
          <div className={`field ${errors.city ? 'has-error' : ''}`}><label htmlFor="pr-city">{t('City')}</label>
            <input id="pr-city" className="input" value={form.city} aria-invalid={!!errors.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            {errors.city && <span className="field-error" role="alert">{errors.city}</span>}</div>
        </div>
        <div className="m-card">
          <div className="m-label">{t('When can you work?')}</div>
          <p className="small muted">{t('Tap or drag over the times you are free every week. Blue = available.')}</p>
          <div className="avail" role="group" aria-label={t('Weekly availability')}>
            <span />{SLOTS.map((s) => <span key={s} className="tiny muted" style={{ textAlign: 'center' }}>{t(s[0].toUpperCase() + s.slice(1))}</span>)}
            {DAYS.map((d, di) => (
              <div key={d} style={{ display: 'contents' }}>
                <span className="small" style={{ alignSelf: 'center' }}>{t(d)}</span>
                {SLOTS.map((s) => {
                  const key = `${di}-${s}`; const on = form.availability.includes(key);
                  return (
                    <button key={key} type="button" className="avail-cell" aria-pressed={on} aria-label={`${t(d)} ${t(s[0].toUpperCase() + s.slice(1))}`}
                      onPointerDown={(e) => { e.preventDefault(); drag.current = !on; setCell(key, !on); }}
                      onPointerEnter={() => { if (drag.current !== null) setCell(key, drag.current); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCell(key, !on); } }}>
                      {on ? <Check size={16} aria-hidden /> : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <Button block loading={saving} disabled={!dirty} onClick={save}>{t('Save')}</Button>
        <div className="m-card" style={{ padding: 4 }}>
          <Link to="/staff/settings" className="check-row" style={{ border: 0, textDecoration: 'none', color: 'inherit' }}><SettingsIcon size={20} aria-hidden /><span style={{ flex: 1 }}>{t('Settings & Help')}</span><ChevronRight size={18} className="flip" aria-hidden /></Link>
          <button className="check-row" style={{ border: 0, width: '100%' }} onClick={async () => {
            if (await confirm({ title: t('Log out?'), body: t('You will need your phone number, password and a code to log in again.'), ok: t('Log out') })) { await logout(); nav('/login'); }
          }}><LogOut size={20} className="flip" aria-hidden /><span style={{ flex: 1, textAlign: 'start' }}>{t('Log out')}</span></button>
        </div>
      </div>
    </>
  );
}

export function StaffNotifications() {
  const { t } = useApp();
  return <><MTop title={t('Notifications')} back /><NotificationsPanel inline onClose={() => {}} /></>;
}

export function StaffSettings() {
  const { t } = useApp();
  return <><MTop title={t('Settings & Help')} back /><div className="m-content"><Settings embedded /></div></>;
}
