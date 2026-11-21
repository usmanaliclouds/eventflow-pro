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

module.exports = {
  rankBreakdown, overlaps, toMinutes, minStaffFor,
  ROLES, EVENT_TYPES, UNIFORMS, REVIEW_TAGS, REJECT_REASONS,
  UNDO_WINDOW_MS, UNDO_GRACE_MS, BUDGET_ALERT,
};
