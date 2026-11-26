const express = require('express');
const { z } = require('zod');
const db = require('../db');
const AppError = require('../utils/AppError');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { paginate } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

const dto = (n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.is_read, createdAt: n.created_at });

// GET /api/notifications?unread=true
router.get('/', validate({
  query: z.object({
    unread: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  }),
}), (req, res) => {
  const { unread, page, limit } = req.valid.query;
  const p = paginate({ page, limit });
  const cond = unread === 'true' ? 'AND is_read = 0' : '';
  const list = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ${cond} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(req.user.id, p.limit, p.offset);
  const unreadCount = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).n;
  res.json({ notifications: list.map(dto), unreadCount, page, limit });
});

// GET /api/notifications/unread-count – for the 🔔 badge
router.get('/unread-count', (req, res) => {
  res.json({ unreadCount: db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).n });
});

// POST /api/notifications/read-all – "Mark all as read"
router.post('/read-all', (req, res) => {
  const r = db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ ok: true, updated: r.changes });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', validate({ params: z.object({ id: z.coerce.number().int().positive() }) }), (req, res) => {
  const r = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.valid.params.id, req.user.id);
  if (!r.changes && !db.prepare('SELECT 1 FROM notifications WHERE id = ? AND user_id = ?').get(req.valid.params.id, req.user.id)) {
    throw AppError.notFound('Notification not found');
  }
  res.json({ ok: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', validate({ params: z.object({ id: z.coerce.number().int().positive() }) }), (req, res) => {
  const r = db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.valid.params.id, req.user.id);
  if (!r.changes) throw AppError.notFound('Notification not found');
  res.json({ ok: true });
});

module.exports = router;
