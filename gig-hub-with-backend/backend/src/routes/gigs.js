const express = require('express');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const AppError = require('../utils/AppError');
const validate = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { escapeLike, paginate } = require('../utils/helpers');
const { GIG_SELECT, gigDto, getGig } = require('../services/serializers');
const { notify, notifyMany } = require('../services/notify');

const router = express.Router();
const CATEGORIES = ['food', 'skills', 'task', 'event', 'academic'];
const idParam = z.object({ id: z.coerce.number().int().positive() });
const money = (s) => `₹${s.toLocaleString('en-IN')}`;

const getRaw = (gigId) => db.prepare('SELECT * FROM gigs WHERE id = ?').get(gigId);
const mustGet = (gigId) => { const g = getRaw(gigId); if (!g) throw AppError.notFound('Gig not found'); return g; };
const participantIds = (gigId) => db.prepare('SELECT user_id FROM gig_participants WHERE gig_id = ?').all(gigId).map((r) => r.user_id);

// ---------- schemas ----------
const emptyToUndef = (v) => (v === '' ? undefined : v);
const gigFields = {
  title: z.string().trim().min(3).max(120),
  category: z.enum(CATEGORIES),
  description: z.string().trim().min(10).max(2000),
  reward: z.coerce.number().int().min(0).max(100000),
  location: z.string().trim().max(120).default(''),
  date: z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD').optional()),
  time: z.preprocess(emptyToUndef, z.string().regex(/^\d{2}:\d{2}$/, 'must be HH:MM').optional()),
  spots: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(50).optional()),
};
const createSchema = z.object(gigFields);
const updateSchema = z.object(gigFields).omit({ category: true }).partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update');

const listQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).default('open'),
  minReward: z.coerce.number().int().min(0).optional(),
  maxReward: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'reward_desc', 'reward_asc', 'soonest']).default('newest'),
  sameCollege: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const toScheduled = (date, time) => (date ? `${date}T${time || '00:00'}:00${config.utcOffset}` : null);
const ORDER = {
  newest: 'g.created_at DESC, g.id DESC',
  reward_desc: 'g.reward DESC, g.id DESC',
  reward_asc: 'g.reward ASC, g.id DESC',
  soonest: 'g.scheduled_at IS NULL, g.scheduled_at ASC, g.id DESC',
};

// ---------- GET /api/gigs  (marketplace: search + category tabs) ----------
router.get('/', optionalAuth, validate({ query: listQuery }), (req, res) => {
  const f = req.valid.query;
  const viewer = req.user?.id ?? 0;
  const where = ['g.status = @status'];
  const params = { viewer, status: f.status };
  if (f.category) { where.push('g.category = @category'); params.category = f.category; }
  if (f.minReward != null) { where.push('g.reward >= @minReward'); params.minReward = f.minReward; }
  if (f.maxReward != null) { where.push('g.reward <= @maxReward'); params.maxReward = f.maxReward; }
  if (f.q) {
    where.push("(g.title LIKE @q ESCAPE '\\' OR g.description LIKE @q ESCAPE '\\' OR g.location LIKE @q ESCAPE '\\')");
    params.q = `%${escapeLike(f.q)}%`;
  }
  if (f.sameCollege === 'true' && req.user) {
    where.push('p.college = @college COLLATE NOCASE');
    params.college = req.user.college;
  }
  const p = paginate(f);
  const clause = `WHERE ${where.join(' AND ')}`;
  const rows = db.prepare(`${GIG_SELECT} ${clause} ORDER BY ${ORDER[f.sort]} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: p.limit, offset: p.offset });
  const { n } = db.prepare(`SELECT COUNT(*) n FROM gigs g JOIN users p ON p.id = g.poster_id ${clause}`)
    .get(Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'viewer')));
  res.json({ gigs: rows.map(gigDto), page: p.page, limit: p.limit, total: n });
});

// ---------- GET /api/gigs/mine ----------
router.get('/mine', requireAuth, validate({
  query: z.object({
    role: z.enum(['posted', 'working', 'joined', 'all']).default('all'),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled', 'active']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
}), (req, res) => {
  const { role, status, page, limit } = req.valid.query;
  const roles = {
    posted: 'g.poster_id = @viewer',
    working: 'g.worker_id = @viewer',
    joined: 'EXISTS (SELECT 1 FROM gig_participants gp WHERE gp.gig_id = g.id AND gp.user_id = @viewer)',
  };
  const roleSql = role === 'all' ? `(${Object.values(roles).join(' OR ')})` : roles[role];
  const statusSql = !status ? '' : status === 'active' ? "AND g.status IN ('open','in_progress')" : 'AND g.status = @status';
  const p = paginate({ page, limit });
  const params = { viewer: req.user.id, status };
  const rows = db.prepare(`${GIG_SELECT} WHERE ${roleSql} ${statusSql} ORDER BY g.created_at DESC, g.id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: p.limit, offset: p.offset });
  res.json({ gigs: rows.map(gigDto), page, limit });
});

