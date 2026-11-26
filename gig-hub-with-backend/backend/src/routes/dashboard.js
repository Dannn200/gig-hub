const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { GIG_SELECT, gigDto } = require('../services/serializers');
const { userStats } = require('../services/stats');
const { initialsOf } = require('../utils/helpers');

const router = express.Router();

/** Recommendations: open gigs from others, scored by skill overlap + same college + freshness. */
function recommended(user, limit) {
  const skills = db.prepare('SELECT skill FROM user_skills WHERE user_id = ?').all(user.id).map((r) => r.skill.toLowerCase());
  const rows = db.prepare(`${GIG_SELECT}
    WHERE g.status = 'open' AND g.poster_id != @viewer
      AND (g.spots_total IS NULL OR g.spots_taken < g.spots_total)
      AND NOT EXISTS (SELECT 1 FROM gig_participants gp WHERE gp.gig_id = g.id AND gp.user_id = @viewer)
    ORDER BY g.created_at DESC LIMIT 100`).all({ viewer: user.id });
  return rows
    .map((r) => {
      const text = `${r.title} ${r.description}`.toLowerCase();
      let score = skills.filter((s) => text.includes(s)).length * 3;
      if ((r.poster_college || '') === user.college) score += 1;
      if (r.category === 'food') score += 1; // always-popular on campus
      return { r, score };
    })
    .sort((a, b) => b.score - a.score || b.r.id - a.r.id)
    .slice(0, limit)
    .map(({ r }) => gigDto(r));
}

// GET /api/dashboard
router.get('/', requireAuth, (req, res) => {
  const u = db.prepare('SELECT id, name, college FROM users WHERE id = ?').get(req.user.id);
  const s = userStats(u.id);
  const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0').get(u.id).n;
  res.json({
    user: { id: u.id, name: u.name, firstName: u.name.split(' ')[0], initials: initialsOf(u.name) },
    metrics: { activeGigs: s.activeGigs, completedGigs: s.completedGigs, totalEarned: s.totalEarned, rating: s.rating },
    wallet: { balance: s.balance, earnedThisWeek: s.earnedThisWeek, pendingEarnings: s.pendingEarnings },
    recommended: recommended(u, 5),
    unreadNotifications: unread,
  });
});

module.exports = router;
