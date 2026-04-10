const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Register a new user
   */
  async register({ name, email, password, role = 'contributor' }) {
    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      throw err;
    }

    // Only allow contributor/validator self-registration; admins are created manually
    if (role === 'admin') {
      const err = new Error('Cannot self-register as admin');
      err.statusCode = 403;
      throw err;
    }

    const user = await User.create({ name, email, password, role });
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token hash (for rotation)
    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
      lastLoginAt: new Date(),
    });

    logger.info(`New user registered: ${email} as ${role}`);

    return {
      user: this._sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login with email/password
   */
  async login({ email, password }) {
    // Explicitly select password field (excluded by default)
    const user = await User.findOne({ email }).select('+password +refreshTokens');
    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (user.status === 'suspended') {
      const err = new Error('Account suspended. Contact support.');
      err.statusCode = 403;
      throw err;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Rotate: keep only last 5 refresh tokens (multi-device support)
    const tokens = (user.refreshTokens || []).slice(-4);
    tokens.push(refreshToken);

    await User.findByIdAndUpdate(user._id, {
      refreshTokens: tokens,
      lastLoginAt: new Date(),
    });

    logger.info(`User logged in: ${email}`);

    return {
      user: this._sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(token) {
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !user.refreshTokens.includes(token)) {
      const err = new Error('Refresh token not recognized');
      err.statusCode = 401;
      throw err;
    }

    // Rotate: invalidate old, issue new
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    await User.findByIdAndUpdate(user._id, {
      $pull: { refreshTokens: token },
      $push: { refreshTokens: newRefreshToken },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout: invalidate refresh token
   */
  async logout(userId, refreshToken) {
    await User.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: refreshToken },
    });
  }

  /**
   * Logout all devices: clear all refresh tokens
   */
  async logoutAll(userId) {
    await User.findByIdAndUpdate(userId, { refreshTokens: [] });
  }

  _sanitizeUser(user) {
    const obj = user.toObject ? user.toObject() : user;
    delete obj.password;
    delete obj.refreshTokens;
    return obj;
  }
}

module.exports = new AuthService();
