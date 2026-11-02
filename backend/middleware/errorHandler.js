const { AppError } = require('../engine/errors');

function notFound(req, _res, next) {
  next(new AppError(`No API route for ${req.method} ${req.originalUrl}.`, { status: 404, code: 'NOT_FOUND' }));
}

// Single place that turns errors into JSON. Internal details never reach the client.
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON.' } });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'That record already exists.' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again.' } });
}

module.exports = { notFound, errorHandler };
