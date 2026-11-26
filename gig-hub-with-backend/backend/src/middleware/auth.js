const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const AppError = require('../utils/AppError');

const getUser = db.prepare('SELECT id, name, email, college, token_version FROM users WHERE id = ?');

function resolve(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret); } catch { throw AppError.unauthorized('Invalid or expired token'); }
  const user = getUser.get(payload.sub);
  if (!user || user.token_version !== payload.tv) throw AppError.unauthorized('Session is no longer valid, please log in again');
  return user;
}

const requireAuth = (req, _res, next) => {
  try {
    const user = resolve(req);
    if (!user) throw AppError.unauthorized();
    req.user = user;
    next();
  } catch (e) { next(e); }
};

const optionalAuth = (req, _res, next) => {
  try { req.user = resolve(req) || null; next(); } catch (e) { next(e); }
};

const signToken = (user, remember = false) =>
  jwt.sign({ sub: user.id, tv: user.token_version }, config.jwtSecret, {
    expiresIn: remember ? config.rememberTtl : config.tokenTtl,
  });

module.exports = { requireAuth, optionalAuth, signToken };
