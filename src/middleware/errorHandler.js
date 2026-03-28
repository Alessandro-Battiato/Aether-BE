export class AppError extends Error {
  /**
   * @param {string} message  Human-readable error message
   * @param {number} statusCode  HTTP status code (default 500)
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Express global error-handling middleware (must have 4 params). */
export const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode ?? 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
