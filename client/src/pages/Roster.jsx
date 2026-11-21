import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Minus, Plus, X, CheckCircle2, Star, GripVertical } from 'lucide-react';
import { useApp } from '../context';
import { get, post, put } from '../api';
import { rs, dayLabel } from '../format';
import { Avatar, Button, ErrorState, Loading, Stars, StatusBadge, VerifiedBadge, useLoad } from '../components/ui';
import { useHire, StaffDrawer } from './Marketplace';
import { RolesEditor, validateRoles, estimateOf } from './CreateEvent';

const GROUP = { Waiter: 'Waiters', Security: 'Security', 'Sound tech': 'Tech', Usher: 'Ushers', Cleaner: 'Cleaners' };

function BudgetCard({ b }) {
  const { t } = useApp();
  const over = b.percent >= 100; const warn = b.percent >= b.alertAt;
  return (
    <section className="card card-pad" aria-label={t('Labour budget')} style={{ marginBottom: 24 }}>
      <div className="row wrap" style={{ gap: 24, alignItems: 'flex-end' }}>
        <div>
          <div className="muted">{t('Labour budget')}</div>
          <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700 }} className="num" aria-live="polite">{rs(b.cost)}</span>
            <span className="muted" style={{ fontSize: '1.125rem' }}>{t('of')} {rs(b.cap)}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="row small" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
            {warn && <span className={`badge ${over ? 'badge-red' : 'badge-amber'}`}><AlertTriangle size={14} aria-hidden />{over ? t('Over budget') : t('Near the limit')}</span>}
            <span>{b.left >= 0 ? t('{x} left', { x: rs(b.left) }) : t('{x} over', { x: rs(-b.left) })} · <span className="num">{b.percent}%</span></span>
          </div>
          <div className={`meter ${over ? 'over' : warn ? 'warn' : ''}`} role="meter" aria-label={t('Budget used')} aria-valuenow={b.percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.min(100, b.percent)}%` }} />
            <i className="mark" style={{ insetInlineStart: `${b.alertAt}%` }} aria-hidden />
          </div>
          <div className="tiny muted" style={{ textAlign: 'end', marginTop: 6 }}>{t('Alert at {p}%', { p: b.alertAt })}</div>
        </div>
      </div>
    </section>
  );
}

function MiniMarket({ ev, roles, role, setRole, onHire, busy, onOpen, refreshKey }) {
  const { t } = useApp();
  const [minRank, setMinRank] = useState('7');
  const { data, loading, error, reload } = useLoad(
    () => get(`/staff?eventId=${ev.id}&role=${encodeURIComponent(role)}&verified=1${minRank ? `&minRank=${minRank}` : ''}`),
    [ev.id, role, minRank, refreshKey],
  );
  return (
    <section aria-label={t('Marketplace')}>
      <div className="row" style={{ marginBottom: 10 }}>
        <h3 style={{ flex: 1 }}>{t('Marketplace')}</h3>
        {data && <span className="small muted">{t('{n} available', { n: data.staff.length })}</span>}
      </div>
      <div className="row wrap" style={{ marginBottom: 12, gap: 8 }}>
        <select className="select" style={{ width: 'auto', minHeight: 36 }} aria-label={t('Role')} value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((r) => <option key={r.role} value={r.role}>{t(r.role)} ({r.count - r.filled} {t('open')})</option>)}
        </select>
        {minRank && <span className="chip">{t('Rank')} ≥ {minRank}<button onClick={() => setMinRank('')} aria-label={t('Remove filter {f}', { f: `${t('Rank')} ≥ ${minRank}` })}><X size={16} /></button></span>}
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? <Loading rows={3} /> : data.staff.length === 0 ? (
        <div className="card state" style={{ padding: 24 }}><h3>{t('No one free for this role')}</h3>
          <p className="muted small">{minRank ? t('Remove the rank filter to see more people.') : t('Everyone with this role is booked at this time.')}</p></div>
      ) : (
        <div className="stack" style={{ gap: 10, maxHeight: 620, overflow: 'auto', paddingInlineEnd: 4 }}>
          {data.staff.map((s) => (
            <article key={s.id} className="card mini-card" draggable aria-label={s.name}
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ id: s.id, name: s.name, role: s.role })); e.dataTransfer.effectAllowed = 'copy'; }}>
              <div className="row" style={{ gap: 12 }}>
                <GripVertical size={16} className="muted" aria-hidden />
                <Avatar color={s.color} size={44} />
                <div style={{ flex: 1 }}>
                  <button className="btn-text" style={{ border: 0, background: 'none', padding: 0, fontWeight: 600, fontSize: '1.0625rem', cursor: 'pointer', color: 'inherit' }} onClick={() => onOpen(s.id)}>{s.name}</button>
                  <div className="small muted row" style={{ gap: 6 }}>{t(s.role)} · {t('Rank')} {s.rank} · <Stars value={s.rating} size={14} /></div>
                </div>
              </div>
              <div className="row">
                <VerifiedBadge small />
                <b className="num">{rs(s.rate)}</b>
                <span className="spacer" />
                <Button variant="secondary" size="sm" loading={busy === s.id} onClick={() => onHire(s)}>{t('Hire')}</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Roster() {
  const { id } = useParams();
  const { t, lang, toast, confirm } = useApp();
  const nav = useNavigate();
  const { data, loading, error, reload, setData } = useLoad(() => get(`/events/${id}`), [id]);
  const [tab, setTab] = useState('roster');
  const [role, setRole] = useState('');
  const [dragOver, setDragOver] = useState(null);
  const [busyDrop, setBusyDrop] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [openStaff, setOpenStaff] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const marketRef = useRef(null);
  const apply = (d) => { setData((old) => ({ ...old, ...pick(d) })); setRefreshKey((k) => k + 1); };
  const pick = (d) => ({ event: d.event, roles: d.roles, budget: d.budget, totalSlots: d.totalSlots, staffCount: d.staffCount, unfilled: d.unfilled, conflicts: d.conflicts, confirmed: d.confirmed, minStaff: d.minStaff, estimate: d.estimate });
  const { hire, busy, conflictDialog } = useHire(apply);

  useEffect(() => {
    if (data && !role) setRole((data.roles.find((r) => r.count > r.filled) || data.roles[0])?.role || '');
  }, [data, role]);

  if (error) return <ErrorState error={error} onRetry={reload} title={t('Couldn’t load this roster')} />;
  if (loading && !data) return <Loading label={t('Loading roster…')} />;
  const ev = data.event;
  const closed = ev.status === 'completed' || ev.status === 'reviewed';

  const drop = async (p, confirmRatio = false) => {
    setBusyDrop(p.bookingId);
    try {
      const r = await post(`/bookings/${p.bookingId}/drop`, { confirmRatio });
      apply(r);
      const short = `${p.name.split(' ')[0]} ${p.name.split(' ')[1]?.[0] || ''}.`;
      toast(t('{n} dropped · {r} saved', { n: short, r: rs(r.saved) }), {
        onUndo: async () => {
          try { apply(await post(`/bookings/${p.bookingId}/undo`)); toast(t('{n} is back on the roster.', { n: p.name }), { kind: 'success' }); }
          catch (e) { toast(e.message, { kind: 'error' }); }
        },
      });
    } catch (e) {
      if (e.code === 'RATIO_WARNING') {
        if (await confirm({ title: t('Too few staff for the guests?'), body: e.message, ok: t('Drop anyway'), cancel: t('Keep {n}', { n: p.name.split(' ')[0] }), danger: true })) {
          setBusyDrop(null); return drop(p, true);
        }
      } else toast(e.message, { kind: 'error' });
    } finally { setBusyDrop(null); }
    return null;
  };

  const replace = async (p, alt) => {
    try {
      const d1 = await post(`/bookings/${p.bookingId}/drop`, { confirmRatio: true });
      apply(d1);
      const r = await hire(ev.id, alt);
      if (r) toast(t('{a} replaced {b}.', { a: alt.name, b: p.name }), { kind: 'success' });
    } catch (e) { toast(e.message, { kind: 'error' }); }
  };

  const confirmRoster = async (allowUnfilled = false) => {
    setConfirming(true);
    try {
      apply(await post(`/events/${ev.id}/confirm`, { allowUnfilled }));
      toast(t('Roster confirmed. Invited staff got a reminder.'), { kind: 'success' });
    } catch (e) {
      if (e.code === 'UNFILLED') {
        if (await confirm({ title: t('Confirm with empty slots?'), body: e.message, ok: t('Confirm anyway'), cancel: t('Keep hiring') })) { setConfirming(false); return confirmRoster(true); }
      } else toast(e.message, { kind: 'error' });
    } finally { setConfirming(false); }
    return null;
  };

  const onDrop = (e, roleName) => {
    e.preventDefault(); setDragOver(null);
    try {
      const s = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (s.role !== roleName) { toast(t('{n} works as {r}. Drop them on a {r} slot.', { n: s.name, r: t(s.role).toLowerCase() }), { kind: 'error' }); return; }
      hire(ev.id, s);
    } catch { /* not our card */ }
  };

  return (
    <>
      <nav className="crumbs" aria-label={t('Breadcrumb')}>
        <Link to="/dashboard">{t('Dashboard')}</Link><span aria-hidden>›</span><span>{ev.name}</span><span aria-hidden>›</span><span aria-current="page">{t('Roster')}</span>
      </nav>
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: '1.75rem' }}>{ev.name}</h1>
          <div className="muted">{dayLabel(ev.date, lang)} · <span className="latin" dir="ltr">{ev.start_time}–{ev.end_time}</span> · {ev.venue} · {t('{g} guests', { g: ev.guests })}</div>
        </div>
        <span className="spacer" />
        {ev.status === 'confirmed' && <StatusBadge status="confirmed" label={t('Roster confirmed')} />}
        {!closed && <Button variant="text" onClick={() => setTab('plan')}>{t('Edit plan')}</Button>}
        {!closed && <Button onClick={() => confirmRoster()} loading={confirming} disabled={ev.status === 'confirmed' && data.unfilled === 0 && !data.conflicts}>{t('Confirm roster')}</Button>}
        {closed && <Button onClick={() => nav(`/events/${ev.id}/review`)}><Star size={18} aria-hidden />{t('Review staff')}</Button>}
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'roster'} onClick={() => setTab('roster')}>{t('Roster & Budget')}</button>
        <button role="tab" aria-selected={tab === 'plan'} onClick={() => setTab('plan')} disabled={closed}>{t('Staffing plan')}</button>
      </div>

      {tab === 'plan' ? <PlanTab data={data} onSaved={(d) => { apply(d); setTab('roster'); }} /> : (
        <>
          <BudgetCard b={data.budget} />
          {data.conflicts > 0 && (
            <div className="banner banner-warn" role="alert"><AlertTriangle size={22} aria-hidden />
              <span>{t('{c} worker is booked elsewhere at the same time. Replace them with one of the suggestions below.', { c: data.conflicts })}</span></div>
          )}
          {closed && <div className="banner banner-info"><CheckCircle2 size={20} color="var(--green-700)" aria-hidden /><span>{t('This event has finished. The roster is read-only.')}</span></div>}
          <div className="roster" style={closed ? { gridTemplateColumns: '1fr' } : null}>
            {!closed && (
              <div ref={marketRef}>
                {role && <MiniMarket ev={ev} roles={data.roles} role={role} setRole={setRole} busy={busy} refreshKey={refreshKey}
                  onOpen={setOpenStaff} onHire={(s) => hire(ev.id, s)} />}
              </div>
            )}
            <div className="stack" style={{ gap: 22 }}>
              {data.roles.map((r) => (
                <section key={r.role} aria-label={t(r.role)}>
                  <div className="row" style={{ marginBottom: 10 }}>
                    <h3 style={{ flex: 1 }}>{t(GROUP[r.role] || r.role)}</h3>
                    <span className="small muted num">{r.filled} / {r.count} · {t(r.uniform)}</span>
                  </div>
                  <div className="stack" style={{ gap: 8 }}>
                    {r.people.map((p) => (
                      <div key={p.bookingId}>
                        <div className={`card slot ${p.conflict ? 'conflict' : ''}`}>
                          <Avatar color={p.color} size={40} />
                          <div style={{ flex: 1 }}>
                            <button onClick={() => setOpenStaff(p.staffId)} style={{ border: 0, background: 'none', padding: 0, fontWeight: 600, fontSize: '1.0625rem', cursor: 'pointer' }}>{p.name}</button>
                            <div className="small muted">{t(p.role)} · {rs(p.rate)}</div>
                          </div>
                          {p.conflict ? <StatusBadge status="conflict" /> : <StatusBadge status={p.status} />}
                          {!closed && (
                            <Button variant="text" size="sm" loading={busyDrop === p.bookingId} onClick={() => drop(p)} aria-label={t('Drop {n}', { n: p.name })}>
                              <Minus size={16} aria-hidden />{t('Drop')}
                            </Button>
                          )}
                        </div>
                        {p.conflict && !closed && (
                          <div className="card" style={{ marginTop: 6, padding: '12px 16px', borderColor: 'var(--marigold-500)' }}>
                            <p className="small" style={{ marginBottom: 8 }}>{p.conflict.with ? t('{n} confirmed another event ({e}) at this time. Pick one of these instead:', { n: p.name.split(' ')[0], e: p.conflict.with }) : t('{n} confirmed a shift with another company at this time. Pick one of these instead:', { n: p.name.split(' ')[0] })}</p>
                            {p.conflict.alternatives.length === 0 ? <p className="small muted">{t('No one else with this role is free. Drop {n} and widen the search.', { n: p.name.split(' ')[0] })}</p>
                              : p.conflict.alternatives.map((a) => (
                                <div key={a.id} className="row" style={{ padding: '6px 0' }}>
                                  <Avatar color={a.color} size={32} />
                                  <span style={{ flex: 1 }}><b>{a.name}</b> <span className="small muted">· {t('Rank')} {a.rank} · {rs(a.rate)}</span></span>
                                  <Button size="sm" variant="secondary" loading={busy === a.id} onClick={() => replace(p, a)}>{t('Replace')}</Button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {!closed && Array.from({ length: Math.max(0, r.count - r.filled) }).slice(0, 3).map((_, i) => (
                      <button key={i} className={`slot-empty ${dragOver === `${r.role}${i}` ? 'drag-over' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(`${r.role}${i}`); }} onDragLeave={() => setDragOver(null)} onDrop={(e) => onDrop(e, r.role)}
                        onClick={() => { setRole(r.role); marketRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>
                        <Plus size={18} aria-hidden />{t('Empty slot – drag staff here or click Hire')}
                      </button>
                    ))}
                    {!closed && r.count - r.filled > 3 && <p className="small muted">{t('+ {n} more empty {r} slots', { n: r.count - r.filled - 3, r: t(r.role).toLowerCase() })}</p>}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}
      {openStaff && <StaffDrawer staffId={openStaff} eventId={ev.id} eventName={ev.name} hiring={busy === openStaff}
        onClose={() => setOpenStaff(null)} onHire={closed ? null : async (p) => { const r = await hire(ev.id, p); if (r) setOpenStaff(null); }} />}
      {conflictDialog}
    </>
  );
}

