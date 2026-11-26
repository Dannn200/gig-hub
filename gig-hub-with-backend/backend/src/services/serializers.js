const db = require('../db');
const { initialsOf } = require('../utils/helpers');

const skillsStmt = db.prepare('SELECT skill FROM user_skills WHERE user_id = ? ORDER BY rowid');
const skillsOf = (id) => skillsStmt.all(id).map((r) => r.skill);

/** Public view of a user (no email / balance). */
function publicUser(u, { withSkills = false } = {}) {
  const out = {
    id: u.id,
    name: u.name,
    initials: initialsOf(u.name),
    avatarUrl: u.avatar_url || '',
    college: u.college,
    department: u.department,
    bio: u.bio,
    verified: !!u.verified,
    role: u.role || 'student',
    upiId: u.upi_id || '',
    memberSince: u.created_at,
  };
  if (withSkills) out.skills = skillsOf(u.id);
  return out;
}

/** The logged-in user's own view. */
function privateUser(u) {
  return { ...publicUser(u, { withSkills: true }), email: u.email, upiId: u.upi_id || '', role: u.role || 'student' };
}

const miniUser = (id, name, avatarUrl = '', upiId = '') => (id ? { id, name, initials: initialsOf(name), avatarUrl: avatarUrl || '', upiId: upiId || '' } : null);

/** Row must come from GIG_SELECT. */
function gigDto(r) {
  const spotsLeft = r.spots_total == null ? null : Math.max(0, r.spots_total - r.spots_taken);
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    reward: r.reward,
    location: r.location,
    scheduledAt: r.scheduled_at,
    status: r.status,
    spotsTotal: r.spots_total,
    spotsTaken: r.spots_total == null ? null : r.spots_taken,
    spotsLeft,
    poster: miniUser(r.poster_id, r.poster_name, r.poster_avatar, r.poster_upi),
    worker: miniUser(r.worker_id, r.worker_name, r.worker_avatar, r.worker_upi),
    createdAt: r.created_at,
    completedAt: r.completed_at,
    viewer: {
      isPoster: !!r.is_poster,
      isWorker: !!r.is_worker,
      hasJoined: !!r.has_joined,
    },
  };
}

// @viewer must always be bound (use 0 for anonymous)
const GIG_SELECT = `
  SELECT g.*, p.name AS poster_name, p.college AS poster_college, p.avatar_url AS poster_avatar, p.upi_id AS poster_upi,
    w.name AS worker_name, w.avatar_url AS worker_avatar, w.upi_id AS worker_upi,
    (g.poster_id = @viewer) AS is_poster,
    (g.worker_id = @viewer) AS is_worker,
    EXISTS (SELECT 1 FROM gig_participants gp WHERE gp.gig_id = g.id AND gp.user_id = @viewer) AS has_joined
  FROM gigs g
  JOIN users p ON p.id = g.poster_id
  LEFT JOIN users w ON w.id = g.worker_id`;

const getGig = (id, viewer = 0) => {
  const row = db.prepare(`${GIG_SELECT} WHERE g.id = @id`).get({ id, viewer });
  return row ? gigDto(row) : null;
};

module.exports = { publicUser, privateUser, miniUser, gigDto, GIG_SELECT, getGig, skillsOf };
