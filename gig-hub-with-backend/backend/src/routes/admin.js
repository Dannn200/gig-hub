const express = require('express');
const { z } = require('zod');
const db = require('../db');
const AppError = require('../utils/AppError');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { publicUser, miniUser, skillsOf } = require('../services/serializers');
const { userStats } = require('../services/stats');
const { escapeLike } = require('../utils/helpers');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/stats – Platform overview metrics
router.get('/stats', (_req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  const activeGigs = db.prepare("SELECT COUNT(*) n FROM gigs WHERE status IN ('open', 'in_progress')").get().n;
  const completedGigs = db.prepare("SELECT COUNT(*) n FROM gigs WHERE status = 'completed'").get().n;
  const totalVolume = db.prepare("SELECT COALESCE(SUM(amount), 0) n FROM transactions WHERE status = 'completed'").get().n;

  res.json({
    totalUsers,
    activeGigs,
    completedGigs,
    totalVolume,
  });
});

// GET /api/admin/users – List all accounts with summary metrics
router.get('/users', validate({
  query: z.object({
    q: z.string().trim().max(100).optional(),
    role: z.enum(['all', 'student', 'admin']).default('all'),
  }),
}), (req, res) => {
  const { q, role } = req.valid.query;
  const where = [];
  const params = {};

  if (role !== 'all') {
    where.push('u.role = @role');
    params.role = role;
  }
  if (q) {
    where.push("(u.name LIKE @q ESCAPE '\\' OR u.email LIKE @q ESCAPE '\\' OR u.college LIKE @q ESCAPE '\\')");
    params.q = `%${escapeLike(q)}%`;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
    SELECT u.id, u.name, u.email, u.college, u.department, u.bio, u.role, u.avatar_url, u.upi_id,
           u.balance, u.verified, u.created_at,
           (SELECT COUNT(*) FROM gigs WHERE poster_id = u.id) AS posted_gigs_count,
           (SELECT COUNT(*) FROM gigs WHERE worker_id = u.id AND status = 'completed') AS completed_gigs_count,
           (SELECT COUNT(*) FROM transactions WHERE user_id = u.id) AS transactions_count
    FROM users u
    ${whereClause}
    ORDER BY u.created_at DESC, u.id DESC`;

  const users = db.prepare(sql).all(params);
  res.json({ users });
});

// GET /api/admin/users/:id – Deep dive into an account's profile, history & gigs
router.get('/users/:id', validate({
  params: z.object({ id: z.coerce.number().int().positive() }),
}), (req, res) => {
  const uid = req.valid.params.id;
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  if (!u) throw AppError.notFound('User not found');

  const stats = userStats(uid);
  const skills = skillsOf(uid);

  // Gigs posted by this user
  const postedGigs = db.prepare(`
    SELECT g.*, w.name AS worker_name
    FROM gigs g
    LEFT JOIN users w ON w.id = g.worker_id
    WHERE g.poster_id = ?
    ORDER BY g.created_at DESC`).all(uid);

  // Gigs worked on or joined by this user
  const workedGigs = db.prepare(`
    SELECT g.*, p.name AS poster_name
    FROM gigs g
    JOIN users p ON p.id = g.poster_id
    WHERE g.worker_id = ?
    ORDER BY g.created_at DESC`).all(uid);

  // Financial transactions
  const transactions = db.prepare(`
    SELECT t.*, g.title AS gig_title
    FROM transactions t
    LEFT JOIN gigs g ON g.id = t.gig_id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC`).all(uid);

  res.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      college: u.college,
      department: u.department,
      bio: u.bio,
      role: u.role,
      avatarUrl: u.avatar_url || '',
      upiId: u.upi_id || '',
      verified: !!u.verified,
      balance: u.balance,
      createdAt: u.created_at,
      skills,
    },
    stats,
    postedGigs,
    workedGigs,
    transactions,
  });
});

// PATCH /api/admin/users/:id/role – Promote or demote user
router.patch('/users/:id/role', validate({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ role: z.enum(['student', 'admin']) }),
}), (req, res) => {
  const uid = req.valid.params.id;
  const { role } = req.valid.body;
  const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(uid);
  if (!target) throw AppError.notFound('User not found');

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, uid);
  res.json({ ok: true, id: uid, role });
});

module.exports = router;
