// EventFlow Pro API (Express + SQLite).
// Every rule that matters is checked here on the server, not only in the browser.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
// First run: create the demo data before the database is opened.
{
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  if (require.main === module && !fs.existsSync(path.join(dataDir, 'eventflow.db'))) {
    console.log('No database yet: creating demo data…');
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'seed.js')], { stdio: 'inherit' });
  }
}
const { db, tx } = require('./db');
const L = require('./lib');

const PORT = Number(process.env.PORT || 4000);
const PROD = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('JWT_SECRET not set: using a random one (everyone is logged out when the server restarts).');
  return crypto.randomBytes(32).toString('hex');
})();
// No SMS provider in this project, so the one-time code is shown on screen in demo mode.
const OTP_DEMO = process.env.OTP_DEMO !== '0';
const SESSION_HOURS = 8;

const app = express();
app.set('trust proxy', 1); // behind Render's proxy
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

// ---------- helpers ----------
class ApiError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra; }
}
const fail = (status, code, message, extra) => { throw new ApiError(status, code, message, extra); };
const wrap = (fn) => (req, res, next) => { try { const r = fn(req, res); if (r !== undefined) res.json(r); } catch (e) { next(e); } };
const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = {};
    for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
    fail(422, 'VALIDATION', Object.values(fields)[0], { fields });
  }
  return r.data;
};
const nowSql = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const sqlToMs = (s) => new Date(s.replace(' ', 'T') + 'Z').getTime();
const todayStr = () => new Date().toISOString().slice(0, 10);
const rs = (n) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
const notify = (userId, title, body, link = null) =>
  db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?,?,?,?)').run(userId, title, body, link);
const audit = (actor, action, target, detail) =>
  db.prepare('INSERT INTO audit_log (actor_id, action, target, detail) VALUES (?,?,?,?)').run(actor, action, target, detail ?? null);

const phoneRule = z.string().trim().regex(/^03\d{9}$/, 'Enter an 11-digit mobile number, e.g. 03001234567.');
const passwordRule = z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password is too long.')
  .regex(/\d/, 'Password must include at least one number.');

// ---------- auth ----------
function setSession(res, user) {
  const token = jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
  res.cookie('ef_session', token, { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: SESSION_HOURS * 3600_000 });
}
function auth(...roles) {
  return (req, _res, next) => {
    const token = req.cookies.ef_session;
    if (!token) return next(new ApiError(401, 'NO_SESSION', 'Please log in to continue.'));
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); }
    catch { return next(new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.')); }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return next(new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.'));
    if (roles.length && !roles.includes(user.role))
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to open this page.'));
    req.user = user;
    next();
  };
}
const publicUser = (u) => ({
  id: u.id, role: u.role, fullName: u.full_name, phone: u.phone, company: u.company,
  settings: { language: u.language, textSize: u.text_size, highContrast: !!u.high_contrast,
    notifReminders: !!u.notif_reminders, notifInvites: !!u.notif_invites },
});
const maskPhone = (p) => `${p.slice(0, 2)}XX-XXX-${p.slice(-4)}`;

