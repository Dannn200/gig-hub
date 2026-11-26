const express = require('express');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const AppError = require('../utils/AppError');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { notify } = require('../services/notify');
const { userStats } = require('../services/stats');

const router = express.Router();

// GET /api/wallet
router.get('/', requireAuth, (req, res) => {
  const s = userStats(req.user.id);
  res.json({ balance: s.balance, earnedThisWeek: s.earnedThisWeek, pendingEarnings: s.pendingEarnings, minWithdrawal: config.minWithdrawal });
});

// POST /api/wallet/withdraw – dashboard "Withdraw".
// Balance is debited atomically and a pending withdrawal is recorded.
// Hook your payout provider (Razorpay Payouts / UPI) in where marked.
router.post('/withdraw', requireAuth, validate({
  body: z.object({
    amount: z.coerce.number().int().positive(),
    upiId: z.string().trim().regex(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, 'must be a valid UPI ID, e.g. name@bank'),
  }),
}), (req, res) => {
  const { amount, upiId } = req.valid.body;
  if (amount < config.minWithdrawal) throw AppError.badRequest(`Minimum withdrawal is ₹${config.minWithdrawal}`);
  const result = db.transaction(() => {
    // conditional UPDATE → race-safe against double spending
    const r = db.prepare('UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?').run(amount, req.user.id, amount);
    if (!r.changes) throw AppError.badRequest('Insufficient balance');
    const info = db.prepare("INSERT INTO transactions (user_id, type, amount, status, note) VALUES (?,?,?,?,?)")
      .run(req.user.id, 'withdrawal', amount, 'pending', `To UPI ${upiId}`);
    // TODO: call payout provider here, then flip status to 'completed' via webhook
    notify(req.user.id, { type: 'wallet', title: `Withdrawal of ₹${amount} requested`, body: `Payout to ${upiId} is being processed.`, link: '/history' });
    return { id: info.lastInsertRowid, balance: db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id).balance };
  })();
  res.status(201).json({ withdrawal: { id: result.id, amount, status: 'pending' }, balance: result.balance });
});

module.exports = router;
