import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarPlus, Check, MapPin, Users, CalendarDays } from 'lucide-react';
import { useApp } from '../context';
import { get } from '../api';
import { rs, lakh, dayLabel, dayNum, monShort, daysUntil } from '../format';
import { Button, EmptyState, ErrorState, useLoad, StatusBadge } from '../components/ui';

function greeting(t) {
  const h = new Date().getHours();
  return h < 12 ? t('Good morning') : h < 17 ? t('Good afternoon') : t('Good evening');
}

export default function Dashboard() {
  const { t, lang } = useApp();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLoad(() => get('/dashboard'), []);

  if (error) return <ErrorState error={error} onRetry={reload} title={t('Couldn’t load your dashboard')} />;
  if (loading && !data) {
    return (
      <div className="stack" aria-busy="true" aria-label={t('Loading…')}>
        <div className="skeleton" style={{ height: 40, width: 320 }} />
        <div className="skeleton" style={{ height: 76 }} />
        <div className="grid-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div>
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    );
  }
  const k = data.kpis;
  const head = (
    <div className="page-head">
      <h1>{greeting(t)} {data.name}</h1>
      <span className="spacer" />
      {data.upcoming.length > 0 && <Button onClick={() => nav('/events/new')}><CalendarPlus size={20} aria-hidden />{t('Create Event')}</Button>}
    </div>
  );
  if (data.upcoming.length === 0 && data.needsReview.length === 0) {
    return (
      <>
        {head}
        <div style={{ maxWidth: 520, margin: '80px auto' }}>
          <EmptyState icon={CalendarDays} title={t('No events yet')} body={t('Create your first event to start hiring.')}
            action={<Button onClick={() => nav('/events/new')}>{t('Create Event')}</Button>} />
        </div>
      </>
    );
  }
  const a = data.alert;
  return (
    <>
      {head}
      {a && (
        <div className="banner banner-warn" role="status">
          <AlertTriangle size={24} aria-hidden />
          <div style={{ flex: 1 }}>
            <b>{a.name} ({dayLabel(a.date, lang)}): {a.unfilled > 0 ? t('{u} of {n} slots unfilled', { u: a.unfilled, n: a.total }) : ''}{a.unfilled > 0 && a.conflicts > 0 ? ' · ' : ''}{a.conflicts > 0 ? t('{c} conflict', { c: a.conflicts }) : ''}</b>
            <p className="small">{t('Fill them now so your team is confirmed 48 hours before the event.')}</p>
          </div>
          <Button variant="secondary" onClick={() => nav(`/events/${a.eventId}/roster`)}>{t('Fill now')}</Button>
        </div>
      )}
      <section className="grid-4" aria-label={t('Summary')}>
        <div className="card kpi"><div className="label">{t('Upcoming events')}</div><div className="value num">{k.upcoming}</div></div>
        <div className="card kpi"><div className="label">{t('Staff confirmed')}</div><div className="value num latin" dir="ltr">{k.staffConfirmed} / {k.staffNeeded}</div>
          <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${k.staffNeeded ? (k.staffConfirmed / k.staffNeeded) * 100 : 0}%` }} /></div></div>
        <div className="card kpi"><div className="label">{t('Budget used')}</div><div className="value num">{lakh(k.budgetUsed)}</div>
          <div className="sub">{t('of {x} planned', { x: lakh(k.budgetCap) })}</div></div>
        <div className="card kpi"><div className="label">{t('% saved')}</div><div className="value num">{k.percentSaved}%</div>
          <div className="sub"><Link to="/analytics">{t('See savings')}</Link></div></div>
      </section>

      <h2 style={{ margin: '32px 0 14px' }}>{t('Upcoming events')}</h2>
      {data.upcoming.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t('No upcoming events')} body={t('Create an event to start hiring.')} action={<Button onClick={() => nav('/events/new')}>{t('Create Event')}</Button>} />
      ) : (
        <div className="card" role="list">
          {data.upcoming.map((e, i) => {
            const d = daysUntil(e.date);
            return (
              <div role="listitem" key={e.id} className="event-row" style={{ borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
                <div className="date-tile latin" aria-hidden><b>{dayNum(e.date)}</b><span className="tiny">{monShort(e.date)}</span></div>
                <div>
                  <Link to={`/events/${e.id}/roster`} style={{ fontWeight: 600, fontSize: '1.0625rem', color: 'inherit' }}>{e.name}</Link>
                  <div className="small muted">{dayLabel(e.date, lang)} · <span className="latin" dir="ltr">{e.start}–{e.end}</span> · {d === 0 ? t('Today') : d === 1 ? t('Tomorrow') : t('in {d} days', { d })}</div>
                  <div className="small muted row" style={{ gap: 4 }}><MapPin size={14} aria-hidden />{e.venue}</div>
                </div>
                <div className="hide-md">
                  <div className="small row" style={{ gap: 6 }}><Users size={16} aria-hidden /><span className="num">{e.filled} / {e.total}</span> {t('staff')}</div>
                  <div className="progress" style={{ marginTop: 6 }}><span style={{ width: `${(e.filled / e.total) * 100}%` }} /></div>
                </div>
                <div className="hide-md">
                  <div className="small num">{rs(e.cost)} <span className="muted">/ {rs(e.cap)}</span></div>
                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    {e.conflicts > 0 ? <StatusBadge status="conflict" label={t('{c} conflict', { c: e.conflicts })} />
                      : e.filled >= e.total ? <span className="badge badge-green"><Check size={14} aria-hidden />{t('Fully staffed')}</span>
                        : <span className="badge badge-amber">{t('{n} open', { n: e.total - e.filled })}</span>}
                    {e.status === 'confirmed' && <StatusBadge status="confirmed" />}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => nav(`/events/${e.id}/roster`)}>{t('Open roster')}</Button>
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ margin: '32px 0 14px' }}>{t('Needs review')}</h2>
      {data.needsReview.length === 0 ? (
        <p className="muted">{t('All finished events are reviewed. Nice work.')}</p>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {data.needsReview.map((e) => (
            <div key={e.id} className="card row" style={{ padding: '14px 20px' }}>
              <div style={{ flex: 1 }}>
                <b>{e.name}</b>
                <div className="muted small">{t('Completed')} {dayLabel(e.date, lang)} · {t('{n} staff', { n: e.staff })}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => nav(`/events/${e.id}/review`)}>{t('Review staff')}</Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
