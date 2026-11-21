// Shared rules used by routes and the seed script.

// Rank = rating (40%) + jobs (30%) + certificates (20%) + time active (10%), out of 10.
// Same formula as the S8 profile drawer in Phase 3.
function rankBreakdown(p, approvedCerts) {
  const rating = Math.min(p.rating_avg / 5, 1);
  const jobs = Math.min(p.jobs_completed / 150, 1);
  const certs = Math.min(approvedCerts / 3, 1);
  const time = Math.min(p.months_active / 36, 1);
  const score = 10 * (0.4 * rating + 0.3 * jobs + 0.2 * certs + 0.1 * time);
  return {
    rank: Math.round(score * 10) / 10,
    parts: { rating, jobs, certs, time },
  };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Two shifts clash when they are on the same date and their times overlap.
function overlaps(a, b) {
  if (a.date !== b.date) return false;
  return toMinutes(a.start_time) < toMinutes(b.end_time) && toMinutes(b.start_time) < toMinutes(a.end_time);
}

// FR-16: minimum staff for the guest count (1 staff member per 30 guests).
function minStaffFor(guests) {
  return Math.ceil(guests / 30);
}

const ROLES = ['Waiter', 'Security', 'Sound tech', 'Usher', 'Cleaner'];
const EVENT_TYPES = ['Wedding', 'Mehndi', 'Walima', 'Corporate', 'Gala dinner', 'Expo', 'Birthday'];
const UNIFORMS = ['Black & white formal', 'Black suit', 'Branded polo', 'Shalwar kameez (white)', 'Own clothes'];
const REVIEW_TAGS = ['On time', 'Uniform', 'Professional', 'Left early', 'Absent'];
const REJECT_REASONS = ['Blurry photo', 'Corners cut off', 'Name mismatch', 'Expired CNIC', 'Wrong document'];
const UNDO_WINDOW_MS = 10_000;
const UNDO_GRACE_MS = 3_000; // network delay allowance on the server side
const BUDGET_ALERT = 0.9;

// FR-17/18/19: what to wear for each uniform, with a text description for when pictures don't load.
const UNIFORM_GUIDE = {
  'Black & white formal': {
    items: ['Black polished shoes', 'White shirt, ironed', 'Black trousers', 'Black bow tie', 'Name badge on the left'],
    correct: 'Ironed white full-sleeve shirt, black bow tie, black trousers, black polished shoes, name badge on the left chest.',
    incorrect: 'Creased or coloured shirt, jeans, sports shoes, no tie or no name badge.',
    colors: { top: '#FFFFFF', bottom: '#1B1D24', accent: '#1B1D24', shoes: '#1B1D24' },
  },
  'Black suit': {
    items: ['Black suit, pressed', 'White shirt', 'Black tie', 'Black formal shoes', 'ID card visible'],
    correct: 'Pressed black suit, white shirt, plain black tie, black formal shoes, ID card clipped to the jacket.',
    incorrect: 'Brown or grey jacket, open collar without tie, sandals, ID card in the pocket.',
    colors: { top: '#1B1D24', bottom: '#1B1D24', accent: '#FFFFFF', shoes: '#1B1D24' },
  },
  'Branded polo': {
    items: ['EventFlow polo shirt', 'Dark trousers', 'Closed shoes', 'Name badge', 'Hair neat'],
    correct: 'Indigo EventFlow polo tucked in, dark trousers, closed dark shoes, name badge.',
    incorrect: 'Any other T-shirt, shorts, slippers, polo not tucked in.',
    colors: { top: '#3443B0', bottom: '#2A2D36', accent: '#E99A1C', shoes: '#1B1D24' },
  },
  'Shalwar kameez (white)': {
    items: ['White shalwar kameez, ironed', 'Black waistcoat', 'Black khussa or sandals', 'Name badge', 'Hair neat'],
    correct: 'Ironed white shalwar kameez, black waistcoat buttoned, black khussa, name badge on the waistcoat.',
    incorrect: 'Coloured or creased kameez, no waistcoat, sports shoes.',
    colors: { top: '#FFFFFF', bottom: '#FFFFFF', accent: '#1B1D24', shoes: '#1B1D24' },
  },
  'Own clothes': {
    items: ['Clean, plain clothes', 'Closed shoes', 'ID card', 'Tools or kit ready'],
    correct: 'Clean plain shirt and trousers in dark colours, closed shoes, ID card visible.',
    incorrect: 'Shorts, slippers, T-shirts with big prints or slogans.',
    colors: { top: '#5B6170', bottom: '#2A2D36', accent: '#5B6170', shoes: '#1B1D24' },
  },
};
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // FR-04

module.exports = {
  UNIFORM_GUIDE, MAX_UPLOAD_BYTES,
  rankBreakdown, overlaps, toMinutes, minStaffFor,
  ROLES, EVENT_TYPES, UNIFORMS, REVIEW_TAGS, REJECT_REASONS,
  UNDO_WINDOW_MS, UNDO_GRACE_MS, BUDGET_ALERT,
};
