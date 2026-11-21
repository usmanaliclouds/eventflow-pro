// SQLite database (built into Node 22.5+, no extra install).
// One file: server/data/eventflow.db. Delete it and run `npm run seed` to start fresh.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'eventflow.db');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  role          TEXT NOT NULL CHECK (role IN ('manager','staff','admin')),
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  company       TEXT,
  password_hash TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','ur')),
  text_size     INTEGER NOT NULL DEFAULT 100,
  high_contrast INTEGER NOT NULL DEFAULT 0,
  notif_reminders INTEGER NOT NULL DEFAULT 1,
  notif_invites   INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  primary_role   TEXT NOT NULL,
  rate           INTEGER NOT NULL CHECK (rate BETWEEN 500 AND 20000),
  months_active  INTEGER NOT NULL DEFAULT 0,
  rating_avg     REAL NOT NULL DEFAULT 0,
  rating_count   INTEGER NOT NULL DEFAULT 0,
  jobs_completed INTEGER NOT NULL DEFAULT 0,
  city           TEXT NOT NULL DEFAULT 'Faisalabad',
  avatar_color   TEXT NOT NULL DEFAULT '#A5ACF0',
  father_name    TEXT,
  dob            TEXT,
  cnic_masked    TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('CNIC','Food Safety','First Aid')),
  status       TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  is_resubmission INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT NOT NULL,
  reviewed_at  TEXT,
  reviewed_by  INTEGER REFERENCES users(id),
  reject_reasons TEXT,
  reject_message TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  date        TEXT NOT NULL,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  venue       TEXT NOT NULL,
  guests      INTEGER NOT NULL CHECK (guests BETWEEN 1 AND 5000),
  budget_cap  INTEGER NOT NULL CHECK (budget_cap > 0),
  status      TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','confirmed','completed','reviewed')),
  actual_spend INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_roles (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id  INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role      TEXT NOT NULL,
  count     INTEGER NOT NULL CHECK (count BETWEEN 1 AND 200),
  rate_min  INTEGER NOT NULL,
  rate_max  INTEGER NOT NULL,
  uniform   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  staff_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  rate       INTEGER NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('invited','confirmed','uniform_ready','dropped')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  dropped_at TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  staff_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  stars      INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  tags       TEXT NOT NULL DEFAULT '[]',
  comment    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, staff_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  link       TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  target     TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS availability (
  staff_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day       INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
  slot      TEXT NOT NULL CHECK (slot IN ('morning','afternoon','evening')),
  PRIMARY KEY (staff_id, day, slot)
);

CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_staff ON bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_docs_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
`);

// columns added after the first version (safe to run on an old database file)
const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
if (!cols('documents').includes('images')) db.exec('ALTER TABLE documents ADD COLUMN images TEXT');
if (!cols('bookings').includes('checklist')) db.exec('ALTER TABLE bookings ADD COLUMN checklist TEXT');

function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { db, tx, DB_FILE };
