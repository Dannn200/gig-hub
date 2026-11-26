require('dotenv').config();
const path = require('path');

const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET === 'change-me-in-production')) {
  console.warn('[warning] JWT_SECRET is not set in environment variables. Using auto-generated fallback secret.');
}

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

module.exports = {
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT) || 4000,
  jwtSecret: env.JWT_SECRET && env.JWT_SECRET !== 'change-me-in-production'
    ? env.JWT_SECRET
    : 'gig-hub-production-secure-default-jwt-token-key-2026',
  dbPath: env.DB_PATH ? (env.DB_PATH === ':memory:' ? ':memory:' : path.resolve(env.DB_PATH)) : path.resolve(__dirname, '../data/gighub.db'),
  corsOrigins: list(env.CORS_ORIGIN || '*'),
  allowedEmailDomains: list(env.ALLOWED_EMAIL_DOMAINS).map((d) => d.toLowerCase().replace(/^@/, '')),
  utcOffset: env.APP_UTC_OFFSET || '+05:30',
  minWithdrawal: Number(env.MIN_WITHDRAWAL) || 100,
  googleClientId: env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: env.GOOGLE_CLIENT_SECRET || '',
  serveFrontend: env.SERVE_FRONTEND ? env.SERVE_FRONTEND === 'true' : true,
  frontendDir: path.resolve(__dirname, '../..'),
  // session lengths (permanent: sessions do not expire)
  tokenTtl: '3650d',
  rememberTtl: '3650d',
};
