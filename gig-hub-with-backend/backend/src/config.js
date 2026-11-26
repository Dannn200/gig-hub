require('dotenv').config();
const path = require('path');

const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET === 'change-me-in-production')) {
  throw new Error('JWT_SECRET must be set to a strong random value in production');
}

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

module.exports = {
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT) || 4000,
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-do-not-use-in-production',
  dbPath: env.DB_PATH ? (env.DB_PATH === ':memory:' ? ':memory:' : path.resolve(env.DB_PATH)) : path.resolve(__dirname, '../data/gighub.db'),
  corsOrigins: list(env.CORS_ORIGIN),
  allowedEmailDomains: list(env.ALLOWED_EMAIL_DOMAINS).map((d) => d.toLowerCase().replace(/^@/, '')),
  utcOffset: env.APP_UTC_OFFSET || '+05:30',
  minWithdrawal: Number(env.MIN_WITHDRAWAL) || 100,
  googleClientId: env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: env.GOOGLE_CLIENT_SECRET || '',
  serveFrontend: env.SERVE_FRONTEND === 'true',
  frontendDir: path.resolve(__dirname, '../..'),
  // session lengths
  tokenTtl: '1d',
  rememberTtl: '30d',
};
