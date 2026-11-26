const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./db');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1); // behind Render/Railway/Heroku-style proxies
app.disable('x-powered-by');

app.use(helmet({ contentSecurityPolicy: config.serveFrontend ? false : undefined }));
app.use(cors({
  origin(origin, cb) {
    // same-origin / curl (no Origin header) and whitelisted frontends only
    if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 600,
}));
if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' })); // plain HTML <form> posts

const limiter = (windowMs, max) => rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: { code: 'rate_limited', message: 'Too many requests, please try again later' } },
});
app.use('/api', limiter(60 * 1000, 200));
app.use('/api/auth', limiter(15 * 60 * 1000, 30));

app.get('/api/health', (_req, res) => {
  db.prepare('SELECT 1').get();
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/gigs', require('./routes/gigs'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/history', require('./routes/history'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', notFound);

// Optional: serve the static HTML frontend from the project root (local dev convenience).
// Only whitelisted asset types, and never anything under /backend.
if (config.serveFrontend) {
  const ALLOWED = /^\/(?!backend\/)[\w\-./]*\.(html|css|js|svg|png|jpe?g|webp|ico|woff2?)$/i;
  const serveStatic = express.static(config.frontendDir, { dotfiles: 'deny', index: 'index.html' });
  app.use((req, res, next) => {
    const ok = (req.method === 'GET' || req.method === 'HEAD') && (req.path === '/' || ALLOWED.test(req.path));
    return ok ? serveStatic(req, res, next) : next();
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
