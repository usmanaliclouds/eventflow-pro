import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, BarChart3, Check } from 'lucide-react';
import { useApp } from '../context';
import { get } from '../api';
import { rs, monthLabel, dayLabel } from '../format';
import { Button, EmptyState, ErrorState, useLoad } from '../components/ui';
import { BarChart, LineChart } from '../components/Charts';

export default function Analytics() {
  const { t, lang, toast } = useApp();
  const nav = useNavigate();
  const [month, setMonth] = useState('all');
  const [type, setType] = useState('all');
  const { data, loading, error, reload } = useLoad(() => get(`/analytics?month=${month}&type=${encodeURIComponent(type)}`), [month, type]);

  const exportCsv = () => {
    const rows = [['Event', 'Date', 'Type', 'Budget (Rs)', 'Actual spend (Rs)', 'Saved (Rs)'],
      ...data.perEvent.map((e) => [e.name, e.date, e.type, e.budget, e.actual, e.budget - e.actual])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `eventflow-savings-${month}.csv`; a.click();
    URL.revokeObjectURL(a.href);
    toast(t('CSV downloaded.'), { kind: 'success' });
  };

  const head = (
    <div className="page-head">
      <h1>{t('Savings Analytics')}</h1>
      <span className="spacer" />
      <div className="row no-print">
        <Button variant="secondary" onClick={() => window.print()} disabled={!data?.perEvent.length}><Download size={18} aria-hidden />{t('Export PDF')}</Button>
        <Button variant="secondary" onClick={exportCsv} disabled={!data?.perEvent.length}><Download size={18} aria-hidden />{t('Export CSV')}</Button>
      </div>
    </div>
  );
  const filters = data && (
    <div className="row wrap no-print" style={{ marginBottom: 20 }}>
      <label className="sr-only" htmlFor="m">{t('Month')}</label>
      <select id="m" className="select" style={{ width: 200 }} value={month} onChange={(e) => setMonth(e.target.value)}>
        <option value="all">{t('All months')}</option>
        {data.months.map((m) => <option key={m} value={m}>{monthLabel(m, lang)}</option>)}
      </select>
      <label className="sr-only" htmlFor="ty">{t('Event type')}</label>
      <select id="ty" className="select" style={{ width: 200 }} value={type} onChange={(e) => setType(e.target.value)}>
        <option value="all">{t('All events')}</option>
        {data.types.map((m) => <option key={m} value={m}>{t(m)}</option>)}
      </select>
    </div>
  );
  if (error) return <>{head}<ErrorState error={error} onRetry={reload} title={t('Couldn’t load analytics')} /></>;
  if (loading && !data) return <>{head}<div className="grid-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div><div className="skeleton" style={{ height: 320, marginTop: 16 }} /></>;
  if (!data.months.length) {
    return <>{head}<div style={{ maxWidth: 520, margin: '60px auto' }}><EmptyState icon={BarChart3} title={t('No savings to show yet')} body={t('Savings appear here after your first event is finished and its final cost is recorded.')} action={<Button onClick={() => nav('/dashboard')}>{t('Back to dashboard')}</Button>} /></div></>;
  }
  const k = data.kpis;
  return (
    <>
      {head}
      {filters}
      {data.perEvent.length === 0 ? (
        <EmptyState icon={BarChart3} title={t('No finished events for this filter')} body={t('Pick another month or event type.')} action={<Button variant="secondary" onClick={() => { setMonth('all'); setType('all'); }}>{t('Show all')}</Button>} />
      ) : (
        <>
          <section className="grid-4" aria-label={t('Summary')}>
            <div className="card kpi"><div className="label">{t('Initial budget')}</div><div className="value num">{rs(k.budget)}</div><div className="sub">{t('{n} events', { n: k.events })}</div></div>
            <div className="card kpi"><div className="label">{t('Actual spend')}</div><div className="value num">{rs(k.actual)}</div></div>
            <div className="card kpi"><div className="label">{t('Saved')}</div><div className="value num">{rs(k.saved)}</div>
              <span className="badge badge-green" style={{ marginTop: 6 }}><Check size={14} aria-hidden />{k.percent}%</span></div>
            <div className="card kpi"><div className="label">{t('% saved')}</div><div className="value num">{k.percent}%</div></div>
          </section>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 16, marginTop: 16 }}>
            <section className="card card-pad">
              <div className="row" style={{ marginBottom: 12 }}><h3 style={{ flex: 1 }}>{t('Budget vs actual per event')}</h3>
                <div className="chart-legend"><span><i style={{ background: '#C9CCD4' }} />{t('Budget')}</span><span><i style={{ background: 'var(--indigo-600)' }} />{t('Actual')}</span></div></div>
              <BarChart data={data.perEvent} labelBudget={t('Budget')} labelActual={t('Actual')} />
            </section>
            <section className="card card-pad">
              <h3 style={{ marginBottom: 12 }}>{t('Savings trend')}</h3>
              {data.trend.length < 2 ? <p className="muted small">{t('The trend line appears once you have events in two or more months.')}</p>
                : <LineChart data={data.trend} format={(m) => monthLabel(m, lang).split(' ')[0]} />}
            </section>
          </div>
          <section className="card" style={{ marginTop: 16, overflow: 'auto' }}>
            <table className="table">
              <caption className="sr-only">{t('Savings per event')}</caption>
              <thead><tr><th>{t('Event')}</th><th>{t('Date')}</th><th>{t('Budget')}</th><th>{t('Actual')}</th><th>{t('Saved')}</th></tr></thead>
              <tbody>
                {data.perEvent.map((e) => (
                  <tr key={e.id} style={{ cursor: 'default' }}><td><b>{e.name}</b> <span className="muted small">· {t(e.type)}</span></td><td>{dayLabel(e.date, lang)}</td>
                    <td className="num">{rs(e.budget)}</td><td className="num">{rs(e.actual)}</td><td className="num" style={{ color: 'var(--green-700)', fontWeight: 600 }}>{rs(e.budget - e.actual)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
