import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { X, SlidersHorizontal, LayoutGrid, List, SearchX, AlertTriangle, FileText, Clock } from 'lucide-react';
import { useApp } from '../context';
import { get, post } from '../api';
import { rs, dayLabel } from '../format';
import { Avatar, Button, Drawer, EmptyState, ErrorState, Loading, Stars, StatusBadge, VerifiedBadge, useLoad } from '../components/ui';
import { ROLES } from './CreateEvent';

// ---------- S8 Staff profile drawer ----------
export function StaffDrawer({ staffId, eventId, eventName, onClose, onHire, hiring }) {
  const { t } = useApp();
  const { data: p, loading, error, reload } = useLoad(() => get(`/staff/${staffId}${eventId ? `?eventId=${eventId}` : ''}`), [staffId, eventId]);
  const parts = p && [
    [t('Rating'), `${p.rating.toFixed(1)} / 5`, p.parts.rating],
    [t('Jobs completed'), p.jobs, p.parts.jobs],
    [t('Certifications'), p.certs.length, p.parts.certs],
    [t('Time active'), t('{y} yrs {m} mo', { y: p.years, m: p.months }), p.parts.time],
  ];
  const foot = p && onHire && (
    p.bookedElsewhere ? <p className="field-error"><AlertTriangle size={16} aria-hidden />{t('Booked elsewhere {s}–{e} on this day. Pick someone else.', { s: p.bookedElsewhere.start, e: p.bookedElsewhere.end })}</p>
      : !p.verified ? <p className="field-error">{t('Not verified yet. Only Verified Pro staff can be hired.')}</p>
        : eventId ? <Button block loading={hiring} onClick={() => onHire(p)}>{t('Hire for {e}', { e: eventName })} · {rs(p.rate)}</Button>
          : <p className="muted small">{t('Choose an event at the top of the page to hire.')}</p>
  );
  return (
    <Drawer onClose={onClose} label={p ? p.name : t('Staff profile')} foot={foot}>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {p && (
        <div className="stack" style={{ gap: 24 }}>
          <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
            <Avatar color={p.color} size={88} />
            <div style={{ flex: 1 }}>
              <h2 style={{ fontWeight: 600 }}>{p.name}</h2>
              <div className="muted">{t(p.role)} · {t('{y} yrs {m} mo', { y: p.years, m: p.months })}</div>
              <div style={{ marginTop: 6 }}>{p.verified ? <VerifiedBadge small /> : <StatusBadge status="not_submitted" label={t('Not verified')} />}</div>
            </div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1.75rem', fontWeight: 700 }} className="num">{p.rank}</div><div className="small muted">{t('Rank')}</div></div>
          </div>
          {p.bookedElsewhere && (
            <div className="banner banner-warn" style={{ margin: 0 }}><AlertTriangle size={20} aria-hidden />
              <span className="small"><b>{t('Booked elsewhere')}</b> · {p.bookedElsewhere.event} <span className="latin" dir="ltr">{p.bookedElsewhere.start}–{p.bookedElsewhere.end}</span></span></div>
          )}
          <section>
            <h3 style={{ marginBottom: 12 }}>{t('How this rank is made')}</h3>
            <div className="stack" style={{ gap: 14 }}>
              {parts.map(([label, val, frac]) => (
                <div key={label}>
                  <div className="row small" style={{ justifyContent: 'space-between' }}><span className="muted">{label}</span><b className="num">{val}</b></div>
                  <div className="rank-bar" style={{ marginTop: 4 }} role="progressbar" aria-label={label} aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${frac * 100}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>{t('Rank = rating (40%) + jobs (30%) + certificates (20%) + time (10%).')}</p>
          </section>
          <section>
            <h3 style={{ marginBottom: 8 }}>{t('Credentials')}</h3>
            {p.credentials.map((c) => (
              <div key={c.type} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <FileText size={18} aria-hidden className="muted" />
                <span style={{ flex: 1 }}>{c.type === 'CNIC' ? t('CNIC – image hidden for privacy') : t('{c} certificate', { c: t(c.type) })}</span>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </section>
          <section>
            <h3 style={{ marginBottom: 8 }}>{t('Recent reviews')}</h3>
            {p.reviews.length === 0 ? <p className="muted small">{t('No reviews yet.')}</p> : p.reviews.map((r, i) => (
              <div key={i} style={{ padding: '8px 0' }}>
                <div className="row small"><span aria-label={t('{n} out of 5 stars', { n: r.stars })} style={{ color: 'var(--marigold-600)', letterSpacing: 2 }}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span><span className="muted">{r.author}</span></div>
                <p className="small">“{r.comment}”</p>
              </div>
            ))}
          </section>
        </div>
      )}
    </Drawer>
  );
}

// Shared hire action with conflict + undo handling, used by S7 and S9
export function useHire(onChanged) {
  const { t, toast } = useApp();
  const [busy, setBusy] = useState(null);
  const [conflict, setConflict] = useState(null);
  const hire = async (eventId, staff) => {
    setBusy(staff.id);
    try {
      const r = await post(`/events/${eventId}/bookings`, { staffId: staff.id });
      onChanged?.(r);
      toast(
        r.budgetAlert
          ? t('{n} invited · {r}. Budget is {p}% used.', { n: r.name, r: rs(r.rate), p: r.budget.percent })
          : t('{n} invited · {r}', { n: r.name, r: rs(r.rate) }),
        {
          kind: 'success',
          onUndo: async () => {
            try { const u = await post(`/bookings/${r.bookingId}/drop`, { confirmRatio: true }); onChanged?.(u); toast(t('Hire undone. {n} was removed.', { n: r.name })); }
            catch (e) { toast(e.message, { kind: 'error' }); }
          },
        },
      );
      return r;
    } catch (e) {
      if (e.code === 'CONFLICT') setConflict({ name: staff.name, message: e.message, alternatives: e.body.alternatives || [], eventId });
      else toast(e.message, { kind: 'error' });
      return null;
    } finally { setBusy(null); }
  };
  const conflictDialog = conflict && (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setConflict(null)}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" style={{ width: 'min(560px, 100vw - 32px)' }}>
        <div className="row"><AlertTriangle color="var(--amber-700)" aria-hidden /><h2 id="cf-t" style={{ flex: 1 }}>{t('Can’t hire {n}', { n: conflict.name })}</h2>
          <button className="icon-btn" onClick={() => setConflict(null)} aria-label={t('Close')}><X size={20} /></button></div>
        <p className="muted">{conflict.message}</p>
        {conflict.alternatives.length > 0 && <h3 style={{ margin: '16px 0 8px' }}>{t('Available instead')}</h3>}
        {conflict.alternatives.map((a) => (
          <div key={a.id} className="row" style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
            <Avatar color={a.color} size={36} />
            <div style={{ flex: 1 }}><b>{a.name}</b><div className="small muted">{t('Rank {r}', { r: a.rank })} · {rs(a.rate)}</div></div>
            <Button size="sm" variant="secondary" loading={busy === a.id} onClick={async () => { const ok = await hire(conflict.eventId, a); if (ok) setConflict(null); }}>{t('Hire')}</Button>
          </div>
        ))}
      </div>
    </div>
  );
  return { hire, busy, conflictDialog };
}

export default function Marketplace() {
  const { t, lang } = useApp();
  const [sp, setSp] = useSearchParams();
  const [view, setView] = useState(() => { try { return localStorage.getItem('ef_view') || 'grid'; } catch { return 'grid'; } });
  const [showMore, setShowMore] = useState(false);
  const events = useLoad(() => get('/events'), []);
  const eventId = sp.get('eventId') || (events.data?.events[0]?.id ? String(events.data.events[0].id) : '');
  const f = {
    role: sp.get('role') ?? 'Waiter', minRank: sp.get('minRank') ?? '7', maxRate: sp.get('maxRate') ?? '', cert: sp.get('cert') ?? '',
    verified: sp.get('verified') ?? '1', sort: sp.get('sort') || 'rank', q: sp.get('q') || '',
  };
  const setF = (patch) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => n.set(k, v)); setSp(n, { replace: true }); };
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (eventId) p.set('eventId', eventId);
    for (const k of ['role', 'minRank', 'maxRate', 'cert', 'q']) if (f[k]) p.set(k, f[k]);
    p.set('verified', f.verified); p.set('sort', f.sort);
    return p.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, f.role, f.minRank, f.maxRate, f.cert, f.q, f.verified, f.sort]);
  const ready = events.data || events.error;
  const { data, loading, error, reload } = useLoad(() => (ready ? get(`/staff?${query}`) : new Promise(() => {})), [query, !!ready]);
  const { hire, busy, conflictDialog } = useHire(() => reload());
  const openId = sp.get('staff');
  useEffect(() => { try { localStorage.setItem('ef_view', view); } catch { /* */ } }, [view]);

  const chips = [
    f.role && { k: 'role', label: t(f.role) },
    f.minRank && { k: 'minRank', label: `${t('Rank')} ≥ ${f.minRank}` },
    f.maxRate && { k: 'maxRate', label: `≤ ${rs(f.maxRate)}` },
    f.cert && { k: 'cert', label: t(f.cert) },
    f.verified === '1' && { k: 'verified', label: t('Verified Pro only'), off: '0' },
    f.q && { k: 'q', label: `“${f.q}”` },
  ].filter(Boolean);
  const ev = data?.event;
  const evName = events.data?.events.find((e) => String(e.id) === eventId)?.name;
  const clearAll = () => setSp(new URLSearchParams({ role: '', minRank: '', maxRate: '', cert: '', verified: '0', q: '', ...(eventId ? { eventId } : {}) }), { replace: true });

  return (
    <>
      <div className="row wrap" style={{ marginBottom: 6 }}>
        <label htmlFor="ev-pick" className="muted">{t('Hiring for')}:</label>
        <select id="ev-pick" className="select" style={{ width: 'auto', minWidth: 260, fontWeight: 600 }} value={eventId}
          onChange={(e) => setF({ eventId: e.target.value })}>
          {events.data?.events.map((e) => <option key={e.id} value={e.id}>{e.name} · {dayLabel(e.date, lang)}</option>)}
          <option value="">{t('No event – just browsing')}</option>
        </select>
      </div>
      <div className="page-head">
        <h1>{t('Talent Marketplace')}</h1>
        <span className="spacer" />
        {ev && <Link className="btn btn-text" to={`/events/${ev.id}/roster`}>{t('Open roster')}</Link>}
      </div>

      <div className="row wrap" style={{ marginBottom: 12 }} aria-label={t('Active filters')}>
        {chips.map((c) => (
          <span key={c.k} className="chip">{c.label}
            <button onClick={() => setF({ [c.k]: c.off ?? '' })} aria-label={t('Remove filter {f}', { f: c.label })}><X size={16} /></button></span>
        ))}
        <button className="chip chip-outline" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}><SlidersHorizontal size={16} aria-hidden />{t('More filters')}</button>
        {chips.length > 0 && <button className="btn btn-text btn-sm" onClick={clearAll}>{t('Clear all')}</button>}
        <span className="spacer" />
        <label className="small muted" htmlFor="sort">{t('Sort')}:</label>
        <select id="sort" className="select" style={{ width: 'auto' }} value={f.sort} onChange={(e) => setF({ sort: e.target.value })}>
          <option value="rank">{t('Best rank')}</option><option value="rating">{t('Highest rating')}</option>
          <option value="rate_asc">{t('Lowest rate')}</option><option value="rate_desc">{t('Highest rate')}</option>
        </select>
        <div className="seg" role="group" aria-label={t('View')}>
          <button aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={16} aria-hidden />{t('Grid')}</button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} aria-hidden />{t('List')}</button>
        </div>
      </div>
      {showMore && (
        <div className="card card-pad form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
          <div className="field"><label htmlFor="f-role">{t('Role')}</label>
            <select id="f-role" className="select" value={f.role} onChange={(e) => setF({ role: e.target.value })}><option value="">{t('Any role')}</option>{ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}</select></div>
          <div className="field"><label htmlFor="f-rank">{t('Minimum rank')}</label>
            <select id="f-rank" className="select" value={f.minRank} onChange={(e) => setF({ minRank: e.target.value })}><option value="">{t('Any')}</option>{[5, 6, 7, 8, 9].map((r) => <option key={r} value={r}>≥ {r}</option>)}</select></div>
          <div className="field"><label htmlFor="f-rate">{t('Max rate per shift')}</label>
            <select id="f-rate" className="select" value={f.maxRate} onChange={(e) => setF({ maxRate: e.target.value })}><option value="">{t('Any')}</option>{[1500, 1800, 2000, 2500, 3000].map((r) => <option key={r} value={r}>≤ {rs(r)}</option>)}</select></div>
          <div className="field"><label htmlFor="f-cert">{t('Certificate')}</label>
            <select id="f-cert" className="select" value={f.cert} onChange={(e) => setF({ cert: e.target.value })}><option value="">{t('Any')}</option><option value="Food Safety">{t('Food Safety')}</option><option value="First Aid">{t('First Aid')}</option></select></div>
        </div>
      )}

      {data && (
        <p className="muted" style={{ marginBottom: 16 }} role="status">
          {t('{n} staff available', { n: data.staff.length })}{ev ? <> · {dayLabel(ev.date, lang)}, <span className="latin" dir="ltr">{ev.start}–{ev.end}</span></> : null}
          {data.hiddenBooked > 0 && <> · <Clock size={14} aria-hidden style={{ verticalAlign: -2 }} /> {t('{h} hidden because they are booked at this time', { h: data.hiddenBooked })}</>}
        </p>
      )}

      {error ? <ErrorState error={error} onRetry={reload} title={t('Couldn’t load staff')} />
        : loading || !data ? <Loading rows={4} />
          : data.staff.length === 0 ? (
            <EmptyState icon={SearchX} title={t('No staff match these filters')} body={t('Try removing a filter, for example the rank or the rate limit.')}
              action={<Button variant="secondary" onClick={clearAll}>{t('Clear all filters')}</Button>} />
          ) : view === 'grid' ? (
            <div className="staff-grid">
              {data.staff.map((s) => (
                <article key={s.id} className="card staff-card" aria-label={s.name}>
                  <div className="row" style={{ gap: 14 }}>
                    <Avatar color={s.color} size={64} />
                    <div><div className="name">{s.name}</div><div className="muted">{t(s.role)} · {t('{y} yrs', { y: s.years })}</div></div>
                  </div>
                  <div>{s.verified ? <VerifiedBadge /> : <StatusBadge status="not_submitted" label={t('Not verified')} />}</div>
                  <div className="row" style={{ gap: 14 }}><span>{t('Rank')} <b className="num">{s.rank}</b></span><Stars value={s.rating} /><span className="muted small num">({s.ratingCount})</span></div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{rs(s.rate)} <span className="muted small" style={{ fontWeight: 400 }}>/ {t('shift')}</span></div>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <Button variant="text" onClick={() => setF({ staff: s.id })}>{t('View profile')}</Button>
                    <Button variant="secondary" disabled={!eventId || !s.verified} loading={busy === s.id} onClick={() => hire(eventId, s)} title={!eventId ? t('Choose an event first') : undefined}>{t('Hire')}</Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {data.staff.map((s) => (
                <article key={s.id} className="card staff-row" aria-label={s.name}>
                  <div className="row"><Avatar color={s.color} size={40} /><div><b>{s.name}</b><div className="small muted">{t(s.role)} · {t('{y} yrs', { y: s.years })}</div></div></div>
                  <div>{s.verified ? <VerifiedBadge small /> : <StatusBadge status="not_submitted" label={t('Not verified')} />}</div>
                  <span className="small">{t('Rank')} <b className="num">{s.rank}</b></span>
                  <Stars value={s.rating} size={16} />
                  <b className="num">{rs(s.rate)}</b>
                  <div className="row" style={{ gap: 4 }}>
                    <Button variant="text" size="sm" onClick={() => setF({ staff: s.id })}>{t('Profile')}</Button>
                    <Button variant="secondary" size="sm" disabled={!eventId || !s.verified} loading={busy === s.id} onClick={() => hire(eventId, s)}>{t('Hire')}</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
      {openId && (
        <StaffDrawer staffId={openId} eventId={eventId} eventName={evName} hiring={busy === Number(openId)}
          onClose={() => { const n = new URLSearchParams(sp); n.delete('staff'); setSp(n, { replace: true }); }}
          onHire={async (p) => { const r = await hire(eventId, p); if (r) { const n = new URLSearchParams(sp); n.delete('staff'); setSp(n, { replace: true }); } }} />
      )}
      {conflictDialog}
    </>
  );
}
