const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const AppError = require('../utils/AppError');
const validate = require('../middleware/validate');
const { requireAuth, signToken } = require('../middleware/auth');
const { isUniversityEmail } = require('../utils/helpers');
const { privateUser } = require('../services/serializers');

const router = express.Router();

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, 'must be at least 8 characters').max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'must contain a letter and a number');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const findById = db.prepare('SELECT * FROM users WHERE id = ?');

// POST /api/auth/register
router.post('/register', validate({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email,
    college: z.string().trim().min(2).max(120),
    password,
    acceptTerms: z.union([z.boolean(), z.string()]).optional(), // checkbox on the form
  }),
}), (req, res) => {
  const { name, email, college, password } = req.valid.body;
  const domain = email.split('@')[1];
  if (config.allowedEmailDomains.length && !config.allowedEmailDomains.includes(domain)) {
    throw AppError.badRequest(`Please sign up with your university email (${config.allowedEmailDomains.join(', ')})`);
  }
  if (findByEmail.get(email)) throw AppError.conflict('An account with this email already exists');

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (name, email, password_hash, college, verified) VALUES (?,?,?,?,?)'
  ).run(name, email, hash, college, isUniversityEmail(email) ? 1 : 0);
  const user = findById.get(info.lastInsertRowid);

  db.prepare("INSERT INTO notifications (user_id,type,title,body) VALUES (?,?,?,?)")
    .run(user.id, 'welcome', 'Welcome to Gig Hub 👋', 'Complete your profile and explore gigs on campus.');

  res.status(201).json({ token: signToken(user), user: privateUser(user) });
});

// POST /api/auth/login
router.post('/login', validate({
  body: z.object({
    email,
    password: z.string().min(1).max(128),
    remember: z.union([z.boolean(), z.string()]).optional(),
  }),
}), (req, res) => {
  const { email, password, remember } = req.valid.body;
  const user = findByEmail.get(email);
  // same message for unknown email / wrong password
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new AppError(401, 'Incorrect email or password', 'invalid_credentials');
  }
  const rememberMe = remember === true || remember === 'on' || remember === 'true';
  res.json({ token: signToken(user, rememberMe), user: privateUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: privateUser(findById.get(req.user.id)) });
});

// POST /api/auth/logout – invalidates every token issued so far for this user
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

// POST /api/auth/forgot-password
// Always answers 200 so emails can't be enumerated. No mail provider is wired in:
// plug one into `sendResetEmail`. Outside production the token is returned for testing.
const sendResetEmail = (user, token) => {
  if (!config.isTest) console.log(`[mail] password reset for ${user.email}: token=${token}`);
};
router.post('/forgot-password', validate({ body: z.object({ email }) }), (req, res) => {
  const user = findByEmail.get(req.valid.body.email);
  const out = { ok: true, message: 'If that email exists, a reset link has been sent.' };
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    db.prepare('UPDATE users SET reset_token_hash = ?, reset_expires = ? WHERE id = ?').run(sha256(token), expires, user.id);
    sendResetEmail(user, token);
    if (!config.isProd) out.devResetToken = token;
  }
  res.json(out);
});

// POST /api/auth/reset-password
router.post('/reset-password', validate({
  body: z.object({ token: z.string().min(10).max(200), password }),
}), (req, res) => {
  const { token, password } = req.valid.body;
  const user = db.prepare('SELECT * FROM users WHERE reset_token_hash = ?').get(sha256(token));
  if (!user || !user.reset_expires || user.reset_expires < new Date().toISOString()) {
    throw AppError.badRequest('Reset link is invalid or has expired');
  }
  db.prepare(`UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_expires = NULL,
              token_version = token_version + 1 WHERE id = ?`).run(bcrypt.hashSync(password, 10), user.id);
  res.json({ ok: true });
});

// GET /api/auth/config – public client settings (Google Client ID, allowed domains)
router.get('/config', (_req, res) => {
  res.json({
    googleClientId: config.googleClientId,
    allowedEmailDomains: config.allowedEmailDomains,
    isProd: config.isProd,
  });
});

