const express = require('express');
const { z } = require('zod');
const db = require('../db');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { paginate } = require('../utils/helpers');
const { userStats } = require('../services/stats');

const router = express.Router();

const query = z.object({
  status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  type: z.enum(['earning', 'withdrawal']).optional(),
  category: z.enum(['food', 'skills', 'task', 'event', 'academic']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function rows(userId, f, paging) {
  const where = ['t.user_id = @uid'];
  const params = { uid: userId };
  if (f.status) { where.push('t.status = @status'); params.status = f.status; }
  if (f.type) { where.push('t.type = @type'); params.type = f.type; }
  if (f.category) { where.push('g.category = @category'); params.category = f.category; }
  if (f.from) { where.push("date(COALESCE(t.completed_at, t.created_at)) >= @from"); params.from = f.from; }
  if (f.to) { where.push("date(COALESCE(t.completed_at, t.created_at)) <= @to"); params.to = f.to; }
  const sql = `
    SELECT t.id, t.type, t.amount, t.status, t.note, t.gig_id,
           COALESCE(t.completed_at, t.created_at) AS date,
           g.title AS gig_title, g.category, g.location, p.name AS poster_name
    FROM transactions t
    LEFT JOIN gigs g ON g.id = t.gig_id
    LEFT JOIN users p ON p.id = g.poster_id
    WHERE ${where.join(' AND ')}
    ORDER BY date DESC, t.id DESC ${paging ? 'LIMIT @limit OFFSET @offset' : ''}`;
  const list = db.prepare(sql).all(paging ? { ...params, ...paging } : params);
  const total = db.prepare(`SELECT COUNT(*) n FROM transactions t LEFT JOIN gigs g ON g.id = t.gig_id WHERE ${where.join(' AND ')}`).get(params).n;
  return { list, total };
}

const dto = (r) => ({
  id: r.id,
  type: r.type,
  title: r.type === 'withdrawal' ? 'Wallet withdrawal' : r.gig_title || r.note,
  subtitle: r.type === 'withdrawal' ? r.note : r.poster_name || r.location || '',
  category: r.category || null,
  date: r.date,
  status: r.status,
  amount: r.amount,
  signedAmount: r.type === 'withdrawal' ? -r.amount : r.amount,
  gigId: r.gig_id,
});

// GET /api/history  – "Gig activity" table + summary cards
router.get('/', requireAuth, validate({ query }), (req, res) => {
  const f = req.valid.query;
  const p = paginate(f);
  const { list, total } = rows(req.user.id, f, { limit: p.limit, offset: p.offset });
  const s = userStats(req.user.id);
  res.json({
    summary: {
      totalEarned: s.totalEarned,
      completedGigs: s.completedGigs,
      completionRate: s.completionRate,
      averageRating: s.rating,
      reviewCount: s.reviewCount,
      pendingEarnings: s.pendingEarnings,
    },
    transactions: list.map(dto),
    page: p.page, limit: p.limit, total,
  });
});

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET /api/history/report.csv – "Download report"
router.get('/report.csv', requireAuth, validate({ query: query.omit({ page: true, limit: true }) }), (req, res) => {
  const { list } = rows(req.user.id, req.valid.query, null);
  const head = ['Date', 'Title', 'Details', 'Category', 'Type', 'Status', 'Amount (INR)'];
  const lines = list.map(dto).map((t) =>
    [t.date.slice(0, 10), t.title, t.subtitle, t.category, t.type, t.status, t.signedAmount].map(csvCell).join(','));
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="gighub-report.csv"',
  });
  res.send([head.join(','), ...lines].join('\n'));
});

module.exports = router;
