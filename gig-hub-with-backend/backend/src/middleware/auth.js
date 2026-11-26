const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const AppError = require('../utils/AppError');

const getUser = db.prepare('SELECT id, name, email, college, role, token_version FROM users WHERE id = ?');

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

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!req.user || req.user.role !== 'admin') {
      return next(AppError.forbidden('Admin privileges required'));
    }
    next();
  });
};

const signToken = (user) =>
  jwt.sign({ sub: user.id, tv: user.token_version }, config.jwtSecret, {
    expiresIn: config.rememberTtl, // 3650d permanent session
  });

module.exports = { requireAuth, requireAdmin, optionalAuth, signToken };
