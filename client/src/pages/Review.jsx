import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useBlocker } from 'react-router-dom';
import { Check, CheckCircle2, Star } from 'lucide-react';
import { useApp } from '../context';
import { get, post } from '../api';
import { dayLabel } from '../format';
import { Avatar, Button, ErrorState, Loading, StatusBadge, useLoad } from '../components/ui';

function StarInput({ value, onChange, name }) {
  const { t } = useApp();
  const [hover, setHover] = useState(0);
  return (
    <div className="stars" role="radiogroup" aria-label={t('Rating for {n}', { n: name })} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className="star-btn" role="radio" aria-checked={value === n} aria-label={t('{n} out of 5 stars', { n })}
          onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(1, (value || 1) - 1)); }
          }}>
          <Star size={30} fill={(hover || value) >= n ? 'var(--marigold-500)' : 'none'} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}

export default function Review() {
  const { id } = useParams();
  const { t, lang, toast, confirm } = useApp();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLoad(() => get(`/events/${id}/review`), [id]);
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (data) setRows(data.people); }, [data]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({ title: t('Leave without saving?'), body: t('Your ratings for this event will be lost.'), ok: t('Leave'), cancel: t('Stay'), danger: true })
      .then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm, t]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !rows) return <Loading />;
  const ev = data.event;
  const rated = rows.filter((r) => r.stars > 0).length;
  const upd = (i, patch) => { setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r))); setDirty(true); setErr(''); };
  const toggleTag = (i, tag) => {
    const r = rows[i];
    let tags = r.tags.includes(tag) ? r.tags.filter((x) => x !== tag) : [...r.tags, tag];
    if (tag === 'Absent' && tags.includes('Absent')) tags = ['Absent']; // Absent cannot mix with other tags
    else tags = tags.filter((x) => x !== 'Absent' || tag === 'Absent');
    upd(i, { tags });
  };
  const submit = async () => {
    const list = rows.filter((r) => r.stars > 0).map((r) => ({ staffId: r.staffId, stars: r.stars, tags: r.tags, comment: r.comment.trim() || undefined }));
    if (!list.length) { setErr(t('Rate at least one person before submitting.')); return; }
    setSaving(true);
    try {
      const r = await post(`/events/${ev.id}/reviews`, { reviews: list });
      setDirty(false); setDone(r);
      toast(r.complete ? t('All {n} reviews saved.', { n: r.total }) : t('{a} of {b} reviews saved. You can finish the rest later.', { a: r.rated, b: r.total }), { kind: 'success' });
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  if (done?.complete) {
    return (
      <div style={{ maxWidth: 520, margin: '60px auto' }}>
        <div className="state card">
          <div className="icon-circle green"><CheckCircle2 size={34} aria-hidden /></div>
          <h2>{t('Reviews submitted')}</h2>
          <p className="muted">{t('Thank you. Ratings now update each worker’s rank in the marketplace.')}</p>
          <div className="row"><Button variant="secondary" onClick={() => nav('/dashboard')}>{t('Back to dashboard')}</Button><Button onClick={() => nav('/analytics')}>{t('See savings')}</Button></div>
        </div>
      </div>
    );
  }
  return (
    <>
      <nav className="crumbs" aria-label={t('Breadcrumb')}><Link to="/dashboard">{t('Dashboard')}</Link><span aria-hidden>›</span><Link to={`/events/${ev.id}/roster`}>{ev.name}</Link><span aria-hidden>›</span><span aria-current="page">{t('Review')}</span></nav>
      <div className="page-head">
        <h1>{t('{e} completed', { e: ev.name })}</h1>
        <StatusBadge status="completed" />
        <span className="muted">{dayLabel(ev.date, lang)}</span>
      </div>
      <div style={{ maxWidth: 360, marginBottom: 24 }}>
        <div className="small" style={{ fontWeight: 600, marginBottom: 6 }} aria-live="polite">{t('{a} of {b} rated', { a: rated, b: rows.length })}</div>
        <div className="progress" style={{ height: 10 }}><span style={{ width: `${(rated / rows.length) * 100}%` }} /></div>
      </div>
      <div className="stack" style={{ gap: 12, maxWidth: 1000 }}>
        {rows.map((r, i) => (
          <div key={r.staffId} className="card" style={{ padding: '16px 20px' }}>
            <div className="row wrap" style={{ gap: 20 }}>
              <div className="row" style={{ minWidth: 220 }}><Avatar color={r.color} size={40} /><div><b>{r.name}</b><div className="small muted">{t(r.role)}</div></div></div>
              <StarInput value={r.stars} name={r.name} onChange={(n) => upd(i, { stars: n })} />
              {r.stars > 0 && <span className="small muted">{[t('Poor'), t('Below average'), t('Good'), t('Very good'), t('Excellent')][r.stars - 1]}</span>}
            </div>
            <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
              {data.tags.map((tag) => (
                <button key={tag} type="button" className={`chip chip-outline chip-toggle ${tag === 'Absent' || tag === 'Left early' ? 'danger' : ''}`} aria-pressed={r.tags.includes(tag)} onClick={() => toggleTag(i, tag)}>
                  {r.tags.includes(tag) && <Check size={15} aria-hidden />}{t(tag)}
                </button>
              ))}
              <input className="input" style={{ flex: 1, minWidth: 240, minHeight: 40 }} maxLength={300} placeholder={t('Add a comment (optional)')} aria-label={t('Comment about {n}', { n: r.name })}
                value={r.comment} onChange={(e) => upd(i, { comment: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
      {err && <p className="field-error" role="alert" style={{ marginTop: 16 }}>{err}</p>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 24, maxWidth: 1000 }}>
        <span className="small muted">{rated < rows.length ? t('Unrated people are skipped. You can come back later.') : ''}</span>
        <Button onClick={submit} loading={saving}>{t('Submit reviews')}</Button>
      </div>
    </>
  );
}