// ---------- POST /api/gigs  (Post a gig form) ----------
router.post('/', requireAuth, validate({ body: createSchema }), (req, res) => {
  const b = req.valid.body;
  const isFood = b.category === 'food';
  const spots = isFood ? (b.spots ?? 4) : null;
  const info = db.prepare(`
    INSERT INTO gigs (poster_id, title, category, description, reward, location, scheduled_at, spots_total)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(req.user.id, b.title, b.category, b.description, b.reward, b.location, toScheduled(b.date, b.time), spots);
  const gig = getGig(info.lastInsertRowid, req.user.id);

  // "New food gig nearby" – tell classmates from the same college
  if (isFood) {
    const peers = db.prepare('SELECT id FROM users WHERE college = ? COLLATE NOCASE AND id != ? LIMIT 500')
      .all(req.user.college, req.user.id).map((r) => r.id);
    notifyMany(peers, {
      type: 'new_gig', title: 'New food gig nearby',
      body: `${b.title} sharing is available${b.location ? ` at ${b.location}` : ''}.`, link: `/gigs/${gig.id}`,
    });
  }
  res.status(201).json({ gig });
});

// ---------- GET /api/gigs/:id ----------
router.get('/:id', optionalAuth, validate({ params: idParam }), (req, res) => {
  const gig = getGig(req.valid.params.id, req.user?.id ?? 0);
  if (!gig) throw AppError.notFound('Gig not found');
  const out = { gig };
  // participants are visible to the poster only
  if (gig.viewer.isPoster && gig.category === 'food') {
    out.participants = db.prepare(`SELECT u.id, u.name FROM gig_participants gp JOIN users u ON u.id = gp.user_id
      WHERE gp.gig_id = ? ORDER BY gp.joined_at`).all(gig.id);
  }
  res.json(out);
});

// ---------- PATCH /api/gigs/:id  (poster, only while open) ----------
router.patch('/:id', requireAuth, validate({ params: idParam, body: updateSchema }), (req, res) => {
  const g = mustGet(req.valid.params.id);
  if (g.poster_id !== req.user.id) throw AppError.forbidden('Only the poster can edit this gig');
  if (g.status !== 'open') throw AppError.conflict('Only open gigs can be edited');
  const b = req.valid.body;
  const set = {};
  for (const k of ['title', 'description', 'reward', 'location']) if (b[k] !== undefined) set[k] = b[k];
  if (b.date !== undefined || b.time !== undefined) {
    const cur = g.scheduled_at;
    const date = b.date ?? cur?.slice(0, 10);
    const time = b.time ?? cur?.slice(11, 16);
    set.scheduled_at = toScheduled(date, time);
  }
  if (b.spots !== undefined) {
    if (g.category !== 'food') throw AppError.badRequest('Only food gigs have spots');
    if (b.spots < g.spots_taken) throw AppError.badRequest(`${g.spots_taken} spots are already taken`);
    set.spots_total = b.spots;
  }
  const cols = Object.keys(set);
  if (cols.length) db.prepare(`UPDATE gigs SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`).run({ ...set, id: g.id });
  res.json({ gig: getGig(g.id, req.user.id) });
});

// ---------- DELETE /api/gigs/:id  (poster cancels) ----------
router.delete('/:id', requireAuth, validate({ params: idParam }), (req, res) => {
  db.transaction(() => {
    const g = mustGet(req.valid.params.id);
    if (g.poster_id !== req.user.id) throw AppError.forbidden('Only the poster can cancel this gig');
    if (!['open', 'in_progress'].includes(g.status)) throw AppError.conflict(`A ${g.status} gig cannot be cancelled`);
    db.prepare("UPDATE gigs SET status = 'cancelled' WHERE id = ?").run(g.id);
    db.prepare("UPDATE transactions SET status = 'cancelled' WHERE gig_id = ? AND status = 'pending'").run(g.id);
    const audience = [...participantIds(g.id), ...(g.worker_id ? [g.worker_id] : [])];
    notifyMany(audience, { type: 'gig_update', title: 'A gig was cancelled', body: `"${g.title}" has been cancelled by the poster.`, link: `/gigs/${g.id}` });
  })();
  res.json({ ok: true });
});

// ---------- POST /api/gigs/:id/accept  (take on a task / skill / event / academic gig) ----------
router.post('/:id/accept', requireAuth, validate({ params: idParam }), (req, res) => {
  db.transaction(() => {
    const g = mustGet(req.valid.params.id);
    if (g.category === 'food') throw AppError.badRequest('Food orders are joined, not accepted');
    if (g.poster_id === req.user.id) throw AppError.forbidden('You cannot accept your own gig');
    const r = db.prepare("UPDATE gigs SET status='in_progress', worker_id=?, accepted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='open'")
      .run(req.user.id, g.id);
    if (!r.changes) throw AppError.conflict('This gig is no longer available');
    if (g.reward > 0) {
      db.prepare("INSERT INTO transactions (user_id, gig_id, type, amount, status, note) VALUES (?,?,?,?,?,?)")
        .run(req.user.id, g.id, 'earning', g.reward, 'pending', g.title);
    }
    notify(g.poster_id, { type: 'gig_update', title: 'Your gig was accepted', body: `Someone is working on "${g.title}".`, link: `/gigs/${g.id}` });
  })();
  res.json({ gig: getGig(req.valid.params.id, req.user.id) });
});

// ---------- POST /api/gigs/:id/abandon  (worker backs out → gig re-opens) ----------
router.post('/:id/abandon', requireAuth, validate({ params: idParam }), (req, res) => {
  db.transaction(() => {
    const g = mustGet(req.valid.params.id);
    if (g.worker_id !== req.user.id || g.status !== 'in_progress') throw AppError.forbidden('You are not working on this gig');
    db.prepare("UPDATE gigs SET status='open', worker_id=NULL, accepted_at=NULL WHERE id=?").run(g.id);
    db.prepare("DELETE FROM transactions WHERE gig_id = ? AND user_id = ? AND status = 'pending'").run(g.id, req.user.id);
    db.prepare('UPDATE users SET abandoned_count = abandoned_count + 1 WHERE id = ?').run(req.user.id);
    notify(g.poster_id, { type: 'gig_update', title: 'Worker withdrew', body: `"${g.title}" is open again.`, link: `/gigs/${g.id}` });
  })();
  res.json({ gig: getGig(req.valid.params.id, req.user.id) });
});

// ---------- POST /api/gigs/:id/complete  (poster confirms → worker is paid) ----------
router.post('/:id/complete', requireAuth, validate({ params: idParam }), (req, res) => {
  db.transaction(() => {
    const g = mustGet(req.valid.params.id);
    if (g.poster_id !== req.user.id) throw AppError.forbidden('Only the poster can mark this gig complete');
    const isFood = g.category === 'food';
    if (isFood ? g.status !== 'open' : g.status !== 'in_progress') {
      throw AppError.conflict(isFood ? 'Order is already closed' : 'Gig must be in progress to complete');
    }
    db.prepare("UPDATE gigs SET status='completed', completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(g.id);
    if (isFood) {
      notifyMany(participantIds(g.id), { type: 'gig_completed', title: 'Food order closed', body: `"${g.title}" has been marked complete.`, link: `/gigs/${g.id}` });
      return;
    }
    const tx = db.prepare("SELECT * FROM transactions WHERE gig_id = ? AND user_id = ? AND status='pending'").get(g.id, g.worker_id);
    if (tx) {
      db.prepare("UPDATE transactions SET status='completed', completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(tx.id);
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(tx.amount, g.worker_id);
    }
    const poster = db.prepare('SELECT name FROM users WHERE id = ?').get(g.poster_id);
    notify(g.worker_id, {
      type: 'gig_completed',
      title: g.reward ? `Gig completed — ${money(g.reward)} earned` : 'Gig completed',
      body: `Your ${g.title} gig was marked complete by ${poster.name.split(' ')[0]}.`,
      link: `/gigs/${g.id}`,
    });
  })();
  res.json({ gig: getGig(req.valid.params.id, req.user.id) });
});

// ---------- Food orders: join / leave ----------
router.post('/:id/join', requireAuth, validate({ params: idParam }), (req, res) => {
  db.transaction(() => {
    const g = mustGet(req.valid.params.id);
    if (g.category !== 'food') throw AppError.badRequest('Only food orders can be joined');
    if (g.poster_id === req.user.id) throw AppError.badRequest('You started this order');
    if (g.status !== 'open') throw AppError.conflict('This order is closed');
    const r = db.prepare('UPDATE gigs SET spots_taken = spots_taken + 1 WHERE id = ? AND spots_taken < spots_total').run(g.id);
    if (!r.changes) throw AppError.conflict('No spots left');
    try {
      db.prepare('INSERT INTO gig_participants (gig_id, user_id) VALUES (?,?)').run(g.id, req.user.id);
    } catch (e) {
      if (String(e.code).startsWith('SQLITE_CONSTRAINT')) throw AppError.conflict('You already joined this order');
      throw e;
    }
    notify(g.poster_id, { type: 'gig_update', title: 'Someone joined your order', body: `"${g.title}" has ${g.spots_total - g.spots_taken - 1} spot(s) left.`, link: `/gigs/${g.id}` });
  })();
  res.json({ gig: getGig(req.valid.params.id, req.user.id) });
});

router.post('/:id/leave', requireAuth, validate({ params: idParam }), (req, res) => {
  db.transaction(() => {
    const g = mustGet(req.valid.params.id);
    if (g.status !== 'open') throw AppError.conflict('This order is closed');
    const r = db.prepare('DELETE FROM gig_participants WHERE gig_id = ? AND user_id = ?').run(g.id, req.user.id);
    if (!r.changes) throw AppError.badRequest('You have not joined this order');
    db.prepare('UPDATE gigs SET spots_taken = spots_taken - 1 WHERE id = ?').run(g.id);
  })();
  res.json({ gig: getGig(req.valid.params.id, req.user.id) });
});

// ---------- POST /api/gigs/:id/reviews ----------
router.post('/:id/reviews', requireAuth, validate({
  params: idParam,
  body: z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(500).default('') }),
}), (req, res) => {
  const g = mustGet(req.valid.params.id);
  if (g.status !== 'completed' || !g.worker_id) throw AppError.conflict('Only completed gigs can be reviewed');
  let revieweeId;
  if (req.user.id === g.poster_id) revieweeId = g.worker_id;
  else if (req.user.id === g.worker_id) revieweeId = g.poster_id;
  else throw AppError.forbidden('Only the poster and worker can review this gig');

  const { rating, comment } = req.valid.body;
  let info;
  try {
    info = db.prepare('INSERT INTO reviews (gig_id, reviewer_id, reviewee_id, rating, comment) VALUES (?,?,?,?,?)')
      .run(g.id, req.user.id, revieweeId, rating, comment);
  } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) throw AppError.conflict('You already reviewed this gig');
    throw e;
  }
  const me = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
  notify(revieweeId, {
    type: 'review', title: 'You received a new review',
    body: `${me.name.split(' ')[0]} gave you a ${rating}-star rating for your ${g.title} gig.`, link: '/profile',
  });
  res.status(201).json({ review: { id: info.lastInsertRowid, rating, comment } });
});

module.exports = router;
