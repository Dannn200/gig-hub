const db = require('../db');
const { notify } = require('./notify');

/**
 * Sends a "starts soon" notification once per user per gig for gigs scheduled in the next 24h
 * (to the poster, the assigned worker, and food-order participants).
 */
function sendDueReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + 24 * 3600 * 1000);
  const gigs = db.prepare(`SELECT * FROM gigs WHERE scheduled_at IS NOT NULL AND status IN ('open','in_progress')`).all()
    .filter((g) => { const t = new Date(g.scheduled_at); return t > now && t <= horizon; });
  let sent = 0;
  const mark = db.prepare('INSERT OR IGNORE INTO gig_reminders (gig_id, user_id) VALUES (?,?)');
  for (const g of gigs) {
    const users = new Set([g.poster_id]);
    if (g.worker_id) users.add(g.worker_id);
    db.prepare('SELECT user_id FROM gig_participants WHERE gig_id = ?').all(g.id).forEach((r) => users.add(r.user_id));
    for (const uid of users) {
      if (mark.run(g.id, uid).changes) {
        notify(uid, { type: 'reminder', title: `Coming up: ${g.title}`, body: `Starts ${g.scheduled_at.slice(0, 16).replace('T', ' ')}${g.location ? ` at ${g.location}` : ''}.`, link: `/gigs/${g.id}` });
        sent++;
      }
    }
  }
  return sent;
}

function startReminderJob(intervalMs = 15 * 60 * 1000) {
  const run = () => { try { sendDueReminders(); } catch (e) { console.error('[reminders]', e); } };
  run();
  const t = setInterval(run, intervalMs);
  t.unref();
  return t;
}

module.exports = { sendDueReminders, startReminderJob };
