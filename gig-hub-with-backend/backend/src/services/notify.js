const db = require('../db');

const insert = db.prepare(
  'INSERT INTO notifications (user_id, type, title, body, link) VALUES (@userId, @type, @title, @body, @link)'
);

/** notify(userId, { type, title, body, link }) – types: gig_completed, new_gig, review, reminder, gig_update, wallet */
function notify(userId, { type, title, body = '', link = null }) {
  insert.run({ userId, type, title, body, link });
}

function notifyMany(userIds, payload) {
  const run = db.transaction((ids) => ids.forEach((id) => notify(id, payload)));
  run(userIds);
}

module.exports = { notify, notifyMany };
