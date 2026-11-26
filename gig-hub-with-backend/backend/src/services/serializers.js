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
    college: u.college,
    department: u.department,
    bio: u.bio,
    verified: !!u.verified,
    memberSince: u.created_at,
  };
  if (withSkills) out.skills = skillsOf(u.id);
  return out;
}

/** The logged-in user's own view. */
function privateUser(u) {
  return { ...publicUser(u, { withSkills: true }), email: u.email };
}

const miniUser = (id, name) => (id ? { id, name, initials: initialsOf(name) } : null);

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
    poster: miniUser(r.poster_id, r.poster_name),
    worker: miniUser(r.worker_id, r.worker_name),
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
  SELECT g.*, p.name AS poster_name, p.college AS poster_college, w.name AS worker_name,
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
