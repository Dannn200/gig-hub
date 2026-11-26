class AppError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || 'error';
    this.details = details;
  }
  static badRequest(msg = 'Bad request', details) { return new AppError(400, msg, 'bad_request', details); }
  static unauthorized(msg = 'Authentication required') { return new AppError(401, msg, 'unauthorized'); }
  static forbidden(msg = 'You are not allowed to do that') { return new AppError(403, msg, 'forbidden'); }
  static notFound(msg = 'Not found') { return new AppError(404, msg, 'not_found'); }
  static conflict(msg = 'Conflict') { return new AppError(409, msg, 'conflict'); }
}
module.exports = AppError;
