const AppError = require('../utils/AppError');

/** validate({ body, query, params }) – parsed values land in req.valid.{body,query,params} */
module.exports = (schemas) => (req, _res, next) => {
  req.valid = req.valid || {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(new AppError(422, details[0] ? `${details[0].field || part}: ${details[0].message}` : 'Invalid input', 'validation_error', details));
    }
    req.valid[part] = result.data;
  }
  next();
};
