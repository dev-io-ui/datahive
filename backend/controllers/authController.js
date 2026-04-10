const authService = require('../services/authService');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const result = await authService.register({ name, email, password, role });
  return sendCreated(res, result, 'Registration successful');
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  return sendSuccess(res, result, 'Login successful');
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token required' });
  }
  const tokens = await authService.refreshToken(refreshToken);
  return sendSuccess(res, tokens, 'Token refreshed');
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await authService.logout(req.user.id, refreshToken);
  return sendSuccess(res, {}, 'Logged out successfully');
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  return sendSuccess(res, {}, 'Logged out from all devices');
});

const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, req.user, 'User profile retrieved');
});

module.exports = { register, login, refreshToken, logout, logoutAll, getMe };
