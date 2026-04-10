const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/apiResponse');

const createLimiter = (options) =>
  rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      sendError(
        res,
        options.message || 'Too many requests, please try again later.',
        429
      );
    },
    keyGenerator: (req) => req.user?.id || req.ip,
  });

// General API limiter
const generalLimiter = createLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
});

// Strict limiter for auth routes
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts, please try again in 15 minutes.',
  keyGenerator: (req) => req.ip, // Rate limit by IP for auth
});

// File upload limiter
const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: 'Upload limit reached. Maximum 50 uploads per hour.',
});

// Assignment request limiter (prevent rapid task-grabbing)
const assignmentLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Please wait before requesting another task.',
});

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  assignmentLimiter,
};
