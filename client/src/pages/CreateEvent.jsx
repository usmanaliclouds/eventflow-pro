import { useEffect, useState } from 'react';
import { Link, useNavigate, useBlocker } from 'react-router-dom';
import { Check, Plus, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useApp } from '../context';
import { post } from '../api';
import { rs, longDate } from '../format';
import { Button, Field, NumberStepper, Stepper } from '../components/ui';

export const ROLES = ['Waiter', 'Security', 'Sound tech', 'Usher', 'Cleaner'];
export const UNIFORMS = ['Black & white formal', 'Black suit', 'Branded polo', 'Shalwar kameez (white)', 'Own clothes'];
const TYPES = ['Wedding', 'Mehndi', 'Walima', 'Corporate', 'Gala dinner', 'Expo', 'Birthday'];
export const DEFAULT_RATES = { Waiter: [1500, 2000], Security: [2000, 2500], 'Sound tech': [2800, 3200], Usher: [1300, 1600], Cleaner: [1000, 1300] };
export const DEFAULT_UNIFORM = { Waiter: 'Black & white formal', Security: 'Black suit', 'Sound tech': 'Own clothes', Usher: 'Branded polo', Cleaner: 'Own clothes' };
const today = () => new Date().toISOString().slice(0, 10);
const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

export function validateRoles(roles, t) {
  const errs = {};
  if (!roles.length) errs._ = t('Add at least one role.');
  const seen = new Set();
  roles.forEach((r, i) => {
    if (seen.has(r.role)) errs[`${i}.role`] = t('Each role can only appear once. Change the count instead.');
    seen.add(r.role);
    if (!r.count || r.count < 1) errs[`${i}.count`] = t('At least 1 person.');
    if (r.count > 200) errs[`${i}.count`] = t('At most 200 people per role.');
    if (!r.rateMin || r.rateMin < 500) errs[`${i}.rate`] = t('Rate must be at least Rs 500.');
    else if (r.rateMax < r.rateMin) errs[`${i}.rate`] = t('The highest rate cannot be lower than the lowest rate.');
  });
  return errs;
}

export function RolesEditor({ roles, setRoles, errors, lockedCounts = {} }) {
  const { t } = useApp();
  const update = (i, patch) => setRoles(roles.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const unused = ROLES.filter((r) => !roles.some((x) => x.role === r));
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr 1.4fr 44px', gap: 12 }} className="small muted" aria-hidden>
        <b>{t('Role')}</b><b>{t('How many')}</b><b>{t('Rate per shift (Rs)')}</b><b>{t('Uniform')}</b><span />
      </div>
      {roles.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr 1.4fr 44px', gap: 12, alignItems: 'start' }}>
          <Field error={errors[`${i}.role`]}>
            {(a) => (
              <select className="select" {...a} aria-label={t('Role')} value={r.role} disabled={!!lockedCounts[r.role]}
                onChange={(e) => update(i, { role: e.target.value, rateMin: DEFAULT_RATES[e.target.value][0], rateMax: DEFAULT_RATES[e.target.value][1], uniform: DEFAULT_UNIFORM[e.target.value] })}>
                {ROLES.map((o) => <option key={o} value={o}>{t(o)}</option>)}
              </select>
            )}
          </Field>
          <Field error={errors[`${i}.count`]} hint={lockedCounts[r.role] ? t('{n} hired', { n: lockedCounts[r.role] }) : null}>
            <NumberStepper value={r.count} min={Math.max(1, lockedCounts[r.role] || 0)} onChange={(v) => update(i, { count: v })} label={t(r.role)} />
          </Field>
          <Field error={errors[`${i}.rate`]}>
            <div className="row" style={{ gap: 6 }}>
              <input className="input latin" inputMode="numeric" aria-label={t('Lowest rate for {r}', { r: t(r.role) })} value={r.rateMin}
                onChange={(e) => update(i, { rateMin: Number(e.target.value.replace(/\D/g, '')) || '' })} />
              <span aria-hidden>–</span>
              <input className="input latin" inputMode="numeric" aria-label={t('Highest rate for {r}', { r: t(r.role) })} value={r.rateMax}
                onChange={(e) => update(i, { rateMax: Number(e.target.value.replace(/\D/g, '')) || '' })} />
            </div>
          </Field>
          <select className="select" aria-label={t('Uniform for {r}', { r: t(r.role) })} value={r.uniform} onChange={(e) => update(i, { uniform: e.target.value })}>
            {UNIFORMS.map((o) => <option key={o} value={o}>{t(o)}</option>)}
          </select>
          <button type="button" className="icon-btn" onClick={() => setRoles(roles.filter((_, k) => k !== i))} disabled={roles.length === 1 || !!lockedCounts[r.role]}
            aria-label={t('Remove {r}', { r: t(r.role) })} title={lockedCounts[r.role] ? t('Drop hired staff first') : undefined}><Trash2 size={18} /></button>
        </div>
      ))}
      {errors._ && <p className="field-error" role="alert">{errors._}</p>}
      {unused.length > 0 && (
        <Button type="button" variant="text" style={{ alignSelf: 'flex-start' }}
          onClick={() => setRoles([...roles, { role: unused[0], count: 1, rateMin: DEFAULT_RATES[unused[0]][0], rateMax: DEFAULT_RATES[unused[0]][1], uniform: DEFAULT_UNIFORM[unused[0]] }])}>
          <Plus size={18} aria-hidden />{t('Add role')}
        </Button>
      )}
    </div>
  );
}

