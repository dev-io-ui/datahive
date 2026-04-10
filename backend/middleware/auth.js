const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { sendUnauthorized, sendForbidden } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * authenticate — verifies JWT and attaches user to req
 * Extracts token from Authorization: Bearer <token> header
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. Get token
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return sendUnauthorized(res, 'Authentication token required');
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendUnauthorized(res, 'Token expired. Please login again.');
      }
      return sendUnauthorized(res, 'Invalid token');
    }

    // 3. Check user still exists and is active
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
      return sendUnauthorized(res, 'User no longer exists');
    }

    if (user.status === 'suspended') {
      return sendForbidden(res, 'Your account has been suspended');
    }

    // 4. Check if password was changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return sendUnauthorized(res, 'Password recently changed. Please login again.');
    }

    // 5. Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return sendUnauthorized(res, 'Authentication failed');
  }
};

/**
 * authorize — RBAC middleware factory
 * Usage: authorize('admin'), authorize('admin', 'validator')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendUnauthorized(res, 'Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      return sendForbidden(
        res,
        `Role '${req.user.role}' is not authorized for this action`
      );
    }

    next();
  };
};

/**
 * optionalAuth — attaches user if token present, but doesn't fail if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (user && user.status === 'active') {
        req.user = user;
      }
    }
  } catch (err) {
    // Silently ignore auth errors for optional auth
  }
  next();
};

module.exports = { authenticate, authorize, optionalAuth };
