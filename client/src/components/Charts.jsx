// Hand-drawn SVG charts (no chart library). Colours follow the Phase 3 S11 design:
// grey = planned budget, indigo = actual spend, line = savings trend.
import { useState } from 'react';
import { rs } from '../format';

export function BarChart({ data, labelBudget, labelActual, height = 280 }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...data.map((d) => Math.max(d.budget, d.actual)), 1) * 1.1;
  const W = Math.max(520, data.length * 104); const H = height; const pad = { l: 56, b: 44, t: 16, r: 12 };
  const gw = (W - pad.l - pad.r) / data.length; const bw = Math.min(30, gw / 3);
  const y = (v) => H - pad.b - (v / max) * (H - pad.b - pad.t);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((max * f) / 1000) * 1000);
  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: W, display: 'block' }} role="img"
        aria-label={data.map((d) => `${d.name}: ${labelBudget} ${rs(d.budget)}, ${labelActual} ${rs(d.actual)}`).join('; ')}>
        {ticks.map((v) => (
          <g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--neutral-100)" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-secondary)">{v >= 1000 ? `${v / 1000}k` : v}</text></g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * gw + gw / 2;
          return (
            <g key={d.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x - gw / 2} y={pad.t} width={gw} height={H - pad.b - pad.t} fill={hover === i ? 'var(--neutral-50)' : 'transparent'} />
              <rect x={x - bw - 2} y={y(d.budget)} width={bw} height={y(0) - y(d.budget)} rx="3" fill="#C9CCD4" />
              <rect x={x + 2} y={y(d.actual)} width={bw} height={y(0) - y(d.actual)} rx="3" fill="var(--indigo-600)" />
              <text x={x} y={H - pad.b + 18} textAnchor="middle" fontSize="12" fill="var(--text-primary)">{d.name.length > 13 ? `${d.name.slice(0, 12)}…` : d.name}</text>
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--neutral-400)" />
      </svg>
      {hover !== null && (
        <div className="card" style={{ position: 'absolute', top: 8, insetInlineEnd: 8, padding: '8px 12px', fontSize: '.875rem', pointerEvents: 'none' }}>
          <b>{data[hover].name}</b><div>{labelBudget}: {rs(data[hover].budget)}</div><div>{labelActual}: {rs(data[hover].actual)}</div>
          <div style={{ color: 'var(--green-700)' }}>−{rs(data[hover].budget - data[hover].actual)}</div>
        </div>
      )}
    </div>
  );
}

export function LineChart({ data, height = 260, format = (m) => m }) {
  const [hover, setHover] = useState(null);
  const W = 460; const H = height; const pad = { l: 48, r: 20, t: 20, b: 40 };
  const max = Math.max(...data.map((d) => d.saved), 1) * 1.15;
  const x = (i) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.saved)}`).join(' ');
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={data.map((d) => `${format(d.month)}: ${rs(d.saved)}`).join('; ')}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}><line x1={pad.l} x2={W - pad.r} y1={y(max * f / 1.15)} y2={y(max * f / 1.15)} stroke="var(--neutral-100)" />
            <text x={pad.l - 8} y={y(max * f / 1.15) + 4} textAnchor="end" fontSize="11" fill="var(--text-secondary)">{Math.round(max * f / 1.15 / 100) / 10}k</text></g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--neutral-400)" />
        <path d={path} fill="none" stroke="var(--neutral-900)" strokeWidth="2" />
        {data.map((d, i) => (
          <g key={d.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(i)} cy={y(d.saved)} r="12" fill="transparent" />
            <circle cx={x(i)} cy={y(d.saved)} r={hover === i ? 6 : 4.5} fill="#fff" stroke="var(--indigo-600)" strokeWidth="2" />
            <text x={x(i)} y={H - pad.b + 20} textAnchor="middle" fontSize="12" fill="var(--text-primary)">{format(d.month)}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="card" style={{ position: 'absolute', top: 0, insetInlineEnd: 0, padding: '6px 10px', fontSize: '.875rem' }}>{format(data[hover].month)}: <b>{rs(data[hover].saved)}</b></div>
      )}
    </div>
  );
}
