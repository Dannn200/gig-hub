const AppError = require('../utils/AppError');
const config = require('../config');

const notFound = (req, _res, next) => next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'bad_json', message: 'Malformed JSON body' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'too_large', message: 'Request body too large' } });
  }
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: { code: 'conflict', message: 'Resource already exists' } });
  }
  if (!config.isTest) console.error(err);
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
};

module.exports = { notFound, errorHandler };
