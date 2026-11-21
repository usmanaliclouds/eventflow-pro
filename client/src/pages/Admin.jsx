import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Clock, Loader, Mail, ZoomIn, ZoomOut, RotateCcw, RotateCw, Check, X, Inbox, ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, History } from 'lucide-react';
import { useApp } from '../context';
import { get, post } from '../api';
import { Avatar, Button, EmptyState, ErrorState, Loading, StatusBadge, useLoad } from '../components/ui';
import { timeAgo } from '../format';

const FILTERS = ['CNIC', 'Certificate', 'Resubmission', 'Today'];
const FILTER_LABEL = { CNIC: 'CNIC', Certificate: 'Certificate', Resubmission: 'Re-submissions', Today: 'Today' };

// ---------- S16 Audit Queue ----------
export function AuditQueue() {
  const { t } = useApp();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const filter = sp.get('filter') || 'all';
  const sort = sp.get('sort') || 'oldest';
  const { data, loading, error, reload } = useLoad(() => get(`/admin/queue?filter=${filter}&sort=${sort}`), [filter, sort]);
  const [sel, setSel] = useState(0);
  const tableRef = useRef(null);
  const qs = `filter=${filter}&sort=${sort}`;

  useEffect(() => { setSel(0); }, [filter, sort]);
  useEffect(() => {
    const onKey = (e) => {
      if (!data?.items.length || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(data.items.length - 1, s + 1)); }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      if (e.key === 'Enter') { e.preventDefault(); nav(`/admin/documents/${data.items[sel].id}?${qs}`); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, sel, nav, qs]);
  useEffect(() => { tableRef.current?.querySelector('tr.selected')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const setP = (k, v) => { const n = new URLSearchParams(sp); n.set(k, v); setSp(n, { replace: true }); };
  return (
    <>
      <div className="page-head">
        <h1 style={{ fontSize: '1.75rem' }}>{t('Audit Queue')}</h1>
        {data && <span className="badge badge-gray"><Loader size={14} aria-hidden />{t('{n} pending', { n: data.pending })}</span>}
        {data?.pending > 0 && <span className={`badge ${data.oldestHours >= 24 ? 'badge-red' : 'badge-amber'}`}><Clock size={14} aria-hidden />{t('Oldest: {h} h', { h: data.oldestHours })}</span>}
        <span className="spacer" />
        <Button variant="text" onClick={reload}><RefreshCw size={16} aria-hidden />{t('Refresh')}</Button>
      </div>
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <div className="row wrap" role="group" aria-label={t('Filter')} style={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <button key={f} className="chip chip-outline chip-toggle" aria-pressed={filter === f} onClick={() => setP('filter', filter === f ? 'all' : f)}>
              {filter === f && <Check size={15} aria-hidden />}{t(FILTER_LABEL[f])}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <label className="small muted" htmlFor="qsort">{t('Sort')}:</label>
        <select id="qsort" className="select" style={{ width: 200 }} value={sort} onChange={(e) => setP('sort', e.target.value)}>
          <option value="oldest">{t('Oldest first')}</option><option value="newest">{t('Newest first')}</option>
        </select>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} title={t('Couldn’t load the queue')} />
        : loading && !data ? <Loading rows={6} />
          : data.items.length === 0 ? (
            <EmptyState icon={Inbox} title={filter === 'all' ? t('Queue is empty') : t('Nothing here for this filter')}
              body={filter === 'all' ? t('Every document has been reviewed. New uploads will appear here.') : t('Try another filter or show everything.')}
              action={filter === 'all' ? <Button variant="secondary" onClick={() => nav('/admin/reviewed')}>{t('See reviewed documents')}</Button> : <Button variant="secondary" onClick={() => setP('filter', 'all')}>{t('Show all')}</Button>} />
          ) : (
            <div className="card" style={{ overflow: 'auto' }}>
              <table className="table" ref={tableRef}>
                <caption className="sr-only">{t('Documents waiting for review')}</caption>
                <thead><tr><th style={{ width: 64 }} aria-label={t('Photo')} /><th>{t('Worker')}</th><th>{t('Document')}</th><th>{t('Submitted')}</th><th aria-label={t('Action')} /></tr></thead>
                <tbody>
                  {data.items.map((r, i) => (
                    <tr key={r.id} className={i === sel ? 'selected' : ''} aria-selected={i === sel} onClick={() => nav(`/admin/documents/${r.id}?${qs}`)}>
                      <td><Avatar size={36} color="#C9CCD4" /></td>
                      <td><b>{r.worker}</b></td>
                      <td>{t(r.docType === 'CNIC' ? 'CNIC front + back' : `${r.docType} certificate`)}</td>
                      <td>
                        <span className="row" style={{ gap: 8 }}>
                          <span className="num" style={{ fontWeight: 600, color: r.hours >= 24 ? 'var(--red-700)' : 'inherit' }}>{t('{n} h ago', { n: r.hours })}</span>
                          {r.resubmission ? <span className="badge badge-amber"><RefreshCw size={13} aria-hidden />{t('Re-submitted')}</span> : <span className="badge badge-indigo"><Mail size={13} aria-hidden />{t('New')}</span>}
                        </span>
                      </td>
                      <td><Link to={`/admin/documents/${r.id}?${qs}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600 }}>{t('Review')}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      <p className="small muted" style={{ marginTop: 16 }}>
        {t('Shortcuts')}: <kbd>J</kbd> / <kbd>↓</kbd> {t('Next')} · <kbd>K</kbd> / <kbd>↑</kbd> {t('Previous')} · <kbd>Enter</kbd> {t('Open')}
      </p>
    </>
  );
}

function IdCard({ side, docType, worker, zoom, rot }) {
  const { t } = useApp();
  return (
    <div className="id-card" style={{ transform: `scale(${zoom}) rotate(${rot}deg)` }} aria-label={t('Document preview (specimen)')} role="img">
      <div className="tiny" style={{ color: '#5B6170' }}>SPECIMEN · {docType === 'CNIC' ? `Identity Card · ${side === 'front' ? 'Front' : 'Back'}` : `${docType} Certificate`}</div>
      {docType === 'CNIC' && side === 'front' ? (
        <div style={{ display: 'flex', gap: 28, marginTop: 10 }}>
          <div style={{ width: 120, height: 140, background: '#DADDE4', borderRadius: 6 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 14 }}>
            {[70, 40, 90, 55, 30].map((w, i) => <span key={i} style={{ height: 6, width: `${w}%`, background: '#9AA0AD', borderRadius: 3 }} />)}
            <span style={{ fontSize: 13, color: '#14161C', marginTop: 8 }}>{worker}</span>
          </div>
        </div>
      ) : docType === 'CNIC' ? (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[85, 60, 75].map((w, i) => <span key={i} style={{ height: 6, width: `${w}%`, background: '#9AA0AD', borderRadius: 3 }} />)}
          <div style={{ marginTop: 30, height: 60, background: 'repeating-linear-gradient(90deg,#14161C 0 2px,#fff 2px 5px)', width: '70%' }} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1A2259' }}>Certificate of Completion</div>
          <div style={{ marginTop: 10, fontSize: 14 }}>{docType} Training</div>
          <div style={{ marginTop: 16, fontSize: 16 }}>{worker}</div>
          <div style={{ margin: '24px auto 0', width: 60, height: 60, borderRadius: '50%', border: '3px solid #C27C0A' }} />
        </div>
      )}
    </div>
  );
}

// ---------- S17 Document review ----------
export function DocumentReview() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const qs = sp.toString();
  const { t, toast } = useApp();
  const nav = useNavigate();
  const { data: d, loading, error, reload } = useLoad(() => get(`/admin/documents/${id}?${qs}`), [id]);
  const [side, setSide] = useState('front');
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [checks, setChecks] = useState({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(null);
  const msgRef = useRef(null);

  useEffect(() => { setSide('front'); setZoom(1); setRot(0); setChecks({}); setRejectOpen(false); setReasons([]); setMsg(''); setErr({}); }, [id]);
  const fields = d ? [['fatherName', t('Father’s name'), d.profile.fatherName], ['dob', t('Date of birth'), /^\d{4}-\d{2}-\d{2}$/.test(d.profile.dob) ? new Date(`${d.profile.dob}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : d.profile.dob], ['cnic', t('CNIC number'), d.profile.cnic]] : [];
  const allMatch = fields.every(([k]) => checks[k] === 'yes');
  const anyNo = fields.some(([k]) => checks[k] === 'no');
  const goNext = () => (d.nextId ? nav(`/admin/documents/${d.nextId}?${qs}`) : nav(`/admin/queue?${qs}`));

  const approve = async () => {
    if (!allMatch) { setErr({ match: t('Mark every field as “Matches” before approving.') }); return; }
    setBusy('approve');
    try { await post(`/admin/documents/${d.id}/approve`); toast(t('{n}’s {d} approved.', { n: d.worker, d: t(d.docType) }), { kind: 'success' }); goNext(); }
    catch (e) { toast(e.message, { kind: 'error' }); if (e.code === 'ALREADY_REVIEWED') reload(); }
    finally { setBusy(null); }
  };
  const reject = async () => {
    const e = {};
    if (!reasons.length) e.reasons = t('Pick at least one reason.');
    if (msg.trim().length < 10) e.msg = t('Write a short message (at least 10 characters) so the worker knows what to fix.');
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy('reject');
    try { await post(`/admin/documents/${d.id}/reject`, { reasons, message: msg.trim() }); toast(t('Rejected. {n} will see your message.', { n: d.worker }), { kind: 'success' }); goNext(); }
    catch (er) { toast(er.message, { kind: 'error' }); }
    finally { setBusy(null); }
  };
  const openReject = () => {
    setRejectOpen(true);
    if (checks.fatherName === 'no' || checks.cnic === 'no') setReasons((r) => (r.includes('Name mismatch') ? r : [...r, 'Name mismatch']));
    setTimeout(() => msgRef.current?.focus(), 50);
  };
  const docName = d?.docType === 'CNIC' ? 'CNIC' : `${d?.docType} certificate`;
  const SUGGEST = {
    'Blurry photo': `Your ${docName} photo is blurry. Please retake it in good light.`,
    'Corners cut off': `Some corners of your ${docName} are cut off. Please fit the whole document in the frame.`,
    'Name mismatch': `The name on your ${docName} does not match your profile. Please check your details.`,
    'Expired CNIC': 'This CNIC has expired. Please upload your renewed card.',
    'Wrong document': `This is not your ${docName}. Please upload the correct document.`,
  };
  const toggleReason = (r) => {
    const next = reasons.includes(r) ? reasons.filter((x) => x !== r) : [...reasons, r];
    setReasons(next);
    if (!msg || Object.values(SUGGEST).includes(msg)) setMsg(next.length ? SUGGEST[next[next.length - 1]] : '');
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!d || d.status !== 'pending' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'a') approve();
      if (e.key === 'r') openReject();
      if (e.key === 'j' && d.nextId) nav(`/admin/documents/${d.nextId}?${qs}`);
      if (e.key === 'k' && d.prevId) nav(`/admin/documents/${d.prevId}?${qs}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !d) return <Loading />;
  const pending = d.status === 'pending';
  return (
    <>
      <nav className="crumbs" aria-label={t('Breadcrumb')}><Link to={`/admin/queue?${qs}`}>{t('Audit Queue')}</Link><span aria-hidden>›</span><span aria-current="page">{d.worker}</span></nav>
      <div className="page-head">
        <h1 style={{ fontSize: '1.75rem' }}>{d.worker} · {t(d.docType)}</h1>
        <StatusBadge status={d.status} />
        {d.resubmission && <span className="badge badge-amber">{t('Re-submitted')}</span>}
        <span className="spacer" />
        {d.position && <span className="muted">{t('Item {a} of {b}', { a: d.position, b: d.total })}</span>}
        <Button variant="dark" size="sm" disabled={!d.prevId} onClick={() => nav(`/admin/documents/${d.prevId}?${qs}`)}><ChevronLeft size={18} className="flip" aria-hidden />{t('Previous')}</Button>
        <Button variant="dark" size="sm" disabled={!d.nextId} onClick={() => nav(`/admin/documents/${d.nextId}?${qs}`)}>{t('Next')}<ChevronRight size={18} className="flip" aria-hidden /></Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(340px, 1fr)', gap: 24, alignItems: 'start' }}>
        <section className="doc-viewer" aria-label={t('Document')}>
          {d.docType === 'CNIC' && (
            <div className="seg" role="group" aria-label={t('Side')} style={{ borderRadius: 999, background: '#fff' }}>
              <button aria-pressed={side === 'front'} onClick={() => setSide('front')} style={{ borderRadius: 999 }}>{t('Front')}</button>
              <button aria-pressed={side === 'back'} onClick={() => setSide('back')} style={{ borderRadius: 999 }}>{t('Back')}</button>
            </div>
          )}
          <IdCard side={side} docType={d.docType} worker={d.worker} zoom={zoom} rot={rot} />
          <div className="doc-tools">
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.2))} aria-label={t('Zoom in')}><ZoomIn size={22} /></button>
            <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} aria-label={t('Zoom out')}><ZoomOut size={22} /></button>
            <button onClick={() => setRot((r) => r - 90)} aria-label={t('Rotate left')}><RotateCcw size={22} /></button>
            <button onClick={() => setRot((r) => r + 90)} aria-label={t('Rotate right')}><RotateCw size={22} /></button>
          </div>
        </section>
        <section className="card card-pad stack" style={{ gap: 18 }} aria-label={t('Profile data')}>
          <h2 style={{ fontSize: '1.25rem' }}>{t('Profile data')}</h2>
          <div className="small muted">{t(d.profile.role)} · <span className="latin" dir="ltr">{d.profile.phone}</span> · {t('submitted {h} h ago', { h: d.submittedHours })}</div>
          {!pending && (
            <div className={`banner ${d.status === 'approved' ? 'banner-info' : 'banner-error'}`} style={{ margin: 0 }}>
              {d.status === 'approved' ? <CheckCircle2 size={20} color="var(--green-700)" aria-hidden /> : <X size={20} aria-hidden />}
              <span className="small">{d.status === 'approved' ? t('Approved by {r}.', { r: d.reviewer }) : t('Rejected by {r}: {m}', { r: d.reviewer, m: d.rejectMessage })}</span>
            </div>
          )}
          {fields.map(([k, label, value]) => (
            <div key={k}>
              <div className="small" style={{ fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '1.125rem', margin: '2px 0 8px' }} className="latin">{value}</div>
              {pending && (
                <div className="row" role="radiogroup" aria-label={t('Does {f} match?', { f: label })} style={{ gap: 8 }}>
                  <button className="chip chip-outline chip-toggle" role="radio" aria-checked={checks[k] === 'yes'} aria-pressed={checks[k] === 'yes'} onClick={() => { setChecks({ ...checks, [k]: 'yes' }); setErr({}); }}><Check size={15} aria-hidden />{t('Matches')}</button>
                  <button className="chip chip-outline chip-toggle danger" role="radio" aria-checked={checks[k] === 'no'} aria-pressed={checks[k] === 'no'} onClick={() => { setChecks({ ...checks, [k]: 'no' }); setErr({}); }}><X size={15} aria-hidden />{t('Doesn’t match')}</button>
                </div>
              )}
            </div>
          ))}
          {pending && !allMatch && !anyNo && <p className="small muted">{t('Compare each field with the document, then approve or reject.')}</p>}
          {anyNo && !rejectOpen && <p className="field-error">{t('A field doesn’t match. Reject with a reason so the worker can fix it.')}</p>}
          {err.match && <p className="field-error" role="alert">{err.match}</p>}

          {pending && rejectOpen && (
            <div className="stack" style={{ gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div>
                <div className="small" style={{ fontWeight: 600, marginBottom: 6 }} id="rr">{t('Reason (required)')}</div>
                <div className="row wrap" style={{ gap: 6 }} role="group" aria-labelledby="rr">
                  {d.reasons.map((r) => (
                    <button key={r} className="chip chip-outline chip-toggle" aria-pressed={reasons.includes(r)} onClick={() => toggleReason(r)} style={{ fontSize: '.875rem' }}>
                      {reasons.includes(r) && <Check size={14} aria-hidden />}{t(r)}
                    </button>
                  ))}
                </div>
                {err.reasons && <p className="field-error" role="alert">{err.reasons}</p>}
              </div>
              <div className={`field ${err.msg ? 'has-error' : ''}`}>
                <label htmlFor="msg">{t('Message to worker')}</label>
                <textarea id="msg" ref={msgRef} className="textarea" maxLength={300} value={msg} onChange={(e) => setMsg(e.target.value)} aria-invalid={!!err.msg} />
                <span className="hint">{t('The worker sees this message in their app.')} {msg.length}/300</span>
                {err.msg && <span className="field-error" role="alert">{err.msg}</span>}
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setRejectOpen(false)}>{t('Cancel')}</Button>
                <Button variant="danger" loading={busy === 'reject'} onClick={reject}><X size={18} aria-hidden />{t('Confirm reject')}</Button>
              </div>
            </div>
          )}
          {pending && !rejectOpen && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <Button variant="danger" onClick={openReject}>{t('Reject')}</Button>
              <Button onClick={approve} loading={busy === 'approve'} disabled={!allMatch}>{t('Approve')}</Button>
            </div>
          )}
          {pending && <p className="tiny muted" style={{ textAlign: 'center' }}><kbd>A</kbd> {t('Approve')} · <kbd>R</kbd> {t('Reject')} · <kbd>J</kbd>/<kbd>K</kbd> {t('Next / Previous')}</p>}
        </section>
      </div>
    </>
  );
}

// ---------- Reviewed list ----------
export function Reviewed() {
  const { t } = useApp();
  const { data, loading, error, reload } = useLoad(() => get('/admin/reviewed'), []);
  return (
    <>
      <div className="page-head"><h1 style={{ fontSize: '1.75rem' }}>{t('Reviewed')}</h1></div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <Loading rows={5} /> : data.items.length === 0 ? (
        <EmptyState icon={History} title={t('Nothing reviewed yet')} body={t('Documents you approve or reject will be listed here.')} />
      ) : (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="table">
            <caption className="sr-only">{t('Reviewed documents')}</caption>
            <thead><tr><th>{t('Worker')}</th><th>{t('Document')}</th><th>{t('Result')}</th><th>{t('Reason')}</th><th>{t('By')}</th><th>{t('When')}</th></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} style={{ cursor: 'default' }}>
                  <td><b>{r.worker}</b></td><td>{t(r.docType)}</td>
                  <td><StatusBadge status={r.status} label={r.status === 'approved' ? t('Approved') : t('Rejected')} /></td>
                  <td className="small">{r.reasons.map((x) => t(x)).join(', ') || '—'}</td>
                  <td className="small">{r.reviewer}</td><td className="small muted">{timeAgo(r.reviewedAt, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