function startOtp(user) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const expires = new Date(Date.now() + 5 * 60_000).toISOString().replace('T', ' ').slice(0, 19);
  db.prepare('UPDATE otp_codes SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);
  const id = db.prepare('INSERT INTO otp_codes (user_id, code_hash, expires_at) VALUES (?,?,?)')
    .run(user.id, bcrypt.hashSync(code, 8), expires).lastInsertRowid;
  return { challengeId: Number(id), maskedPhone: maskPhone(user.phone), resendInSeconds: 45, ...(OTP_DEMO ? { demoCode: code } : {}) };
}
function checkLock(user) {
  if (user.locked_until && sqlToMs(user.locked_until) > Date.now()) {
    const mins = Math.ceil((sqlToMs(user.locked_until) - Date.now()) / 60000);
    fail(423, 'LOCKED', `Too many tries. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }
}

app.post('/api/auth/register', wrap((req) => {
  const body = parse(z.object({
    role: z.enum(['manager', 'staff'], { message: 'Choose Event Manager or Field Staff.' }),
    fullName: z.string().trim().min(3, 'Enter your full name (at least 3 letters).').max(60, 'Name is too long.'),
    phone: phoneRule,
    password: passwordRule,
    company: z.string().trim().max(80).optional(),
    primaryRole: z.enum(L.ROLES).optional(),
    language: z.enum(['en', 'ur']).default('en'),
  }), req.body);
  if (db.prepare('SELECT 1 FROM users WHERE phone = ?').get(body.phone))
    fail(409, 'PHONE_TAKEN', 'This number already has an account. Log in instead.', { fields: { phone: 'This number already has an account. Log in instead.' } });
  if (body.role === 'staff' && !body.primaryRole) fail(422, 'VALIDATION', 'Choose the work you do.', { fields: { primaryRole: 'Choose the work you do.' } });
  const user = tx(() => {
    const id = Number(db.prepare('INSERT INTO users (role, full_name, phone, company, password_hash, language) VALUES (?,?,?,?,?,?)')
      .run(body.role, body.fullName, body.phone, body.company || null, bcrypt.hashSync(body.password, 10), body.language).lastInsertRowid);
    if (body.role === 'staff') db.prepare('INSERT INTO staff_profiles (user_id, primary_role, rate) VALUES (?,?,?)').run(id, body.primaryRole, 1500);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  });
  return startOtp(user);
}));

app.post('/api/auth/login', wrap((req) => {
  const body = parse(z.object({ phone: phoneRule, password: z.string().min(1, 'Enter your password.') }), req.body);
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(body.phone);
  if (!user) fail(401, 'NO_ACCOUNT', 'No account uses this number. Check it or create an account.', { fields: { phone: 'No account uses this number. Check it or create an account.' } });
  checkLock(user);
  if (!bcrypt.compareSync(body.password, user.password_hash)) {
    const failed = user.failed_logins + 1;
    if (failed >= 5) {
      const until = new Date(Date.now() + 15 * 60_000).toISOString().replace('T', ' ').slice(0, 19);
      db.prepare('UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?').run(until, user.id);
      fail(423, 'LOCKED', 'Too many wrong passwords. Your account is locked for 15 minutes.');
    }
    db.prepare('UPDATE users SET failed_logins = ? WHERE id = ?').run(failed, user.id);
    const left = 5 - failed;
    fail(401, 'WRONG_PASSWORD', `Wrong password. ${left} attempt${left === 1 ? '' : 's'} left.`, { fields: { password: `Wrong password. ${left} attempt${left === 1 ? '' : 's'} left.` } });
  }
  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id);
  return startOtp(user);
}));

app.post('/api/auth/verify-otp', wrap((req, res) => {
  const body = parse(z.object({ challengeId: z.number().int(), code: z.string().regex(/^\d{6}$/, 'Enter all 6 digits.') }), req.body);
  const otp = db.prepare('SELECT * FROM otp_codes WHERE id = ?').get(body.challengeId);
  if (!otp || otp.used) fail(410, 'OTP_GONE', 'This code is no longer valid. Tap "Resend code".');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(otp.user_id);
  checkLock(user);
  if (sqlToMs(otp.expires_at) < Date.now()) fail(410, 'OTP_EXPIRED', 'This code has expired. Tap "Resend code" for a new one.');
  if (!bcrypt.compareSync(body.code, otp.code_hash)) {
    const attempts = otp.attempts + 1;
    if (attempts >= 3) {
      const until = new Date(Date.now() + 15 * 60_000).toISOString().replace('T', ' ').slice(0, 19);
      db.prepare('UPDATE otp_codes SET used = 1, attempts = ? WHERE id = ?').run(attempts, otp.id);
      db.prepare('UPDATE users SET locked_until = ? WHERE id = ?').run(until, user.id);
      fail(423, 'LOCKED', 'Too many tries. Try again in 15 minutes.');
    }
    db.prepare('UPDATE otp_codes SET attempts = ? WHERE id = ?').run(attempts, otp.id);
    const left = 3 - attempts;
    fail(401, 'OTP_WRONG', `Code incorrect – ${left} ${left === 1 ? 'try' : 'tries'} left.`, { triesLeft: left });
  }
  db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(otp.id);
  setSession(res, user);
  return { user: publicUser(user) };
}));

app.post('/api/auth/resend-otp', wrap((req) => {
  const body = parse(z.object({ challengeId: z.number().int() }), req.body);
  const otp = db.prepare('SELECT * FROM otp_codes WHERE id = ?').get(body.challengeId);
  if (!otp) fail(410, 'OTP_GONE', 'Please log in again.');
  const wait = 45 - Math.floor((Date.now() - sqlToMs(otp.created_at)) / 1000);
  if (wait > 0) fail(429, 'TOO_SOON', `You can ask for a new code in ${wait} seconds.`);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(otp.user_id);
  checkLock(user);
  return startOtp(user);
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/logout', (_req, res) => { res.clearCookie('ef_session'); res.json({ ok: true }); });
app.get('/api/auth/me', auth(), wrap((req) => ({ user: publicUser(req.user) })));

app.patch('/api/me/settings', auth(), wrap((req) => {
  const b = parse(z.object({
    language: z.enum(['en', 'ur']).optional(),
    textSize: z.number().int().min(100).max(200).optional(),
    highContrast: z.boolean().optional(),
    notifReminders: z.boolean().optional(),
    notifInvites: z.boolean().optional(),
  }), req.body);
  const map = { language: 'language', textSize: 'text_size', highContrast: 'high_contrast', notifReminders: 'notif_reminders', notifInvites: 'notif_invites' };
  for (const [k, col] of Object.entries(map)) {
    if (b[k] === undefined) continue;
    db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(typeof b[k] === 'boolean' ? Number(b[k]) : b[k], req.user.id);
  }
  return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) };
}));

// ---------- staff + events helpers ----------
const approvedCerts = (sid) => db.prepare("SELECT doc_type FROM documents WHERE staff_id = ? AND status = 'approved'").all(sid).map((r) => r.doc_type);
const docStatus = (sid) => db.prepare(`SELECT doc_type, status FROM documents WHERE staff_id = ?
  AND id IN (SELECT MAX(id) FROM documents WHERE staff_id = ? GROUP BY doc_type)`).all(sid, sid);

function staffCard(row) {
  const certs = approvedCerts(row.user_id);
  const { rank } = L.rankBreakdown(row, certs.length);
  return {
    id: row.user_id, name: row.full_name, role: row.primary_role, rate: row.rate,
    years: Math.floor(row.months_active / 12), months: row.months_active % 12,
    rating: row.rating_avg, ratingCount: row.rating_count, jobs: row.jobs_completed,
    color: row.avatar_color, verified: certs.includes('CNIC'), certs, rank,
  };
}
const allStaff = () => db.prepare(`SELECT u.full_name, p.* FROM staff_profiles p JOIN users u ON u.id = p.user_id`).all();

// bookings that block a person: any active booking on another event that overlaps this time window
function clashFor(staffId, ev, ignoreEventId = ev.id) {
  const rows = db.prepare(`SELECT b.status, e.* FROM bookings b JOIN events e ON e.id = b.event_id
    WHERE b.staff_id = ? AND b.status != 'dropped' AND e.id != ? AND e.date = ?`).all(staffId, ignoreEventId, ev.date);
  return rows.filter((r) => L.overlaps(r, ev));
}

function ownedEvent(req, id) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(id));
  if (!ev || ev.manager_id !== req.user.id) fail(404, 'NOT_FOUND', 'We could not find this event. It may have been deleted.');
  return ev;
}

function alternativesFor(ev, role, excludeIds) {
  return allStaff()
    .filter((s) => s.primary_role === role && !excludeIds.includes(s.user_id))
    .map(staffCard)
    .filter((c) => c.verified && clashFor(c.id, ev).length === 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3);
}

function eventDetail(ev) {
  const roles = db.prepare('SELECT * FROM event_roles WHERE event_id = ? ORDER BY id').all(ev.id);
  const bookings = db.prepare(`SELECT b.*, u.full_name, p.avatar_color FROM bookings b
    JOIN users u ON u.id = b.staff_id JOIN staff_profiles p ON p.user_id = b.staff_id
    WHERE b.event_id = ? AND b.status != 'dropped' ORDER BY b.id`).all(ev.id);
  const onEvent = bookings.map((b) => b.staff_id);
  let cost = 0; let conflicts = 0;
  const roleBlocks = roles.map((r) => {
    const people = bookings.filter((b) => b.role === r.role).map((b) => {
      cost += b.rate;
      const clash = b.status === 'invited'
        ? clashFor(b.staff_id, ev).filter((c) => c.status !== 'invited')
        : [];
      const conflict = clash.length > 0;
      if (conflict) conflicts += 1;
      return {
        bookingId: b.id, staffId: b.staff_id, name: b.full_name, role: b.role, rate: b.rate, status: b.status, color: b.avatar_color,
        conflict: conflict ? { with: clash[0].manager_id === ev.manager_id ? clash[0].name : null, alternatives: alternativesFor(ev, r.role, onEvent) } : null,
      };
    });
    return { ...r, filled: people.length, people };
  });
  const totalSlots = roles.reduce((a, r) => a + r.count, 0);
  const staffCount = bookings.length;
  return {
    event: ev,
    roles: roleBlocks,
    budget: { cost, cap: ev.budget_cap, left: ev.budget_cap - cost, percent: Math.round((cost / ev.budget_cap) * 100), alertAt: L.BUDGET_ALERT * 100 },
    totalSlots, staffCount, unfilled: totalSlots - staffCount, conflicts,
    confirmed: bookings.filter((b) => b.status !== 'invited').length,
    minStaff: L.minStaffFor(ev.guests),
    estimate: roles.reduce((a, r) => a + r.count * Math.round((r.rate_min + r.rate_max) / 2), 0),
  };
}

const roleSchema = z.object({
  role: z.enum(L.ROLES, { message: 'Pick a role from the list.' }),
  count: z.number({ message: 'Enter how many people you need.' }).int().min(1, 'At least 1 person.').max(200, 'At most 200 people per role.'),
  rateMin: z.number().int().min(500, 'Rate must be at least Rs 500.').max(20000),
  rateMax: z.number().int().min(500).max(20000, 'Rate must be at most Rs 20,000.'),
  uniform: z.enum(L.UNIFORMS, { message: 'Pick a uniform.' }),
}).refine((r) => r.rateMax >= r.rateMin, { message: 'The highest rate cannot be lower than the lowest rate.', path: ['rateMax'] });
const rolesSchema = z.array(roleSchema).min(1, 'Add at least one role.').max(10)
  .refine((rs2) => new Set(rs2.map((r) => r.role)).size === rs2.length, { message: 'Each role can only appear once. Change the count instead.' });

// ---------- manager: dashboard ----------
app.get('/api/dashboard', auth('manager'), wrap((req) => {
  const today = todayStr();
  const upcoming = db.prepare(`SELECT * FROM events WHERE manager_id = ? AND date >= ? AND status IN ('planned','confirmed') ORDER BY date, start_time`).all(req.user.id, today);
  const details = upcoming.map(eventDetail);
  const done = db.prepare(`SELECT * FROM events WHERE manager_id = ? AND actual_spend IS NOT NULL`).all(req.user.id);
  const capSum = done.reduce((a, e) => a + e.budget_cap, 0);
  const spentSum = done.reduce((a, e) => a + e.actual_spend, 0);
  const needsReview = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM bookings b WHERE b.event_id = e.id AND b.status != 'dropped') AS staff
    FROM events e WHERE manager_id = ? AND status = 'completed' ORDER BY date DESC`).all(req.user.id);
  const alertEv = details.find((d) => d.unfilled > 0 || d.conflicts > 0);
  return {
    name: req.user.full_name.split(' ')[0],
    alert: alertEv ? { eventId: alertEv.event.id, name: alertEv.event.name, date: alertEv.event.date, unfilled: alertEv.unfilled, total: alertEv.totalSlots, conflicts: alertEv.conflicts } : null,
    kpis: {
      upcoming: upcoming.length,
      staffConfirmed: details.reduce((a, d) => a + d.confirmed, 0),
      staffNeeded: details.reduce((a, d) => a + d.totalSlots, 0),
      budgetUsed: details.reduce((a, d) => a + d.budget.cost, 0),
      budgetCap: details.reduce((a, d) => a + d.budget.cap, 0),
      percentSaved: capSum ? Math.round(((capSum - spentSum) / capSum) * 1000) / 10 : 0,
    },
    upcoming: details.map((d) => ({
      id: d.event.id, name: d.event.name, type: d.event.type, date: d.event.date, start: d.event.start_time, end: d.event.end_time,
      venue: d.event.venue, guests: d.event.guests, filled: d.staffCount, total: d.totalSlots, cost: d.budget.cost, cap: d.budget.cap,
      conflicts: d.conflicts, status: d.event.status,
    })),
    needsReview: needsReview.map((e) => ({ id: e.id, name: e.name, date: e.date, staff: e.staff })),
  };
}));