function PlanTab({ data, onSaved }) {
  const { t, toast } = useApp();
  const [roles, setRoles] = useState(data.roles.map((r) => ({ role: r.role, count: r.count, rateMin: r.rate_min, rateMax: r.rate_max, uniform: r.uniform })));
  const [cap, setCap] = useState(String(data.budget.cap));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const locked = Object.fromEntries(data.roles.map((r) => [r.role, r.filled]));
  const save = async () => {
    const e = validateRoles(roles, t);
    if (!cap || Number(cap) < 1000) e.budgetCap = t('Budget must be at least Rs 1,000.');
    else if (Number(cap) < data.budget.cost) e.budgetCap = t('Budget cannot be lower than what you already spent ({x}).', { x: rs(data.budget.cost) });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try { onSaved(await put(`/events/${data.event.id}/plan`, { roles: roles.map((r) => ({ ...r, count: Number(r.count) })), budgetCap: Number(cap) })); toast(t('Staffing plan saved.'), { kind: 'success' }); }
    catch (err) { toast(err.message, { kind: 'error' }); }
    finally { setSaving(false); }
  };
  return (
    <div className="card card-pad stack" style={{ maxWidth: 820, gap: 20 }}>
      <RolesEditor roles={roles} setRoles={setRoles} errors={errors} lockedCounts={locked} />
      <div className="form-grid" style={{ alignItems: 'end' }}>
        <div className={`field ${errors.budgetCap ? 'has-error' : ''}`}>
          <label htmlFor="cap">{t('Labour budget (Rs)')}</label>
          <input id="cap" className="input latin" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))} aria-invalid={!!errors.budgetCap} />
          {errors.budgetCap && <span className="field-error" role="alert">{errors.budgetCap}</span>}
        </div>
        <div className="small muted">{t('Estimated labour cost')}: <b className="num">{rs(estimateOf(roles))}</b> · {t('Already hired')}: <b className="num">{rs(data.budget.cost)}</b></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><Button onClick={save} loading={saving}>{t('Save plan')}</Button></div>
    </div>
  );
}
