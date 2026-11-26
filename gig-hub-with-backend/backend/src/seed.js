/** Populates the DB with demo data mirroring the static pages. Run: npm run seed  (wipes existing data) */
const bcrypt = require('bcryptjs');
const db = require('./db');

const iso = (daysAgo, h = 12) => new Date(Date.now() - daysAgo * 864e5 + (h - 12) * 36e5).toISOString();
const inDays = (d, hh) => { const t = new Date(Date.now() + d * 864e5); return `${t.toISOString().slice(0, 10)}T${hh}:00+05:30`; };

db.transaction(() => {
  ['reminders', 'notifications', 'reviews', 'transactions', 'gig_participants', 'gigs', 'user_skills', 'users']
    .forEach((t) => db.exec(`DELETE FROM ${t === 'reminders' ? 'gig_reminders' : t}`));
  db.exec("DELETE FROM sqlite_sequence");

  const hash = bcrypt.hashSync('Password123', 10);
  const U = db.prepare(`INSERT INTO users (name,email,password_hash,college,department,bio,verified,balance,created_at)
                        VALUES (?,?,?,?,?,?,1,?,?)`);
  const uni = 'University Community';
  const ayush = U.run('Ayush Kumar', 'ayush@university.edu', hash, uni, 'Computer Science',
    'Student who enjoys helping others with technology, design and campus activities.', 1240, iso(90)).lastInsertRowid;
  const rahul = U.run('Rahul Sharma', 'rahul@university.edu', hash, uni, 'Electronics', 'Always hungry, always coding.', 0, iso(80)).lastInsertRowid;
  const priya = U.run('Priya Mehta', 'priya@university.edu', hash, uni, 'Design', 'Event lead at the design society.', 0, iso(75)).lastInsertRowid;
  const neha = U.run('Neha Verma', 'neha@university.edu', hash, uni, 'Media Studies', 'Society media head.', 0, iso(60)).lastInsertRowid;

  const S = db.prepare('INSERT INTO user_skills (user_id, skill) VALUES (?,?)');
  ['HTML/CSS', 'Python', 'Graphic Design', 'Video Editing', 'Presentation Design'].forEach((s) => S.run(ayush, s));
  ['Python', 'Java'].forEach((s) => S.run(rahul, s));

  const G = db.prepare(`INSERT INTO gigs (poster_id,worker_id,title,category,description,reward,location,scheduled_at,spots_total,spots_taken,status,created_at,accepted_at,completed_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  // open marketplace gigs (from the Explore page)
  G.run(rahul, null, 'Python Assignment Help', 'academic', 'Need help debugging a Python data-structures assignment (linked lists and trees).', 250, 'Library', inDays(0, '16:00'), null, 0, 'open', iso(0, 9), null, null);
  G.run(priya, null, 'University Fest Volunteer', 'event', 'Help with stalls, queues and stage setup during the university fest. Lunch provided.', 300, 'Main Ground', inDays(1, '10:00'), null, 0, 'open', iso(0, 8), null, null);
  G.run(priya, null, 'Design a poster for club event', 'skills', 'Need a creative poster for our coding club event. Source file + PNG expected.', 400, 'Online', inDays(1, '18:00'), null, 0, 'open', iso(0, 7), null, null);
  G.run(neha, null, 'Parcel pickup from campus gate', 'task', 'Pick up a small parcel and deliver to Hostel Block B.', 80, 'Main Gate', null, null, 0, 'open', iso(0, 6), null, null);
  G.run(neha, null, 'Short video edit for society', 'skills', 'Edit a 30-second Instagram reel for our society. Raw footage provided.', 350, 'Online', inDays(2, '12:00'), null, 0, 'open', iso(0, 5), null, null);
  // food sharing
  [['Chicken Biryani', 120, 'Main Cafeteria', 4, 1], ['Masala Dosa', 70, 'South Indian Corner', 3, 1],
   ['North Indian Thali', 95, 'University Cafeteria', 5, 1], ['Veg Momos', 60, 'Student Food Court', 3, 1]]
    .forEach(([t, r, l, tot, taken], i) => G.run([rahul, priya, neha, rahul][i], null, t, 'food', `Sharing a ${t} order — pay your share on pickup.`, r, l, inDays(0, '13:00'), tot, taken, 'open', iso(0, 4 + i), null, null));
  // Ayush is mid-gig on a task (active + pending earning)
  const parcel = G.run(rahul, ayush, 'Parcel Pickup', 'task', 'Pick up a parcel and drop it at Hostel Block B.', 80, 'Hostel Block B', null, null, 0, 'in_progress', iso(3), iso(3), null).lastInsertRowid;

  // completed history
  const T = db.prepare(`INSERT INTO transactions (user_id,gig_id,type,amount,status,note,created_at,completed_at) VALUES (?,?,?,?,?,?,?,?)`);
  const done = [
    [rahul, 'Python Assignment Help', 'academic', 250, 18, 'Library'],
    [priya, 'Campus Fest Volunteer', 'event', 300, 24, 'Main Ground'],
    [neha, 'Pizza Order Sharing', 'task', 80, 20, 'Main Cafeteria'],
    [priya, 'Event Poster Design', 'skills', 400, 30, 'Online'],
  ];
  const doneIds = done.map(([poster, title, cat, amt, ago, loc]) => {
    const id = G.run(poster, ayush, title, cat, `${title} — completed gig.`, amt, loc, null, null, 0, 'completed', iso(ago + 1), iso(ago + 1), iso(ago)).lastInsertRowid;
    T.run(ayush, id, 'earning', amt, 'completed', title, iso(ago + 1), iso(ago));
    return id;
  });
  T.run(ayush, parcel, 'earning', 80, 'pending', 'Parcel Pickup', iso(3), null);

  const R = db.prepare('INSERT INTO reviews (gig_id,reviewer_id,reviewee_id,rating,comment,created_at) VALUES (?,?,?,?,?,?)');
  R.run(doneIds[0], rahul, ayush, 5, 'Great help with my Python assignment. Explained everything clearly.', iso(17));
  R.run(doneIds[3], priya, ayush, 5, 'Very reliable for the campus event poster. Delivered before the deadline.', iso(29));
  R.run(doneIds[1], priya, ayush, 4, 'Showed up on time and worked hard all day.', iso(23));

  const N = db.prepare('INSERT INTO notifications (user_id,type,title,body,is_read,created_at) VALUES (?,?,?,?,?,?)');
  N.run(ayush, 'gig_completed', 'Gig completed — ₹250 earned', 'Your Python Assignment Help gig was marked complete by Rahul.', 0, iso(0, 11));
  N.run(ayush, 'new_gig', 'New food gig nearby', 'Chicken Biryani sharing is available at the Main Cafeteria.', 0, iso(0, 10));
  N.run(ayush, 'review', 'You received a new review', 'Priya gave you a 5-star rating for your event poster gig.', 1, iso(1));
  N.run(ayush, 'reminder', 'Campus Fest is tomorrow', 'Your volunteer gig starts at 10:00 AM at the Main Ground.', 1, iso(1));
})();

console.log('Seeded. Demo login → ayush@university.edu / Password123');