// ---------- manager: events ----------
app.get('/api/events', auth('manager'), wrap((req) => {
  const rows = db.prepare(`SELECT * FROM events WHERE manager_id = ? AND status IN ('planned','confirmed') AND date >= ? ORDER BY date`).all(req.user.id, todayStr());
  return { events: rows.map((e) => ({ id: e.id, name: e.name, date: e.date, start: e.start_time, end: e.end_time })) };
}));

const eventSchema = z.object({
  name: z.string().trim().min(3, 'Event name must be at least 3 characters.').max(60, 'Event name is too long.'),
  type: z.enum(L.EVENT_TYPES, { message: 'Pick the type of event.' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a start time.'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick an end time.'),
  venue: z.string().trim().min(5, 'Enter the venue and area, e.g. Grand Marquee, Canal Road.').max(120),
  guests: z.number({ message: 'Enter the number of guests.' }).int('Guests must be a whole number.').min(1, 'At least 1 guest.').max(5000, 'For more than 5,000 guests, contact support.'),
  budgetCap: z.number({ message: 'Enter your labour budget.' }).int().min(1000, 'Budget must be at least Rs 1,000.').max(10_000_000),
  roles: rolesSchema,
}).superRefine((e, ctx) => {
  if (e.date < todayStr()) ctx.addIssue({ code: 'custom', path: ['date'], message: 'The date has already passed. Pick today or a later date.' });
  if (L.toMinutes(e.endTime) <= L.toMinutes(e.startTime)) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after the start time.' });
});

app.post('/api/events', auth('manager'), wrap((req) => {
  const e = parse(eventSchema, req.body);
  const id = tx(() => {
    const evId = Number(db.prepare(`INSERT INTO events (manager_id, name, type, date, start_time, end_time, venue, guests, budget_cap)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(req.user.id, e.name, e.type, e.date, e.startTime, e.endTime, e.venue, e.guests, e.budgetCap).lastInsertRowid);
    for (const r of e.roles) db.prepare('INSERT INTO event_roles (event_id, role, count, rate_min, rate_max, uniform) VALUES (?,?,?,?,?,?)')
      .run(evId, r.role, r.count, r.rateMin, r.rateMax, r.uniform);
    return evId;
  });
  notify(req.user.id, `${e.name} created`, `${e.roles.reduce((a, r) => a + r.count, 0)} slots are open. Start hiring from the marketplace.`, `/events/${id}/roster`);
  return { id };
}));

app.get('/api/events/:id', auth('manager'), wrap((req) => eventDetail(ownedEvent(req, req.params.id))));

app.put('/api/events/:id/plan', auth('manager'), wrap((req) => {
  const ev = ownedEvent(req, req.params.id);
  if (!['planned', 'confirmed'].includes(ev.status)) fail(409, 'EVENT_CLOSED', 'This event has finished, so its plan cannot be changed.');
  const b = parse(z.object({ roles: rolesSchema, budgetCap: z.number().int().min(1000).max(10_000_000) }), req.body);
  const booked = db.prepare(`SELECT role, COUNT(*) n FROM bookings WHERE event_id = ? AND status != 'dropped' GROUP BY role`).all(ev.id);
  for (const r of booked) {
    const planned = b.roles.find((x) => x.role === r.role);
    if (!planned) fail(422, 'VALIDATION', `${r.n} ${r.role.toLowerCase()} already hired. Drop them before removing this role.`);
    if (planned.count < r.n) fail(422, 'VALIDATION', `You already hired ${r.n} ${r.role.toLowerCase()}. The count cannot be lower than that.`);
  }
  const cost = db.prepare(`SELECT COALESCE(SUM(rate),0) c FROM bookings WHERE event_id = ? AND status != 'dropped'`).get(ev.id).c;
  if (b.budgetCap < cost) fail(422, 'VALIDATION', `Budget cannot be lower than what you already spent (${rs(cost)}).`);
  tx(() => {
    db.prepare('DELETE FROM event_roles WHERE event_id = ?').run(ev.id);
    for (const r of b.roles) db.prepare('INSERT INTO event_roles (event_id, role, count, rate_min, rate_max, uniform) VALUES (?,?,?,?,?,?)')
      .run(ev.id, r.role, r.count, r.rateMin, r.rateMax, r.uniform);
    db.prepare("UPDATE events SET budget_cap = ?, status = 'planned' WHERE id = ?").run(b.budgetCap, ev.id);
  });
  return eventDetail(db.prepare('SELECT * FROM events WHERE id = ?').get(ev.id));
}));

app.post('/api/events/:id/confirm', auth('manager'), wrap((req) => {
  const ev = ownedEvent(req, req.params.id);
  const d = eventDetail(ev);
  if (d.conflicts) fail(409, 'HAS_CONFLICTS', `${d.conflicts} worker${d.conflicts > 1 ? 's are' : ' is'} booked elsewhere. Replace or drop them before confirming.`);
  if (d.unfilled > 0 && !req.body?.allowUnfilled)
    fail(409, 'UNFILLED', `${d.unfilled} slot${d.unfilled > 1 ? 's are' : ' is'} still empty. Confirm anyway?`, { unfilled: d.unfilled });
  db.prepare("UPDATE events SET status = 'confirmed' WHERE id = ?").run(ev.id);
  const invited = db.prepare("SELECT staff_id FROM bookings WHERE event_id = ? AND status = 'invited'").all(ev.id);
  for (const i of invited) notify(i.staff_id, `Reminder: ${ev.name}`, 'Please accept or decline your shift invite.', '/shifts');
  return eventDetail(db.prepare('SELECT * FROM events WHERE id = ?').get(ev.id));
}));

// ---------- manager: marketplace ----------
app.get('/api/staff', auth('manager'), wrap((req) => {
  const q = parse(z.object({
    eventId: z.coerce.number().int().optional(),
    role: z.enum(L.ROLES).optional(),
    minRank: z.coerce.number().min(0).max(10).optional(),
    maxRate: z.coerce.number().int().min(0).optional(),
    cert: z.enum(['Food Safety', 'First Aid']).optional(),
    verified: z.enum(['1', '0']).default('1'),
    q: z.string().trim().max(60).optional(),
    sort: z.enum(['rank', 'rate_asc', 'rate_desc', 'rating']).default('rank'),
  }), req.query);
  const ev = q.eventId ? ownedEvent(req, q.eventId) : null;
  const onEvent = ev ? db.prepare("SELECT staff_id FROM bookings WHERE event_id = ? AND status != 'dropped'").all(ev.id).map((r) => r.staff_id) : [];
  let hiddenBooked = 0;
  let list = allStaff().map(staffCard).filter((c) => {
    if (onEvent.includes(c.id)) return false;
    if (ev && clashFor(c.id, ev).length) { hiddenBooked += 1; return false; } // FR-11
    return true;
  });
  const term = q.q?.toLowerCase();
  list = list.filter((c) =>
    (!q.role || c.role === q.role) && (q.minRank === undefined || c.rank >= q.minRank) &&
    (q.maxRate === undefined || c.rate <= q.maxRate) && (!q.cert || c.certs.includes(q.cert)) &&
    (q.verified === '0' || c.verified) && (!term || c.name.toLowerCase().includes(term) || c.role.toLowerCase().includes(term)));
  const sorters = { rank: (a, b) => b.rank - a.rank, rate_asc: (a, b) => a.rate - b.rate, rate_desc: (a, b) => b.rate - a.rate, rating: (a, b) => b.rating - a.rating };
  list.sort(sorters[q.sort]);
  return { staff: list, hiddenBooked, event: ev ? { id: ev.id, name: ev.name, date: ev.date, start: ev.start_time, end: ev.end_time } : null };
}));

app.get('/api/staff/:id', auth('manager', 'admin'), wrap((req) => {
  const row = db.prepare('SELECT u.full_name, p.* FROM staff_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?').get(Number(req.params.id));
  if (!row) fail(404, 'NOT_FOUND', 'This worker’s profile is not available any more.');
  const certs = approvedCerts(row.user_id);
  const { parts } = L.rankBreakdown(row, certs.length);
  const reviews = db.prepare('SELECT author, stars, comment, created_at FROM reviews WHERE staff_id = ? AND comment IS NOT NULL ORDER BY created_at DESC LIMIT 3').all(row.user_id);
  let bookedElsewhere = null;
  if (req.query.eventId && req.user.role === 'manager') {
    const ev = ownedEvent(req, req.query.eventId);
    const clash = clashFor(row.user_id, ev);
    if (clash.length) bookedElsewhere = { event: clash[0].manager_id === req.user.id ? clash[0].name : 'another event', start: clash[0].start_time, end: clash[0].end_time };
  }
  const docs = docStatus(row.user_id);
  const credentials = ['CNIC', 'Food Safety', 'First Aid'].map((t) => ({ type: t, status: docs.find((d) => d.doc_type === t)?.status || 'not_submitted' }));
  return { ...staffCard(row), parts, credentials, reviews, bookedElsewhere };
}));

// ---------- manager: hire / drop / undo ----------
app.post('/api/events/:id/bookings', auth('manager'), wrap((req) => {
  const ev = ownedEvent(req, req.params.id);
  const b = parse(z.object({ staffId: z.number().int(), role: z.enum(L.ROLES).optional() }), req.body);
  if (!['planned', 'confirmed'].includes(ev.status) || ev.date < todayStr()) fail(409, 'EVENT_CLOSED', 'This event has finished. You cannot hire for it any more.');
  const s = db.prepare('SELECT u.full_name, p.* FROM staff_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?').get(b.staffId);
  if (!s) fail(404, 'NOT_FOUND', 'This worker is not available any more.');
  const role = b.role || s.primary_role;
  const plan = db.prepare('SELECT * FROM event_roles WHERE event_id = ? AND role = ?').get(ev.id, role);
  if (!plan) fail(422, 'NO_ROLE', `This event has no ${role.toLowerCase()} slots. Add the role in “Edit plan” first.`);
  if (role !== s.primary_role) fail(422, 'WRONG_ROLE', `${s.full_name} works as ${s.primary_role.toLowerCase()}, not ${role.toLowerCase()}.`);
  if (!approvedCerts(s.user_id).includes('CNIC')) fail(422, 'NOT_VERIFIED', `${s.full_name} is not verified yet. Only Verified Pro staff can be hired.`);
  if (db.prepare("SELECT 1 FROM bookings WHERE event_id = ? AND staff_id = ? AND status != 'dropped'").get(ev.id, s.user_id))
    fail(409, 'ALREADY_HIRED', `${s.full_name} is already on this roster.`);
  const filled = db.prepare("SELECT COUNT(*) n FROM bookings WHERE event_id = ? AND role = ? AND status != 'dropped'").get(ev.id, role).n;
  if (filled >= plan.count) fail(409, 'ROLE_FULL', `All ${plan.count} ${role.toLowerCase()} slots are filled. Drop someone or raise the count in “Edit plan”.`);
  const clash = clashFor(s.user_id, ev);
  if (clash.length) {
    const onEvent = db.prepare("SELECT staff_id FROM bookings WHERE event_id = ? AND status != 'dropped'").all(ev.id).map((r) => r.staff_id);
    fail(409, 'CONFLICT', `${s.full_name} is already booked ${clash[0].start_time}–${clash[0].end_time} that day.`, { alternatives: alternativesFor(ev, role, onEvent) });
  }
  const cost = db.prepare("SELECT COALESCE(SUM(rate),0) c FROM bookings WHERE event_id = ? AND status != 'dropped'").get(ev.id).c;
  if (cost + s.rate > ev.budget_cap)
    fail(422, 'OVER_BUDGET', `Hiring ${s.full_name} would go ${rs(cost + s.rate - ev.budget_cap)} over your labour budget of ${rs(ev.budget_cap)}.`);
  const id = Number(db.prepare("INSERT INTO bookings (event_id, staff_id, role, rate, status) VALUES (?,?,?,?, 'invited')").run(ev.id, s.user_id, role, s.rate).lastInsertRowid);
  notify(s.user_id, `New shift invite: ${ev.name}`, `${role} · ${ev.date} ${ev.start_time}–${ev.end_time} · ${rs(s.rate)}`, '/shifts');
  const detail = eventDetail(ev);
  return { bookingId: id, name: s.full_name, rate: s.rate, ...detail, budgetAlert: detail.budget.percent >= L.BUDGET_ALERT * 100 };
}));

function ownedBooking(req) {
  const bk = db.prepare('SELECT b.*, u.full_name FROM bookings b JOIN users u ON u.id = b.staff_id WHERE b.id = ?').get(Number(req.params.id));
  if (!bk) fail(404, 'NOT_FOUND', 'This booking no longer exists.');
  const ev = ownedEvent(req, bk.event_id);
  return { bk, ev };
}

app.post('/api/bookings/:id/drop', auth('manager'), wrap((req) => {
  const { bk, ev } = ownedBooking(req);
  if (bk.status === 'dropped') fail(409, 'ALREADY_DROPPED', `${bk.full_name} was already dropped.`);
  if (ev.status === 'completed' || ev.status === 'reviewed') fail(409, 'EVENT_CLOSED', 'This event has finished. Its roster cannot change.');
  const remaining = db.prepare("SELECT COUNT(*) n FROM bookings WHERE event_id = ? AND status != 'dropped'").get(ev.id).n - 1;
  const min = L.minStaffFor(ev.guests);
  if (remaining < min && !req.body?.confirmRatio) // FR-16
    fail(409, 'RATIO_WARNING', `After this drop you will have ${remaining} staff for ${ev.guests} guests. We suggest at least ${min} (1 per 30 guests).`, { remaining, min });
  db.prepare("UPDATE bookings SET status = 'dropped', dropped_at = ? WHERE id = ?").run(nowSql(), bk.id);
  audit(req.user.id, 'drop', `booking:${bk.id}`, bk.full_name);
  return { bookingId: bk.id, name: bk.full_name, saved: bk.rate, undoSeconds: L.UNDO_WINDOW_MS / 1000, ...eventDetail(ev) };
}));

app.post('/api/bookings/:id/undo', auth('manager'), wrap((req) => {
  const { bk, ev } = ownedBooking(req);
  if (bk.status !== 'dropped') fail(409, 'NOT_DROPPED', 'Nothing to undo.');
  if (Date.now() - sqlToMs(bk.dropped_at) > L.UNDO_WINDOW_MS + L.UNDO_GRACE_MS)
    fail(410, 'UNDO_EXPIRED', `Undo time is over. Hire ${bk.full_name} again from the marketplace if you still need them.`);
  if (clashFor(bk.staff_id, ev).length) fail(409, 'CONFLICT', `${bk.full_name} took another shift in the meantime.`);
  const plan = db.prepare('SELECT count FROM event_roles WHERE event_id = ? AND role = ?').get(ev.id, bk.role);
  const filled = db.prepare("SELECT COUNT(*) n FROM bookings WHERE event_id = ? AND role = ? AND status != 'dropped'").get(ev.id, bk.role).n;
  if (!plan || filled >= plan.count) fail(409, 'ROLE_FULL', 'That slot has been filled by someone else.');
  db.prepare("UPDATE bookings SET status = 'invited', dropped_at = NULL WHERE id = ?").run(bk.id);
  audit(req.user.id, 'undo_drop', `booking:${bk.id}`, bk.full_name);
  return { bookingId: bk.id, name: bk.full_name, ...eventDetail(ev) };
}));

// ---------- manager: post-event review ----------
app.get('/api/events/:id/review', auth('manager'), wrap((req) => {
  const ev = ownedEvent(req, req.params.id);
  const people = db.prepare(`SELECT b.staff_id, b.role, u.full_name, p.avatar_color, r.stars, r.tags, r.comment
    FROM bookings b JOIN users u ON u.id = b.staff_id JOIN staff_profiles p ON p.user_id = b.staff_id
    LEFT JOIN reviews r ON r.event_id = b.event_id AND r.staff_id = b.staff_id
    WHERE b.event_id = ? AND b.status != 'dropped' ORDER BY b.role, u.full_name`).all(ev.id);
  return {
    event: ev, tags: L.REVIEW_TAGS,
    people: people.map((p) => ({ staffId: p.staff_id, name: p.full_name, role: p.role, color: p.avatar_color, stars: p.stars || 0, tags: p.tags ? JSON.parse(p.tags) : [], comment: p.comment || '' })),
  };
}));

app.post('/api/events/:id/reviews', auth('manager'), wrap((req) => {
  const ev = ownedEvent(req, req.params.id);
  if (!['completed', 'reviewed'].includes(ev.status)) fail(409, 'NOT_FINISHED', 'You can review staff only after the event has finished.');
  const b = parse(z.object({
    reviews: z.array(z.object({
      staffId: z.number().int(),
      stars: z.number().int().min(1, 'Give at least 1 star.').max(5),
      tags: z.array(z.enum(L.REVIEW_TAGS)).max(5).default([]),
      comment: z.string().trim().max(300, 'Comments can be at most 300 characters.').optional(),
    }).refine((r) => !(r.tags.includes('Absent') && r.tags.length > 1), { message: '“Absent” cannot be combined with other tags.' }))
      .min(1, 'Rate at least one person before submitting.'),
  }), req.body);
  const onEvent = db.prepare("SELECT staff_id FROM bookings WHERE event_id = ? AND status != 'dropped'").all(ev.id).map((r) => r.staff_id);
  tx(() => {
    for (const r of b.reviews) {
      if (!onEvent.includes(r.staffId)) fail(422, 'VALIDATION', 'One of these people did not work at this event.');
      const old = db.prepare('SELECT stars FROM reviews WHERE event_id = ? AND staff_id = ?').get(ev.id, r.staffId);
      const p = db.prepare('SELECT rating_avg, rating_count, jobs_completed FROM staff_profiles WHERE user_id = ?').get(r.staffId);
      if (old) {
        const avg = p.rating_count > 0 ? (p.rating_avg * p.rating_count - old.stars + r.stars) / p.rating_count : r.stars;
        db.prepare('UPDATE staff_profiles SET rating_avg = ? WHERE user_id = ?').run(Math.round(avg * 100) / 100, r.staffId);
        db.prepare('UPDATE reviews SET stars = ?, tags = ?, comment = ? WHERE event_id = ? AND staff_id = ?').run(r.stars, JSON.stringify(r.tags), r.comment || null, ev.id, r.staffId);
      } else {
        const count = p.rating_count + 1;
        const avg = (p.rating_avg * p.rating_count + r.stars) / count;
        const jobs = p.jobs_completed + (r.tags.includes('Absent') ? 0 : 1);
        db.prepare('UPDATE staff_profiles SET rating_avg = ?, rating_count = ?, jobs_completed = ? WHERE user_id = ?').run(Math.round(avg * 100) / 100, count, jobs, r.staffId);
        db.prepare('INSERT INTO reviews (event_id, staff_id, author, stars, tags, comment) VALUES (?,?,?,?,?,?)')
          .run(ev.id, r.staffId, req.user.company || req.user.full_name, r.stars, JSON.stringify(r.tags), r.comment || null);
      }
    }
    const rated = db.prepare('SELECT COUNT(*) n FROM reviews WHERE event_id = ?').get(ev.id).n;
    if (rated >= onEvent.length) db.prepare("UPDATE events SET status = 'reviewed' WHERE id = ?").run(ev.id);
  });
  const rated = db.prepare('SELECT COUNT(*) n FROM reviews WHERE event_id = ?').get(ev.id).n;
  return { rated, total: onEvent.length, complete: rated >= onEvent.length };
}));

// ---------- manager: analytics ----------
app.get('/api/analytics', auth('manager'), wrap((req) => {
  const q = parse(z.object({ month: z.string().regex(/^(all|\d{4}-\d{2})$/).default('all'), type: z.string().default('all') }), req.query);
  const all = db.prepare('SELECT * FROM events WHERE manager_id = ? AND actual_spend IS NOT NULL ORDER BY date').all(req.user.id);
  const months = [...new Set(all.map((e) => e.date.slice(0, 7)))].reverse();
  const types = [...new Set(all.map((e) => e.type))].sort();
  const rows = all.filter((e) => (q.month === 'all' || e.date.startsWith(q.month)) && (q.type === 'all' || e.type === q.type));
  const budget = rows.reduce((a, e) => a + e.budget_cap, 0);
  const actual = rows.reduce((a, e) => a + e.actual_spend, 0);
  const trendMap = {};
  for (const e of all.filter((x) => q.type === 'all' || x.type === q.type)) {
    const m = e.date.slice(0, 7);
    trendMap[m] = (trendMap[m] || 0) + (e.budget_cap - e.actual_spend);
  }
  return {
    months, types,
    kpis: { budget, actual, saved: budget - actual, percent: budget ? Math.round(((budget - actual) / budget) * 1000) / 10 : 0, events: rows.length },
    perEvent: rows.map((e) => ({ id: e.id, name: e.name, date: e.date, type: e.type, budget: e.budget_cap, actual: e.actual_spend })),
    trend: Object.entries(trendMap).sort().slice(-6).map(([month, saved]) => ({ month, saved })),
  };
}));

// ---------- notifications ----------
app.get('/api/notifications', auth(), wrap((req) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  return { items: rows.map((n) => ({ ...n, is_read: !!n.is_read })), unread: rows.filter((n) => !n.is_read).length };
}));
app.post('/api/notifications/read-all', auth(), wrap((req) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id); return { ok: true };
}));
app.post('/api/notifications/:id/read', auth(), wrap((req) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id); return { ok: true };
}));
app.delete('/api/notifications/:id', auth(), wrap((req) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id); return { ok: true };
}));

// ---------- admin: audit queue ----------
function queueRows(filter = 'all', sort = 'oldest') {
  let rows = db.prepare(`SELECT d.*, u.full_name FROM documents d JOIN users u ON u.id = d.staff_id WHERE d.status = 'pending'`).all();
  if (filter === 'CNIC') rows = rows.filter((r) => r.doc_type === 'CNIC');
  if (filter === 'Certificate') rows = rows.filter((r) => r.doc_type !== 'CNIC');
  if (filter === 'Resubmission') rows = rows.filter((r) => r.is_resubmission);
  if (filter === 'Today') rows = rows.filter((r) => Date.now() - sqlToMs(r.submitted_at) < 24 * 3600_000);
  rows.sort((a, b) => (sort === 'oldest' ? sqlToMs(a.submitted_at) - sqlToMs(b.submitted_at) : sqlToMs(b.submitted_at) - sqlToMs(a.submitted_at)));
  return rows;
}
const hoursAgo = (s) => Math.max(0, Math.floor((Date.now() - sqlToMs(s)) / 3600_000));

app.get('/api/admin/queue', auth('admin'), wrap((req) => {
  const q = parse(z.object({ filter: z.enum(['all', 'CNIC', 'Certificate', 'Resubmission', 'Today']).default('all'), sort: z.enum(['oldest', 'newest']).default('oldest') }), req.query);
  const everything = queueRows();
  const rows = queueRows(q.filter, q.sort);
  return {
    pending: everything.length,
    oldestHours: everything.length ? hoursAgo(everything[0].submitted_at) : 0,
    items: rows.map((r) => ({ id: r.id, worker: r.full_name, staffId: r.staff_id, docType: r.doc_type, hours: hoursAgo(r.submitted_at), resubmission: !!r.is_resubmission })),
  };
}));

app.get('/api/admin/documents/:id', auth('admin'), wrap((req) => {
  const doc = db.prepare('SELECT d.*, u.full_name, u.phone FROM documents d JOIN users u ON u.id = d.staff_id WHERE d.id = ?').get(Number(req.params.id));
  if (!doc) fail(404, 'NOT_FOUND', 'This document was not found. It may have been withdrawn by the worker.');
  const p = db.prepare('SELECT * FROM staff_profiles WHERE user_id = ?').get(doc.staff_id);
  const q = queueRows(String(req.query.filter || 'all'), String(req.query.sort || 'oldest'));
  const idx = q.findIndex((r) => r.id === doc.id);
  const reviewer = doc.reviewed_by ? db.prepare('SELECT full_name FROM users WHERE id = ?').get(doc.reviewed_by)?.full_name : null;
  return {
    id: doc.id, docType: doc.doc_type, status: doc.status, worker: doc.full_name, staffId: doc.staff_id, resubmission: !!doc.is_resubmission,
    submittedHours: hoursAgo(doc.submitted_at), reviewer, rejectReasons: doc.reject_reasons ? JSON.parse(doc.reject_reasons) : [], rejectMessage: doc.reject_message,
    profile: { fatherName: p.father_name || '—', dob: p.dob || '—', cnic: p.cnic_masked || '—', role: p.primary_role, phone: maskPhone(doc.phone) },
    position: idx >= 0 ? idx + 1 : null, total: q.length,
    prevId: idx > 0 ? q[idx - 1].id : null, nextId: idx >= 0 && idx < q.length - 1 ? q[idx + 1].id : (idx < 0 && q.length ? q[0].id : null),
    reasons: L.REJECT_REASONS,
  };
}));

function pendingDoc(req) {
  const doc = db.prepare('SELECT d.*, u.full_name FROM documents d JOIN users u ON u.id = d.staff_id WHERE d.id = ?').get(Number(req.params.id));
  if (!doc) fail(404, 'NOT_FOUND', 'This document was not found.');
  if (doc.status !== 'pending') {
    const who = db.prepare('SELECT full_name FROM users WHERE id = ?').get(doc.reviewed_by)?.full_name || 'another admin';
    fail(409, 'ALREADY_REVIEWED', `This document was already ${doc.status} by ${who}.`);
  }
  return doc;
}

app.post('/api/admin/documents/:id/approve', auth('admin'), wrap((req) => {
  const doc = pendingDoc(req);
  db.prepare("UPDATE documents SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(nowSql(), req.user.id, doc.id);
  audit(req.user.id, 'approve', `document:${doc.id}`, `${doc.full_name} · ${doc.doc_type}`);
  notify(doc.staff_id, doc.doc_type === 'CNIC' ? 'You are now Verified Pro' : `${doc.doc_type} certificate approved`,
    doc.doc_type === 'CNIC' ? 'Managers can now hire you from the marketplace.' : 'It now shows on your profile.', '/profile');
  return { ok: true, worker: doc.full_name, docType: doc.doc_type };
}));

app.post('/api/admin/documents/:id/reject', auth('admin'), wrap((req) => {
  const doc = pendingDoc(req);
  const b = parse(z.object({
    reasons: z.array(z.enum(L.REJECT_REASONS)).min(1, 'Pick at least one reason.'),
    message: z.string().trim().min(10, 'Write a short message (at least 10 characters) so the worker knows what to fix.').max(300, 'Message can be at most 300 characters.'),
  }), req.body);
  db.prepare("UPDATE documents SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, reject_reasons = ?, reject_message = ? WHERE id = ?")
    .run(nowSql(), req.user.id, JSON.stringify(b.reasons), b.message, doc.id);
  audit(req.user.id, 'reject', `document:${doc.id}`, `${b.reasons.join(', ')} · ${b.message}`);
  notify(doc.staff_id, `${doc.doc_type} needs a new photo`, b.message, '/verify'); // FR-07: reason shown to staff
  return { ok: true, worker: doc.full_name, docType: doc.doc_type };
}));

app.get('/api/admin/reviewed', auth('admin'), wrap(() => {
  const rows = db.prepare(`SELECT d.*, u.full_name, a.full_name AS reviewer FROM documents d JOIN users u ON u.id = d.staff_id
    LEFT JOIN users a ON a.id = d.reviewed_by WHERE d.status != 'pending' AND d.reviewed_at IS NOT NULL ORDER BY d.reviewed_at DESC LIMIT 60`).all();
  return { items: rows.map((r) => ({ id: r.id, worker: r.full_name, docType: r.doc_type, status: r.status, reviewer: r.reviewer, reviewedAt: r.reviewed_at, reasons: r.reject_reasons ? JSON.parse(r.reject_reasons) : [] })) };
}));

// ---------- errors + static ----------
app.use('/api', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'This address does not exist.')));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof ApiError) return res.status(err.status).json({ code: err.code, message: err.message, ...err.extra });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ code: 'BAD_JSON', message: 'The request could not be read.' });
  console.error(err);
  res.status(500).json({ code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again in a minute.' });
});

const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`EventFlow Pro API on http://localhost:${PORT}`));
}
module.exports = app;
