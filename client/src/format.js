// Money and dates in the format used across the Phase 3 screens: "Rs 1,00,000", "Sat 18 Oct".
export const rs = (n) => `Rs ${Math.round(n || 0).toLocaleString('en-IN')}`;
export const lakh = (n) => (n >= 100000 ? `Rs ${(n / 100000).toFixed(1).replace(/\.0$/, '')} lakh` : rs(n));

const parseDate = (s) => new Date(`${s}T00:00:00`);
export const dayLabel = (s, lang = 'en') =>
  parseDate(s).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const longDate = (s, lang = 'en') =>
  parseDate(s).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const monthLabel = (ym, lang = 'en') =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { month: 'short', year: 'numeric' });
export const dayNum = (s) => parseDate(s).getDate();
export const monShort = (s) => parseDate(s).toLocaleDateString('en-GB', { month: 'short' });
export const daysUntil = (s) => Math.round((parseDate(s) - new Date(new Date().toDateString())) / 86400000);

export function timeAgo(sql, t = (s, v) => (v ? s.replace('{n}', v.n) : s)) {
  const ms = Date.now() - new Date(sql.replace(' ', 'T') + 'Z').getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return t('Just now');
  if (m < 60) return t('{n} min ago', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('{n} h ago', { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? t('Yesterday') : t('{n} days ago', { n: d });
}
export const isToday = (sql) => Date.now() - new Date(sql.replace(' ', 'T') + 'Z').getTime() < 24 * 3600_000;
