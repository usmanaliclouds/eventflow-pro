// Fills the database with realistic demo data. Dates are relative to today,
// so upcoming events stay upcoming whenever you run it.
//   npm run seed           -> wipe and refill
const fs = require('fs');
const bcrypt = require('bcryptjs');

const { DB_FILE } = require('./db');
// start from a clean file
const { db } = (() => {
  try { require('./db').db.close(); } catch { /* ignore */ }
  for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) if (fs.existsSync(f)) fs.unlinkSync(f);
  delete require.cache[require.resolve('./db')];
  return require('./db');
})();

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ago = (hours) => new Date(Date.now() - hours * 3600_000).toISOString().replace('T', ' ').slice(0, 19);
const monthDay = (monthsBack, dayOfMonth) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsBack);
  d.setDate(dayOfMonth);
  return d.toISOString().slice(0, 10);
};

const hash = (p) => bcrypt.hashSync(p, 10);
const insUser = db.prepare(`INSERT INTO users (role, full_name, phone, company, password_hash, language)
  VALUES (?, ?, ?, ?, ?, ?)`);
const addUser = (role, name, phone, pw, company = null, lang = 'en') =>
  Number(insUser.run(role, name, phone, company, hash(pw), lang).lastInsertRowid);

// ---------- accounts ----------
const tariq = addUser('manager', 'Tariq Mehmood', '03001234567', 'Manager@123', 'Mehmood Events, Faisalabad');
const royal = addUser('manager', 'Kamran Butt', '03007654321', 'Manager@123', 'Royal Caterers');
const admin = addUser('admin', 'Farah Naz', '03111234567', 'Admin@123', 'EventFlow Pro');

// ---------- staff ----------
const COLORS = ['#A5ACF0', '#E99A1C', '#C27C0A', '#C6303E', '#7FD3E6', '#1F8A4C', '#F2A7B8', '#3443B0', '#9BE3A6', '#F4E3A1'];
const staffList = [
  // name, role, rate, months, rating, count, jobs, certs[], phone suffix
  ['Bilal Khan', 'Waiter', 1900, 27, 4.7, 126, 126, ['CNIC', 'Food Safety']],
  ['Ali Khan', 'Waiter', 1600, 24, 4.6, 90, 98, ['CNIC', 'Food Safety']],
  ['Zahid Khan', 'Waiter', 1900, 26, 4.6, 96, 110, ['CNIC', 'Food Safety', 'First Aid']],
  ['Ayesha Khan', 'Waiter', 1800, 22, 4.8, 84, 88, ['CNIC', 'Food Safety']],
  ['Imran Ali', 'Waiter', 1900, 27, 4.7, 126, 126, ['CNIC', 'Food Safety']],
  ['Zahid Ali', 'Waiter', 1800, 20, 4.5, 70, 75, ['CNIC']],
  ['Saeed Akhtar', 'Waiter', 1750, 18, 4.5, 61, 64, ['CNIC', 'Food Safety']],
  ['Usman Tariq', 'Waiter', 1900, 30, 4.6, 112, 118, ['CNIC', 'Food Safety']],
  ['Rehman Khan', 'Waiter', 1850, 25, 4.6, 98, 101, ['CNIC', 'Food Safety']],
  ['Raza Khan', 'Waiter', 1300, 9, 4.2, 22, 24, ['CNIC']],
  ['Hamza Shah', 'Waiter', 1700, 16, 4.4, 51, 55, ['CNIC', 'Food Safety']],
  ['Ayesha Riaz', 'Waiter', 1950, 33, 4.9, 140, 146, ['CNIC', 'Food Safety', 'First Aid']],
  ['Fahad Iqbal', 'Waiter', 1500, 12, 4.3, 34, 36, ['CNIC']],
  ['Mariam Siddiqui', 'Waiter', 1850, 21, 4.7, 77, 80, ['CNIC', 'Food Safety']],
  ['Danish Javed', 'Waiter', 1600, 14, 4.4, 40, 42, ['CNIC', 'Food Safety']],
  ['Kashif Mehmood', 'Waiter', 1400, 7, 4.1, 15, 16, ['CNIC']],
  ['Sana Tariq', 'Waiter', 2000, 36, 4.8, 150, 158, ['CNIC', 'Food Safety', 'First Aid']],
  ['Owais Raza', 'Waiter', 1550, 11, 4.3, 29, 30, []],
  ['Nabeel Ahmed', 'Waiter', 1650, 15, 4.5, 47, 49, ['CNIC', 'Food Safety']],
  ['Adeel Qureshi', 'Waiter', 1750, 19, 4.6, 66, 70, ['CNIC', 'Food Safety']],
  ['Bilal Hussain', 'Security', 2200, 28, 4.7, 101, 104, ['CNIC', 'First Aid']],
  ['Shahid Abbas', 'Security', 2300, 31, 4.6, 112, 115, ['CNIC', 'First Aid']],
  ['Naveed Akram', 'Security', 2000, 17, 4.4, 55, 58, ['CNIC']],
  ['Tahir Mahmood', 'Security', 2500, 40, 4.8, 160, 166, ['CNIC', 'First Aid']],
  ['Asad Rafiq', 'Security', 2100, 13, 4.3, 38, 40, ['CNIC']],
  ['Rabia Khan', 'Sound tech', 3000, 34, 4.8, 92, 95, ['CNIC']],
  ['Junaid Aslam', 'Sound tech', 3200, 29, 4.6, 70, 72, ['CNIC']],
  ['Hassan Raza', 'Sound tech', 2800, 15, 4.4, 33, 35, ['CNIC']],
  ['Hina Pervaiz', 'Usher', 1500, 19, 4.6, 63, 66, ['CNIC']],
  ['Komal Shahid', 'Usher', 1400, 10, 4.5, 27, 28, ['CNIC']],
  ['Waseem Akbar', 'Cleaner', 1200, 23, 4.5, 80, 84, ['CNIC']],
  ['Shazia Bibi', 'Cleaner', 1100, 14, 4.4, 45, 47, ['CNIC']],
  // workers who are waiting for the admin (audit queue)
  ['Sajid Hussain', 'Waiter', 1500, 2, 0, 0, 0, []],
  ['Nadia Bibi', 'Waiter', 1400, 1, 0, 0, 0, []],
  ['Arslan Ahmed', 'Security', 2000, 3, 0, 0, 0, []],
  ['Waqas Ali', 'Usher', 1300, 2, 0, 0, 0, []],
  ['Rizwan Khan', 'Waiter', 1500, 1, 0, 0, 0, []],
  ['Muhammad Asif', 'Waiter', 1600, 2, 0, 0, 0, []],
  ['Iqra Naveed', 'Waiter', 1450, 1, 0, 0, 0, []],
  ['Faisal Mehmood', 'Cleaner', 1100, 1, 0, 0, 0, []],
  ['Asif Mehmood', 'Waiter', 1500, 1, 0, 0, 0, []],
];

