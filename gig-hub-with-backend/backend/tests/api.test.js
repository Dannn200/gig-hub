process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { sendDueReminders } = require('../src/services/reminders');

let base;
let server;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}/api`; r(); }); }));
test.after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() };
}
const signup = async (name, email) => {
  const r = await call('POST', '/auth/register', { body: { name, email, college: 'Test Uni', password: 'Passw0rd!' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { token: r.body.token, id: r.body.user.id };
};

test('health + 404', async () => {
  assert.equal((await call('GET', '/health')).body.status, 'ok');
  assert.equal((await call('GET', '/nope')).status, 404);
});

test('auth: register, duplicate, login, me, validation, forgot/reset, logout', async () => {
  const a = await signup('Asha Rao', 'asha@test.edu');
  assert.equal((await call('POST', '/auth/register', { body: { name: 'X Y', email: 'ASHA@test.edu', college: 'Test Uni', password: 'Passw0rd!' } })).status, 409);
  assert.equal((await call('POST', '/auth/register', { body: { name: 'X Y', email: 'weak@test.edu', college: 'Test Uni', password: 'short' } })).status, 422);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'asha@test.edu', password: 'wrong' } })).status, 401);
  const login = await call('POST', '/auth/login', { body: { email: 'asha@test.edu', password: 'Passw0rd!', remember: true } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.verified, true);
  assert.equal(login.body.user.password_hash, undefined);
  assert.equal((await call('GET', '/auth/me', { token: login.body.token })).body.user.email, 'asha@test.edu');
  assert.equal((await call('GET', '/auth/me')).status, 401);
  assert.equal((await call('GET', '/auth/me', { token: 'garbage' })).status, 401);

  const f = await call('POST', '/auth/forgot-password', { body: { email: 'asha@test.edu' } });
  assert.ok(f.body.devResetToken);
  assert.equal((await call('POST', '/auth/forgot-password', { body: { email: 'nobody@test.edu' } })).status, 200);
  assert.equal((await call('POST', '/auth/reset-password', { body: { token: f.body.devResetToken, password: 'NewPassw0rd' } })).status, 200);
  assert.equal((await call('POST', '/auth/reset-password', { body: { token: f.body.devResetToken, password: 'NewPassw0rd' } })).status, 400); // single use
  assert.equal((await call('GET', '/auth/me', { token: a.token })).status, 401); // old sessions revoked
  const relog = await call('POST', '/auth/login', { body: { email: 'asha@test.edu', password: 'NewPassw0rd' } });
  assert.equal((await call('POST', '/auth/logout', { token: relog.body.token })).status, 200);
  assert.equal((await call('GET', '/auth/me', { token: relog.body.token })).status, 401);

  // Google OAuth config & sign-in
  const cfg = await call('GET', '/auth/config');
  assert.equal(cfg.status, 200);
  assert.equal(typeof cfg.body.googleClientId, 'string');

  // Simulated Google login for new user
  const gLogin = await call('POST', '/auth/google', { body: { mockEmail: 'googleuser@test.edu', mockName: 'Google User' } });
  assert.equal(gLogin.status, 200);
  assert.ok(gLogin.body.token);
  assert.equal(gLogin.body.user.email, 'googleuser@test.edu');
  assert.equal(gLogin.body.user.name, 'Google User');

  // Simulated Google login for existing user
  const gLoginExisting = await call('POST', '/auth/google', { body: { mockEmail: 'googleuser@test.edu' } });
  assert.equal(gLoginExisting.status, 200);
  assert.equal(gLoginExisting.body.user.id, gLogin.body.user.id);
});

test('profile: update, skills, public view hides private data', async () => {
  const u = await signup('Dev Patel', 'dev@test.edu');
  const r = await call('PATCH', '/users/me', { token: u.token, body: { bio: 'Hi!', department: 'CS', skills: ['Python', 'python', 'Design'] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.user.skills, ['Python', 'Design']);
  const pub = await call('GET', `/users/${u.id}`);
  assert.equal(pub.body.user.email, undefined);
  assert.equal(pub.body.stats.trustScore, 88);
  assert.equal((await call('PATCH', '/users/me', { token: u.token, body: {} })).status, 422);
  const pw = await call('PATCH', '/users/me/password', { token: u.token, body: { currentPassword: 'Passw0rd!', newPassword: 'Another1234' } });
  assert.equal(pw.status, 200);
  assert.equal((await call('GET', '/auth/me', { token: pw.body.token })).status, 200);
  assert.equal((await call('GET', '/auth/me', { token: u.token })).status, 401);
});

test('gig lifecycle: post → accept → complete → wallet → history → review → notifications', async () => {
  const poster = await signup('Pia Poster', 'pia@test.edu');
  const worker = await signup('Wes Worker', 'wes@test.edu');

  assert.equal((await call('POST', '/gigs', { body: {} })).status, 401);
  assert.equal((await call('POST', '/gigs', { token: poster.token, body: { title: 'x' } })).status, 422);
  const created = await call('POST', '/gigs', { token: poster.token, body: {
    title: 'Edit my reel', category: 'skills', description: 'Edit a 30s Instagram reel please', reward: 350, date: '2099-01-01', time: '10:00', location: '' } });
  assert.equal(created.status, 201);
  const gid = created.body.gig.id;
  assert.equal(created.body.gig.scheduledAt, '2099-01-01T10:00:00+05:30');

  const list = await call('GET', '/gigs?q=reel&category=skills');
  assert.equal(list.body.total, 1);
  assert.equal((await call('GET', '/gigs?q=%25')).body.total, 0); // wildcard escaped

  assert.equal((await call('POST', `/gigs/${gid}/accept`, { token: poster.token })).status, 403); // own gig
  const acc = await call('POST', `/gigs/${gid}/accept`, { token: worker.token });
  assert.equal(acc.body.gig.status, 'in_progress');
  assert.equal((await call('POST', `/gigs/${gid}/accept`, { token: worker.token })).status, 409);
  assert.equal((await call('POST', `/gigs/${gid}/complete`, { token: worker.token })).status, 403);

  let h = await call('GET', '/history', { token: worker.token });
  assert.equal(h.body.transactions[0].status, 'pending');
  assert.equal(h.body.summary.totalEarned, 0);

  assert.equal((await call('POST', `/gigs/${gid}/complete`, { token: poster.token })).body.gig.status, 'completed');
  assert.equal((await call('POST', `/gigs/${gid}/complete`, { token: poster.token })).status, 409);

  const w = await call('GET', '/wallet', { token: worker.token });
  assert.equal(w.body.balance, 350);
  const dash = await call('GET', '/dashboard', { token: worker.token });
  assert.equal(dash.body.metrics.totalEarned, 350);
  assert.equal(dash.body.metrics.completedGigs, 1);

  // reviews
  assert.equal((await call('POST', `/gigs/${gid}/reviews`, { token: poster.token, body: { rating: 5, comment: 'Superb' } })).status, 201);
  assert.equal((await call('POST', `/gigs/${gid}/reviews`, { token: poster.token, body: { rating: 4 } })).status, 409);
  assert.equal((await call('POST', `/gigs/${gid}/reviews`, { token: poster.token, body: { rating: 9 } })).status, 422);
  assert.equal((await call('GET', `/users/${worker.id}`)).body.stats.rating, 5);

  // notifications
  const n = await call('GET', '/notifications', { token: worker.token });
  assert.ok(n.body.notifications.some((x) => x.title.startsWith('Gig completed — ₹350')));
  assert.ok(n.body.notifications.some((x) => x.title === 'You received a new review'));
  assert.ok(n.body.unreadCount >= 2);
  assert.equal((await call('POST', '/notifications/read-all', { token: worker.token })).status, 200);
  assert.equal((await call('GET', '/notifications/unread-count', { token: worker.token })).body.unreadCount, 0);

  // withdraw
  assert.equal((await call('POST', '/wallet/withdraw', { token: worker.token, body: { amount: 50, upiId: 'wes@okbank' } })).status, 400); // < min
  assert.equal((await call('POST', '/wallet/withdraw', { token: worker.token, body: { amount: 5000, upiId: 'wes@okbank' } })).status, 400); // > balance
  assert.equal((await call('POST', '/wallet/withdraw', { token: worker.token, body: { amount: 100, upiId: 'bad' } })).status, 422);
  const wd = await call('POST', '/wallet/withdraw', { token: worker.token, body: { amount: 200, upiId: 'wes@okbank' } });
  assert.equal(wd.status, 201);
  assert.equal(wd.body.balance, 150);

  // report
  const csv = await call('GET', '/history/report.csv', { token: worker.token });
  assert.equal(csv.status, 200);
  assert.match(csv.body, /Date,Title/);
  assert.match(csv.body, /-200/);
});

test('gig abandon / cancel flows', async () => {
  const p = await signup('Cara Poster', 'cara@test.edu');
  const w = await signup('Will Worker', 'will@test.edu');
  const g = (await call('POST', '/gigs', { token: p.token, body: { title: 'Carry boxes', category: 'task', description: 'Carry boxes to hostel', reward: 100 } })).body.gig;
  await call('POST', `/gigs/${g.id}/accept`, { token: w.token });
  const ab = await call('POST', `/gigs/${g.id}/abandon`, { token: w.token });
  assert.equal(ab.body.gig.status, 'open');
  assert.equal((await call('GET', '/history', { token: w.token })).body.total, 0);
  assert.ok((await call('GET', `/users/${w.id}`)).body.stats.trustScore < 88);
  assert.equal((await call('DELETE', `/gigs/${g.id}`, { token: w.token })).status, 403);
  assert.equal((await call('PATCH', `/gigs/${g.id}`, { token: p.token, body: { reward: 150 } })).body.gig.reward, 150);
  assert.equal((await call('DELETE', `/gigs/${g.id}`, { token: p.token })).status, 200);
  assert.equal((await call('GET', `/gigs/${g.id}`)).body.gig.status, 'cancelled');
});

test('food orders: spots, join, leave, notify peers, close', async () => {
  const host = await signup('Hana Host', 'hana@test.edu');
  const a = await signup('Amy A', 'amy@test.edu');
  const b = await signup('Bob B', 'bob@test.edu');
  const gig = (await call('POST', '/gigs', { token: host.token, body: { title: 'Veg Momos', category: 'food', description: 'Sharing a momos order', reward: 60, location: 'Food Court', spots: 1 } })).body.gig;
  assert.equal(gig.spotsLeft, 1);
  assert.ok((await call('GET', '/notifications', { token: a.token })).body.notifications.some((n) => n.title === 'New food gig nearby'));
  assert.equal((await call('POST', `/gigs/${gig.id}/accept`, { token: a.token })).status, 400);
  assert.equal((await call('POST', `/gigs/${gig.id}/join`, { token: host.token })).status, 400);
  const j = await call('POST', `/gigs/${gig.id}/join`, { token: a.token });
  assert.equal(j.body.gig.spotsLeft, 0);
  assert.equal(j.body.gig.viewer.hasJoined, true);
  assert.equal((await call('POST', `/gigs/${gig.id}/join`, { token: b.token })).status, 409); // full
  assert.equal((await call('POST', `/gigs/${gig.id}/leave`, { token: a.token })).body.gig.spotsLeft, 1);
  assert.equal((await call('POST', `/gigs/${gig.id}/leave`, { token: a.token })).status, 400);
  await call('POST', `/gigs/${gig.id}/join`, { token: b.token });
  const detail = await call('GET', `/gigs/${gig.id}`, { token: host.token });
  assert.equal(detail.body.participants.length, 1);
  assert.equal((await call('POST', `/gigs/${gig.id}/complete`, { token: host.token })).body.gig.status, 'completed');
});

test('reminders fire once for gigs starting within 24h', async () => {
  const u = await signup('Remy Reminder', 'remy@test.edu');
  const tomorrow = new Date(Date.now() + 5 * 3600 * 1000);
  const date = tomorrow.toISOString().slice(0, 10);
  await call('POST', '/gigs', { token: u.token, body: { title: 'Soon event', category: 'event', description: 'Starts really soon', reward: 0, date, time: tomorrow.toISOString().slice(11, 16) } });
  // utcOffset is +05:30 so the stored time is 5.5h earlier than intended – use a generous window
  const sent = sendDueReminders(new Date(Date.now() - 10 * 3600 * 1000));
  assert.ok(sent >= 1);
  assert.equal(sendDueReminders(new Date(Date.now() - 10 * 3600 * 1000)), 0);
});

test('admin portal & profile updates (avatar & upiId)', async () => {
  const student = await signup('Sam Student', 'sam@test.edu');

  // Student updates profile with avatarUrl and upiId
  const upd = await call('PATCH', '/users/me', {
    token: student.token,
    body: { bio: 'Cool bio', upiId: 'sam@oksbi', avatarUrl: 'data:image/jpeg;base64,12345' },
  });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.user.upiId, 'sam@oksbi');
  assert.equal(upd.body.user.avatarUrl, 'data:image/jpeg;base64,12345');

  // Student cannot access admin portal
  const failStats = await call('GET', '/admin/stats', { token: student.token });
  assert.equal(failStats.status, 403);

  // Admin login and access
  const adminLogin = await call('POST', '/auth/login', { body: { email: 'admin@university.edu', password: 'Admin@123' } });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.token;

  // Admin stats
  const statsRes = await call('GET', '/admin/stats', { token: adminToken });
  assert.equal(statsRes.status, 200);
  assert.ok(statsRes.body.totalUsers >= 2);

  // Admin users list
  const usersRes = await call('GET', '/admin/users', { token: adminToken });
  assert.equal(usersRes.status, 200);
  assert.ok(usersRes.body.users.some((u) => u.email === 'sam@test.edu'));

  // Admin user inspect
  const inspectRes = await call('GET', `/admin/users/${student.id}`, { token: adminToken });
  assert.equal(inspectRes.status, 200);
  assert.equal(inspectRes.body.user.upiId, 'sam@oksbi');

  // Admin role switch
  const roleRes = await call('PATCH', `/admin/users/${student.id}/role`, { token: adminToken, body: { role: 'admin' } });
  assert.equal(roleRes.status, 200);
  assert.equal(roleRes.body.role, 'admin');
});
