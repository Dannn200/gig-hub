const db = require('../db');

const q = {
  completed: db.prepare("SELECT COUNT(*) n FROM gigs WHERE worker_id = ? AND status = 'completed'"),
  active: db.prepare(`
    SELECT COUNT(*) n FROM gigs g WHERE g.status IN ('open','in_progress') AND (
      g.poster_id = @id OR g.worker_id = @id
      OR EXISTS (SELECT 1 FROM gig_participants p WHERE p.gig_id = g.id AND p.user_id = @id))`),
  earned: db.prepare("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE user_id = ? AND type='earning' AND status='completed'"),
  pending: db.prepare("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE user_id = ? AND type='earning' AND status='pending'"),
  week: db.prepare(`SELECT COALESCE(SUM(amount),0) n FROM transactions
    WHERE user_id = ? AND type='earning' AND status='completed' AND completed_at >= datetime('now','-7 days')`),
  rating: db.prepare('SELECT COUNT(*) c, AVG(rating) a FROM reviews WHERE reviewee_id = ?'),
  user: db.prepare('SELECT balance, abandoned_count FROM users WHERE id = ?'),
};

/**
 * Trust score (0-100) = 60% average rating (5★ = 100, no reviews counts as 80)
 *                     + 40% completion rate (completed / (completed + abandoned)).
 */
function userStats(userId) {
  const completed = q.completed.get(userId).n;
  const { c: reviewCount, a } = q.rating.get(userId);
  const { balance, abandoned_count } = q.user.get(userId) || { balance: 0, abandoned_count: 0 };
  const rating = reviewCount ? Math.round(a * 10) / 10 : null;
  const finished = completed + abandoned_count;
  const completionRate = finished ? Math.round((completed / finished) * 100) : 100;
  const ratingScore = rating == null ? 80 : (rating / 5) * 100;
  return {
    completedGigs: completed,
    activeGigs: q.active.get({ id: userId }).n,
    totalEarned: q.earned.get(userId).n,
    pendingEarnings: q.pending.get(userId).n,
    earnedThisWeek: q.week.get(userId).n,
    balance,
    rating,
    reviewCount,
    completionRate,
    trustScore: Math.round(0.6 * ratingScore + 0.4 * completionRate),
  };
}

module.exports = { userStats };