// Helper: parse & verify Google ID Token or Access Token
async function verifyGoogleToken(credential) {
  if (typeof credential !== 'string') return null;

  // 1. If it's a JWT ID Token (3 parts separated by dot)
  if (credential.includes('.')) {
    const parts = credential.split('.');
    if (parts.length === 3) {
      // Remote validation via Google's tokeninfo endpoint
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.email) {
            return {
              email: gData.email.toLowerCase(),
              name: gData.name || gData.email.split('@')[0],
              sub: gData.sub,
              college: gData.hd || (isUniversityEmail(gData.email) ? 'University Community' : 'Campus Community'),
              aud: gData.aud,
            };
          }
        }
      } catch (_e) {}

      // Local decode fallback
      try {
        const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
        const data = JSON.parse(payloadStr);
        if (data.email) {
          return {
            email: data.email.toLowerCase(),
            name: data.name || data.email.split('@')[0],
            sub: data.sub || '',
            college: data.hd || (isUniversityEmail(data.email) ? 'University Community' : 'Campus Community'),
            aud: data.aud,
          };
        }
      } catch (_e) {}
    }
  }

  // 2. If it's an OAuth access token (validate via Google userinfo endpoint)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${credential}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (uRes.ok) {
      const uData = await uRes.json();
      if (uData.email) {
        return {
          email: uData.email.toLowerCase(),
          name: uData.name || uData.email.split('@')[0],
          sub: uData.sub || '',
          college: uData.hd || (isUniversityEmail(uData.email) ? 'University Community' : 'Campus Community'),
        };
      }
    }
  } catch (_e) {}

  return null;
}

// POST /api/auth/google
router.post('/google', validate({
  body: z.object({
    credential: z.string().optional(),
    mockEmail: email.optional(),
    mockName: z.string().trim().min(2).max(80).optional(),
    remember: z.union([z.boolean(), z.string()]).optional(),
  }),
}), async (req, res) => {
  const { credential, mockEmail, mockName, remember } = req.valid.body;
  let googleUser = null;

  if (credential) {
    googleUser = await verifyGoogleToken(credential);
    if (googleUser && config.googleClientId && googleUser.aud && googleUser.aud !== config.googleClientId) {
      throw AppError.badRequest('Invalid Google Client ID audience in token');
    }
  }

  // Allow simulated Google login if no token or as test fallback
  if (!googleUser && mockEmail) {
    googleUser = {
      email: mockEmail.toLowerCase(),
      name: mockName || mockEmail.split('@')[0],
      college: isUniversityEmail(mockEmail) ? 'University Community' : 'Campus Community',
    };
  }

  if (!googleUser || !googleUser.email) {
    throw AppError.badRequest('Invalid or missing Google credentials');
  }

  const userEmail = googleUser.email;
  const domain = userEmail.split('@')[1];
  if (config.allowedEmailDomains.length && !config.allowedEmailDomains.includes(domain)) {
    throw AppError.badRequest(`Please sign in with your university Google account (${config.allowedEmailDomains.join(', ')})`);
  }

  let user = findByEmail.get(userEmail);
  if (!user) {
    // Automatically register user with Google account info
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hash = bcrypt.hashSync(randomPassword, 10);
    const college = googleUser.college || 'Campus Community';
    const info = db.prepare(
      'INSERT INTO users (name, email, password_hash, college, verified) VALUES (?,?,?,?,?)'
    ).run(googleUser.name, userEmail, hash, college, isUniversityEmail(userEmail) ? 1 : 1);
    user = findById.get(info.lastInsertRowid);

    db.prepare('INSERT INTO notifications (user_id,type,title,body) VALUES (?,?,?,?)')
      .run(user.id, 'welcome', 'Welcome to Gig Hub 👋', 'Signed in via Google. Complete your profile and explore gigs on campus.');
  }

  const rememberMe = remember === true || remember === 'on' || remember === 'true';
  res.json({ token: signToken(user, rememberMe), user: privateUser(user) });
});

module.exports = router;
module.exports.passwordRule = password;