const DEMO_PHONES = { 'Bilal Khan': '03211234567', 'Asif Mehmood': '03219876543' };
const FATHERS = ['Muhammad Akram', 'Abdul Rasheed', 'Ghulam Nabi', 'Muhammad Iqbal', 'Riaz Ahmed', 'Javed Akhtar', 'Shaukat Ali', 'Nazir Hussain'];
const insProfile = db.prepare(`INSERT INTO staff_profiles
  (user_id, primary_role, rate, months_active, rating_avg, rating_count, jobs_completed, avatar_color, father_name, dob, cnic_masked)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const insDoc = db.prepare(`INSERT INTO documents (staff_id, doc_type, status, is_resubmission, submitted_at, reviewed_at, reviewed_by, reject_reasons, reject_message)
  VALUES (?,?,?,?,?,?,?,?,?)`);

const staff = {}; // name -> id
staffList.forEach(([name, role, rate, months, rating, count, jobs, certs], i) => {
  const phone = DEMO_PHONES[name] || '0321' + String(1000000 + i * 7919).slice(-7);
  const id = addUser('staff', name, phone, 'Staff@123', null, DEMO_PHONES[name] || i % 3 ? 'en' : 'ur');
  const year = 1990 + (i % 14);
  insProfile.run(id, role, rate, months, rating, count, jobs, COLORS[i % COLORS.length],
    FATHERS[i % FATHERS.length], `${year}-0${(i % 9) + 1}-1${i % 9}`, `33100-•••••••-${(i * 37) % 10}`);
  for (const c of certs) insDoc.run(id, c, 'approved', 0, ago(24 * (60 + i)), ago(24 * (58 + i)), admin, null, null);
  staff[name] = id;
});

// Audit queue: pending documents (submitted N hours ago)
const pending = [
  ['Sajid Hussain', 'CNIC', 22, 0], ['Nadia Bibi', 'Food Safety', 26, 0], ['Arslan Ahmed', 'CNIC', 15, 0],
  ['Waqas Ali', 'First Aid', 9, 0], ['Rizwan Khan', 'CNIC', 4, 0], ['Muhammad Asif', 'CNIC', 20, 0],
  ['Iqra Naveed', 'CNIC', 3, 1], ['Faisal Mehmood', 'CNIC', 11, 0], ['Raza Khan', 'Food Safety', 6, 0],
  ['Owais Raza', 'CNIC', 18, 1], ['Zahid Ali', 'Food Safety', 2, 0], ['Kashif Mehmood', 'First Aid', 1, 0],
  ['Imran Ali', 'First Aid', 30, 0],
];
for (const [n, t, h, r] of pending) insDoc.run(staff[n], t, 'pending', r, ago(h), null, null, null, null);
// one earlier rejection (shows in "Reviewed")
insDoc.run(staff['Owais Raza'], 'CNIC', 'rejected', 0, ago(72), ago(60), admin,
  JSON.stringify(['Blurry photo']), 'Your CNIC photo is blurry. Please retake it in good light with all four corners visible.');
insDoc.run(staff['Iqra Naveed'], 'CNIC', 'rejected', 0, ago(50), ago(40), admin,
  JSON.stringify(['Corners cut off']), 'Two corners of the card are cut off. Please place the full card inside the frame.');

// ---------- events ----------
const insEvent = db.prepare(`INSERT INTO events (manager_id, name, type, date, start_time, end_time, venue, guests, budget_cap, status, actual_spend)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const insRole = db.prepare('INSERT INTO event_roles (event_id, role, count, rate_min, rate_max, uniform) VALUES (?,?,?,?,?,?)');
const insBooking = db.prepare('INSERT INTO bookings (event_id, staff_id, role, rate, status) VALUES (?,?,?,?,?)');
const rateOf = db.prepare('SELECT rate FROM staff_profiles WHERE user_id = ?');
const book = (ev, name, role, status) => insBooking.run(ev, staff[name], role, rateOf.get(staff[name]).rate, status);
const event = (mgr, name, type, date, s, e, venue, guests, cap, status = 'planned', actual = null) =>
  Number(insEvent.run(mgr, name, type, date, s, e, venue, guests, cap, status, actual).lastInsertRowid);

// Upcoming
const aslam = event(tariq, 'Aslam Wedding', 'Wedding', day(6), '18:00', '23:00', 'Grand Marquee, Canal Road, Faisalabad', 300, 32000);
insRole.run(aslam, 'Waiter', 12, 1500, 2000, 'Black & white formal');
insRole.run(aslam, 'Security', 3, 2000, 2500, 'Black suit');
insRole.run(aslam, 'Sound tech', 1, 2800, 3200, 'Own clothes');
book(aslam, 'Bilal Khan', 'Waiter', 'confirmed');
book(aslam, 'Usman Tariq', 'Waiter', 'confirmed');
book(aslam, 'Zahid Khan', 'Waiter', 'invited');
book(aslam, 'Saeed Akhtar', 'Waiter', 'invited'); // becomes a conflict (booked elsewhere below)
book(aslam, 'Rehman Khan', 'Waiter', 'confirmed');
book(aslam, 'Ayesha Khan', 'Waiter', 'confirmed');
book(aslam, 'Mariam Siddiqui', 'Waiter', 'uniform_ready');
book(aslam, 'Danish Javed', 'Waiter', 'confirmed');
book(aslam, 'Nabeel Ahmed', 'Waiter', 'confirmed');
book(aslam, 'Bilal Hussain', 'Security', 'confirmed');
book(aslam, 'Naveed Akram', 'Security', 'invited');
book(aslam, 'Rabia Khan', 'Sound tech', 'confirmed');

// another manager's event at the same time -> Saeed is booked elsewhere
const malik = event(royal, 'Malik Mehndi', 'Mehndi', day(6), '19:00', '23:30', 'PC Marquee, Jaranwala Road', 200, 30000, 'confirmed');
insRole.run(malik, 'Waiter', 8, 1500, 2000, 'Shalwar kameez (white)');
book(malik, 'Saeed Akhtar', 'Waiter', 'confirmed');
book(malik, 'Kashif Mehmood', 'Waiter', 'confirmed');
book(malik, 'Hamza Shah', 'Waiter', 'confirmed');

const sheikh = event(tariq, 'Sheikh Mehndi', 'Mehndi', day(13), '19:00', '23:59', 'Serena Hotel Lawn, Club Road', 150, 18000);
insRole.run(sheikh, 'Waiter', 5, 1500, 2000, 'Shalwar kameez (white)');
insRole.run(sheikh, 'Usher', 2, 1300, 1600, 'Branded polo');
for (const n of ['Sana Tariq', 'Ayesha Riaz', 'Imran Ali', 'Adeel Qureshi', 'Ali Khan']) book(sheikh, n, 'Waiter', 'confirmed');
book(sheikh, 'Hina Pervaiz', 'Usher', 'confirmed');
book(sheikh, 'Komal Shahid', 'Usher', 'invited');

const expo = event(tariq, 'Tech Expo 2026', 'Expo', day(20), '10:00', '18:00', 'Faisalabad Expo Centre, Hall B', 600, 45000);
insRole.run(expo, 'Usher', 6, 1300, 1600, 'Branded polo');
insRole.run(expo, 'Security', 4, 2000, 2500, 'Black suit');
insRole.run(expo, 'Cleaner', 3, 1000, 1300, 'Own clothes');
book(expo, 'Hina Pervaiz', 'Usher', 'confirmed');
book(expo, 'Shahid Abbas', 'Security', 'confirmed');
book(expo, 'Tahir Mahmood', 'Security', 'invited');
book(expo, 'Waseem Akbar', 'Cleaner', 'confirmed');

const corp = event(tariq, 'Nishat Annual Dinner', 'Corporate', day(27), '19:30', '23:00', 'Faisalabad Serena, Ballroom', 250, 30000);
insRole.run(corp, 'Waiter', 9, 1600, 2000, 'Black & white formal');
insRole.run(corp, 'Security', 2, 2000, 2500, 'Black suit');
book(corp, 'Bilal Khan', 'Waiter', 'invited');
book(corp, 'Sana Tariq', 'Waiter', 'confirmed');

// Completed, waiting for review
const khan = event(tariq, 'Khan Walima', 'Walima', day(-9), '13:00', '17:00', 'Royal Palm Marquee, Satiana Road', 350, 28000, 'completed', 24350);
insRole.run(khan, 'Waiter', 10, 1500, 2000, 'Black & white formal');
insRole.run(khan, 'Security', 2, 2000, 2500, 'Black suit');
for (const n of ['Bilal Khan', 'Ayesha Khan', 'Raza Khan', 'Ali Khan', 'Fahad Iqbal', 'Danish Javed', 'Nabeel Ahmed', 'Owais Raza', 'Kashif Mehmood', 'Rehman Khan'])
  book(khan, n, 'Waiter', 'confirmed');
book(khan, 'Naveed Akram', 'Security', 'confirmed');
book(khan, 'Asad Rafiq', 'Security', 'confirmed');

const bank = event(tariq, 'Bank Gala Dinner', 'Gala dinner', day(-11), '20:00', '23:30', 'Avari Hall, Jail Road', 220, 26000, 'completed', 22600);
insRole.run(bank, 'Waiter', 8, 1600, 2000, 'Black & white formal');
insRole.run(bank, 'Sound tech', 1, 2800, 3200, 'Own clothes');
for (const n of ['Sana Tariq', 'Ayesha Riaz', 'Mariam Siddiqui', 'Usman Tariq', 'Zahid Khan', 'Adeel Qureshi', 'Hamza Shah', 'Imran Ali'])
  book(bank, n, 'Waiter', 'confirmed');
book(bank, 'Junaid Aslam', 'Sound tech', 'confirmed');

// Past, reviewed (feed the analytics page)
const past = [
  ['Pearl Continental Gala', 'Gala dinner', 5, 12, 40000, 37200],
  ['Chaudhry Mehndi', 'Mehndi', 4, 8, 22000, 21100],
  ['Ali Walima', 'Walima', 4, 22, 30000, 27900],
  ['Textile Expo', 'Expo', 3, 15, 52000, 47800],
  ['Rana Wedding', 'Wedding', 2, 6, 36000, 33400],
  ['Sapphire Launch', 'Corporate', 2, 25, 24000, 21300],
  ['Gondal Walima', 'Walima', 1, 9, 31000, 28200],
  ['Lyallpur Gala', 'Gala dinner', 1, 20, 34000, 30900],
  ['Bajwa Mehndi', 'Mehndi', 0, 3, 21000, 19400],
];
for (const [name, type, mBack, d, cap, actual] of past) {
  const date = monthDay(mBack, d);
  if (date >= day(0)) continue;
  const id = event(tariq, name, type, date, '19:00', '23:00', 'Faisalabad', Math.round(cap / 110), cap, 'reviewed', actual);
  insRole.run(id, 'Waiter', 10, 1500, 2000, 'Black & white formal');
}

// Reviews shown on the staff profile (S8)
const insReview = db.prepare('INSERT INTO reviews (event_id, staff_id, author, stars, tags, comment, created_at) VALUES (?,?,?,?,?,?,?)');
const someEvents = db.prepare("SELECT id FROM events WHERE status = 'reviewed' ORDER BY date DESC").all().map((r) => r.id);
const quotes = [
  ['Mehmood Events', 5, '["On time","Uniform","Professional"]', 'On time, correct uniform, polite with guests.'],
  ['Royal Caterers', 5, '["On time","Professional"]', 'Handled a 400-guest dinner calmly.'],
  ['Mehmood Events', 4, '["On time","Uniform"]', 'Good work. Needed one reminder about the serving order.'],
];
Object.values(staff).forEach((sid, i) => {
  quotes.forEach(([author, stars, tags, comment], k) => {
    if (someEvents[(i + k) % someEvents.length] === undefined) return;
    if ((i + k) % 4 === 3) return;
    try { insReview.run(someEvents[(i + k) % someEvents.length], sid, author, stars, tags, comment, ago(24 * (10 + k * 9 + i))); } catch { /* duplicate pair */ }
  });
});

// Asif's CNIC was rejected (shows the re-upload flow on the staff side)
insDoc.run(staff['Asif Mehmood'], 'CNIC', 'rejected', 0, ago(30), ago(26), admin,
  JSON.stringify(['Blurry photo']), 'Your CNIC photo is blurry. Please retake the front photo in good light.');

// Bilal's weekly availability (S15)
const insAv = db.prepare('INSERT INTO availability (staff_id, day, slot) VALUES (?,?,?)');
for (const d of [0, 1, 2, 3, 4, 5, 6]) for (const sl of ['evening']) insAv.run(staff['Bilal Khan'], d, sl);
for (const d of [5, 6]) insAv.run(staff['Bilal Khan'], d, 'afternoon');

// ---------- notifications ----------
const insN = db.prepare('INSERT INTO notifications (user_id, title, body, link, is_read, created_at) VALUES (?,?,?,?,?,?)');
insN.run(tariq, 'Ayesha R. confirmed her shift', 'Sheikh Mehndi · Waiter', `/events/${sheikh}/roster`, 0, ago(0.05));
insN.run(tariq, 'Conflict: Saeed A. is booked elsewhere', 'Aslam Wedding · pick one of 3 alternatives', `/events/${aslam}/roster`, 0, ago(1));
insN.run(tariq, 'Aslam Wedding: 4 slots unfilled', 'Fill them so your team is confirmed 48 hours before the event.', `/events/${aslam}/roster`, 0, ago(3));
insN.run(tariq, 'Invoice ready for Bajwa Mehndi', 'Saved Rs 1,600 against the plan', '/analytics', 1, ago(26));
insN.run(tariq, '3 staff accepted invites', 'Tech Expo 2026', `/events/${expo}/roster`, 1, ago(28));
insN.run(staff['Bilal Khan'], 'New shift invite: Nishat Annual Dinner', 'Waiter · Rs 1,900 · please accept or decline', '/staff/shifts', 0, ago(2));
insN.run(staff['Bilal Khan'], 'Aslam Wedding is in 6 days', 'Check your uniform: black & white formal', '/staff/shifts', 0, ago(5));
insN.run(staff['Asif Mehmood'], 'CNIC needs a new photo', 'Your CNIC photo is blurry. Please retake the front photo in good light.', '/staff/verify', 0, ago(26));
insN.run(admin, '13 documents waiting', 'Oldest has been waiting 30 hours', '/admin/queue', 0, ago(0.5));
insN.run(admin, 'Re-submission from Owais Raza', 'CNIC · after "Blurry photo"', '/admin/queue', 0, ago(18));

console.log('Seeded', DB_FILE);
console.log('Manager login: 03001234567 / Manager@123');
console.log('Admin login:   03111234567 / Admin@123');
console.log('Staff login:   03211234567 / Staff@123 (verified)  ·  03219876543 / Staff@123 (CNIC rejected)');
