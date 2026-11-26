const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

if (config.dbPath !== ':memory:') fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
if (config.dbPath !== ':memory:') db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT NOT NULL,
  college         TEXT NOT NULL,
  department      TEXT NOT NULL DEFAULT '',
  bio             TEXT NOT NULL DEFAULT '',
  verified        INTEGER NOT NULL DEFAULT 0,
  balance         INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  abandoned_count INTEGER NOT NULL DEFAULT 0,
  token_version   INTEGER NOT NULL DEFAULT 0,
  reset_token_hash TEXT,
  reset_expires   TEXT,
  created_at      TEXT NOT NULL DEFAULT (${NOW})
);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill   TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (user_id, skill)
);

CREATE TABLE IF NOT EXISTS gigs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  poster_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('food','skills','task','event','academic')),
  description TEXT NOT NULL,
  reward      INTEGER NOT NULL DEFAULT 0 CHECK (reward >= 0),
  location    TEXT NOT NULL DEFAULT '',
  scheduled_at TEXT,
  spots_total INTEGER,
  spots_taken INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  created_at  TEXT NOT NULL DEFAULT (${NOW}),
  accepted_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_gigs_status_cat ON gigs(status, category, created_at);
CREATE INDEX IF NOT EXISTS idx_gigs_poster ON gigs(poster_id);
CREATE INDEX IF NOT EXISTS idx_gigs_worker ON gigs(worker_id);

CREATE TABLE IF NOT EXISTS gig_participants (
  gig_id    INTEGER NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (${NOW}),
  PRIMARY KEY (gig_id, user_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gig_id       INTEGER REFERENCES gigs(id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('earning','withdrawal')),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  status       TEXT NOT NULL CHECK (status IN ('pending','completed','cancelled')),
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (${NOW}),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  gig_id      INTEGER NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (${NOW}),
  UNIQUE (gig_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (${NOW})
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at);

CREATE TABLE IF NOT EXISTS gig_reminders (
  gig_id  INTEGER NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (gig_id, user_id)
);
`);

module.exports = db;