export const estimateOf = (roles) => roles.reduce((a, r) => a + (Number(r.count) || 0) * Math.round(((Number(r.rateMin) || 0) + (Number(r.rateMax) || 0)) / 2), 0);

export default function CreateEvent() {
  const { t, lang, toast, confirm } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [d, setD] = useState({ name: '', type: '', date: '', startTime: '18:00', endTime: '23:00', venue: '', guests: '', budgetCap: '' });
  const [roles, setRoles] = useState([{ role: 'Waiter', count: 10, rateMin: 1500, rateMax: 2000, uniform: 'Black & white formal' }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const dirty = !done && (d.name || d.venue || d.guests || step > 0);

  // "Leave without saving?" dialog (S20 confirm dialog)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({ title: t('Leave without saving?'), body: t('Your event details and staffing plan will be lost.'), ok: t('Leave'), cancel: t('Stay'), danger: true })
      .then((leave) => (leave ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm, t]);
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  useEffect(() => { if (done) nav(`/events/${done}/roster`); }, [done, nav]);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const validate1 = () => {
    const e = {};
    if (d.name.trim().length < 3) e.name = t('Event name must be at least 3 characters.');
    if (!d.type) e.type = t('Pick the type of event.');
    if (!d.date) e.date = t('Pick a date.');
    else if (d.date < today()) e.date = t('The date has already passed. Pick today or a later date.');
    if (!d.startTime) e.startTime = t('Pick a start time.');
    if (!d.endTime) e.endTime = t('Pick an end time.');
    else if (d.startTime && mins(d.endTime) <= mins(d.startTime)) e.endTime = t('End time must be after the start time.');
    if (d.venue.trim().length < 5) e.venue = t('Enter the venue and area, e.g. Grand Marquee, Canal Road.');
    const g = Number(d.guests);
    if (!d.guests || !Number.isInteger(g) || g < 1) e.guests = t('Enter the number of guests.');
    else if (g > 5000) e.guests = t('For more than 5,000 guests, contact support.');
    return e;
  };
  const validate2 = () => {
    const e = validateRoles(roles, t);
    const cap = Number(d.budgetCap);
    if (!d.budgetCap) e.budgetCap = t('Enter your labour budget.');
    else if (cap < 1000) e.budgetCap = t('Budget must be at least Rs 1,000.');
    return e;
  };
  const next = () => {
    const e = step === 0 ? validate1() : validate2();
    setErrors(e);
    if (Object.keys(e).length) {
      const first = document.querySelector('[aria-invalid="true"]');
      first?.focus();
      return;
    }
    setStep(step + 1); window.scrollTo(0, 0);
  };
  const create = async () => {
    setSaving(true);
    try {
      const r = await post('/events', { ...d, guests: Number(d.guests), budgetCap: Number(d.budgetCap), roles: roles.map((x) => ({ ...x, count: Number(x.count) })) });
      setDone(r.id);
      toast(t('{name} created. Now hire your team.', { name: d.name }), { kind: 'success' });
    } catch (err) {
      if (err.body?.fields) { setErrors(err.body.fields); const f = Object.keys(err.body.fields)[0]; setStep(['roles', 'budgetCap'].some((x) => f.startsWith(x)) ? 1 : 0); }
      toast(err.message, { kind: 'error' });
    } finally { setSaving(false); }
  };

  const estimate = estimateOf(roles);
  const totalStaff = roles.reduce((a, r) => a + (Number(r.count) || 0), 0);
  const overBudget = d.budgetCap && estimate > Number(d.budgetCap);
  const minStaff = Math.ceil((Number(d.guests) || 0) / 30);

  return (
    <>
      <nav className="crumbs" aria-label={t('Breadcrumb')}><Link to="/dashboard">{t('Dashboard')}</Link><span aria-hidden>›</span><span aria-current="page">{t('New event')}</span></nav>
      <h1 style={{ marginBottom: 20 }}>{t('Create Event')}</h1>
      <div style={{ maxWidth: 760 }}>
        <Stepper steps={[t('Event details'), t('Staffing plan'), t('Review')]} current={step} />
        <div className="card card-pad" style={{ marginTop: 20 }}>
          {step === 0 && (
            <div className="form-grid">
              <Field label={t('Event name')} error={errors.name} className="full">{(a) => <input className="input" {...a} value={d.name} onChange={set('name')} placeholder={t('e.g. Aslam Wedding')} maxLength={60} />}</Field>
              <Field label={t('Type')} error={errors.type}>
                {(a) => <select className="select" {...a} value={d.type} onChange={set('type')}><option value="">{t('Choose…')}</option>{TYPES.map((o) => <option key={o} value={o}>{t(o)}</option>)}</select>}
              </Field>
              <Field label={t('Date')} error={errors.date}>{(a) => <input type="date" className="input latin" {...a} min={today()} value={d.date} onChange={set('date')} />}</Field>
              <Field label={t('Start time')} error={errors.startTime}>{(a) => <input type="time" className="input latin" {...a} value={d.startTime} onChange={set('startTime')} />}</Field>
              <Field label={t('End time')} error={errors.endTime}>{(a) => <input type="time" className="input latin" {...a} value={d.endTime} onChange={set('endTime')} />}</Field>
              <Field label={t('Venue')} error={errors.venue} className="full">{(a) => <input className="input" {...a} value={d.venue} onChange={set('venue')} placeholder={t('e.g. Grand Marquee, Canal Road, Faisalabad')} />}</Field>
              <Field label={t('Guests')} error={errors.guests} hint={t('Used to suggest how many staff you need')}>
                {(a) => <input className="input latin" inputMode="numeric" {...a} value={d.guests} onChange={(e) => setD({ ...d, guests: e.target.value.replace(/\D/g, '') })} placeholder="300" />}
              </Field>
            </div>
          )}
          {step === 1 && (
            <div className="stack" style={{ gap: 20 }}>
              <h3>{t('Staffing plan')}</h3>
              {d.guests && <p className="small muted">{t('For {g} guests we suggest at least {m} staff (1 per 30 guests). You planned {s}.', { g: d.guests, m: minStaff, s: totalStaff })}</p>}
              <RolesEditor roles={roles} setRoles={setRoles} errors={errors} />
              <div className="form-grid" style={{ alignItems: 'end' }}>
                <Field label={t('Labour budget (Rs)')} error={errors.budgetCap} hint={t('The most you want to spend on staff')}>
                  {(a) => <input className="input latin" inputMode="numeric" {...a} value={d.budgetCap} onChange={(e) => setD({ ...d, budgetCap: e.target.value.replace(/\D/g, '') })} placeholder="32000" />}
                </Field>
                <div className="card" style={{ padding: '12px 16px', background: 'var(--neutral-50)' }}>
                  <div className="small muted">{t('Estimated labour cost')}</div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem' }} className="num">{rs(estimate)}</div>
                </div>
              </div>
              {overBudget && (
                <div className="banner banner-warn" style={{ margin: 0 }} role="status"><AlertTriangle size={20} aria-hidden />
                  <span className="small">{t('The estimate is {x} over your budget. Lower the count or rates, or raise the budget.', { x: rs(estimate - Number(d.budgetCap)) })}</span></div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="stack" style={{ gap: 12 }}>
              <h3>{t('Review')}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
                {[
                  `${d.name} · ${t(d.type)}`,
                  `${longDate(d.date, lang)} · ${d.startTime}–${d.endTime}`,
                  `${d.venue} · ${t('{g} guests', { g: d.guests })}`,
                  roles.map((r) => `${r.count} ${t(r.role)}`).join(' · '),
                  `${t('Estimated labour cost')} ${rs(estimate)} · ${t('Budget')} ${rs(d.budgetCap)}`,
                ].map((line) => <li key={line} className="row" style={{ gap: 10 }}><Check size={18} color="var(--green-700)" aria-hidden />{line}</li>)}
              </ul>
              <div className="row" style={{ marginTop: 8 }}>
                <Button variant="text" size="sm" onClick={() => setStep(0)}>{t('Edit details')}</Button>
                <Button variant="text" size="sm" onClick={() => setStep(1)}>{t('Edit staffing plan')}</Button>
              </div>
            </div>
          )}
        </div>
        <div className="row" style={{ marginTop: 24, justifyContent: 'space-between' }}>
          <Button variant="secondary" onClick={() => (step === 0 ? nav('/dashboard') : setStep(step - 1))}>{t('Back')}</Button>
          {step < 2 ? <Button onClick={next}>{t('Next')}<ArrowRight size={18} className="flip" aria-hidden /></Button>
            : <Button onClick={create} loading={saving}>{t('Create event')}</Button>}
        </div>
      </div>
    </>
  );
}
