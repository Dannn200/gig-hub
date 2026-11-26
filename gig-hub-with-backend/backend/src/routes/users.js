const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const AppError = require('../utils/AppError');
const validate = require('../middleware/validate');
const { requireAuth, signToken } = require('../middleware/auth');
const { paginate } = require('../utils/helpers');
const { publicUser, privateUser, miniUser, skillsOf } = require('../services/serializers');
const { userStats } = require('../services/stats');
const { passwordRule } = require('./auth');

const router = express.Router();
const findById = db.prepare('SELECT * FROM users WHERE id = ?');
const id = z.object({ id: z.coerce.number().int().positive() });

function reviewsFor(userId, { limit, offset }) {
  return db.prepare(`
    SELECT r.*, u.name AS reviewer_name, g.title AS gig_title
    FROM reviews r JOIN users u ON u.id = r.reviewer_id JOIN gigs g ON g.id = r.gig_id
    WHERE r.reviewee_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`)
    .all(userId, limit, offset)
    .map((r) => ({
      id: r.id, rating: r.rating, comment: r.comment, createdAt: r.created_at,
      reviewer: miniUser(r.reviewer_id, r.reviewer_name),
      gig: { id: r.gig_id, title: r.gig_title },
    }));
}

// GET /api/users/me – profile page (own profile + stats + latest reviews)
router.get('/me', requireAuth, (req, res) => {
  const u = findById.get(req.user.id);
  res.json({ user: privateUser(u), stats: userStats(u.id), reviews: reviewsFor(u.id, { limit: 10, offset: 0 }) });
});

// PATCH /api/users/me – "Edit profile"
router.patch('/me', requireAuth, validate({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    college: z.string().trim().min(2).max(120),
    department: z.string().trim().max(80),
    bio: z.string().trim().max(500),
    skills: z.array(z.string().trim().min(1).max(40)).max(20),
    avatarUrl: z.string().max(5000000).optional(),
    avatar_url: z.string().max(5000000).optional(),
    upiId: z.string().trim().max(80).optional(),
    upi_id: z.string().trim().max(80).optional(),
  }).partial().refine((o) => Object.keys(o).length > 0, 'Nothing to update'),
}), (req, res) => {
  const b = req.valid.body;
  const uid = req.user.id;
  const avatar = b.avatarUrl !== undefined ? b.avatarUrl : b.avatar_url;
  const upi = b.upiId !== undefined ? b.upiId : b.upi_id;

  db.transaction(() => {
    const updateObj = { id: uid };
    const cols = [];
    ['name', 'college', 'department', 'bio'].forEach((c) => {
      if (b[c] !== undefined) { cols.push(c); updateObj[c] = b[c]; }
    });
    if (avatar !== undefined) {
      cols.push('avatar_url');
      updateObj.avatar_url = avatar;
    }
    if (upi !== undefined) {
      cols.push('upi_id');
      updateObj.upi_id = upi;
    }
    if (cols.length) {
      db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`).run(updateObj);
    }
    if (b.skills) {
      db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(uid);
      const ins = db.prepare('INSERT OR IGNORE INTO user_skills (user_id, skill) VALUES (?,?)');
      b.skills.forEach((s) => ins.run(uid, s));
    }
  })();
  res.json({ user: privateUser(findById.get(uid)) });
});

// PATCH /api/users/me/password
router.patch('/me/password', requireAuth, validate({
  body: z.object({ currentPassword: z.string().min(1), newPassword: passwordRule }),
}), (req, res) => {
  const u = findById.get(req.user.id);
  if (!bcrypt.compareSync(req.valid.body.currentPassword, u.password_hash)) {
    throw AppError.badRequest('Current password is incorrect');
  }
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?')
    .run(bcrypt.hashSync(req.valid.body.newPassword, 10), u.id);
  // issue a fresh token so this device stays signed in
  res.json({ ok: true, token: signToken({ id: u.id, token_version: u.token_version + 1 }) });
});

// DELETE /api/users/me – delete account (requires password)
router.delete('/me', requireAuth, validate({ body: z.object({ password: z.string().min(1) }) }), (req, res) => {
  const u = findById.get(req.user.id);
  if (!bcrypt.compareSync(req.valid.body.password, u.password_hash)) throw AppError.badRequest('Password is incorrect');
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  res.json({ ok: true });
});

// GET /api/users/:id – public profile
router.get('/:id', validate({ params: id }), (req, res) => {
  const u = findById.get(req.valid.params.id);
  if (!u) throw AppError.notFound('User not found');
  res.json({ user: publicUser(u, { withSkills: true }), stats: (({ completedGigs, totalEarned, rating, reviewCount, trustScore }) =>
    ({ completedGigs, totalEarned, rating, reviewCount, trustScore }))(userStats(u.id)) });
});

// GET /api/users/:id/reviews
router.get('/:id/reviews', validate({
  params: id,
  query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10) }),
}), (req, res) => {
  const uid = req.valid.params.id;
  if (!findById.get(uid)) throw AppError.notFound('User not found');
  const p = paginate(req.valid.query);
  const { n } = db.prepare('SELECT COUNT(*) n FROM reviews WHERE reviewee_id = ?').get(uid);
  res.json({ reviews: reviewsFor(uid, p), page: p.page, total: n });
});

module.exports = router;
