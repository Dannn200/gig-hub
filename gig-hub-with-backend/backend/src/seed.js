/** Initializes the DB with clean state and default admin. Run: npm run seed */
const bcrypt = require('bcryptjs');
const db = require('./db');

db.transaction(() => {
  ['reminders', 'notifications', 'reviews', 'transactions', 'gig_participants', 'gigs', 'user_skills', 'users']
    .forEach((t) => db.exec(`DELETE FROM ${t === 'reminders' ? 'gig_reminders' : t}`));
  db.exec("DELETE FROM sqlite_sequence");

  const hash = bcrypt.hashSync('Admin@123', 10);
  db.prepare(`INSERT INTO users (name,email,password_hash,college,department,bio,verified,balance,role,upi_id)
              VALUES (?,?,?,?,?,?,1,0,'admin',?)`)
    .run('Campus Admin', 'admin@university.edu', hash, 'University Administration', 'Administration', 'Campus GigHub System Administrator.', 'admin@upi');
})();

console.log('Seed completed: clean state with system admin (admin@university.edu).');
