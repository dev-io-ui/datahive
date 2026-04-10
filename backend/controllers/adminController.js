const User = require('../models/User');
const analyticsService = require('../services/analyticsService');
const walletService = require('../services/walletService');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  sendSuccess, sendPaginated, sendNotFound, sendBadRequest
} = require('../utils/apiResponse');

// ── Admin: User Management ───────────────────────────────────────────────────

const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, status, search } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const result = await User.paginate(filter, {
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 100),
    select: '-password -refreshTokens',
    sort: { createdAt: -1 },
  });
  return sendPaginated(res, result, 'Users retrieved');
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -refreshTokens');
  if (!user) return sendNotFound(res, 'User not found');
  return sendSuccess(res, user);
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return sendBadRequest(res, 'Status must be active or suspended');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).select('-password -refreshTokens');

  if (!user) return sendNotFound(res, 'User not found');
  return sendSuccess(res, user, `User ${status}`);
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['contributor', 'validator', 'admin'].includes(role)) {
    return sendBadRequest(res, 'Invalid role');
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
    .select('-password -refreshTokens');
  if (!user) return sendNotFound(res, 'User not found');
  return sendSuccess(res, user, 'User role updated');
});

// ── Admin: Analytics ─────────────────────────────────────────────────────────

const getDashboard = asyncHandler(async (req, res) => {
  const stats = await analyticsService.getDashboardStats();
  return sendSuccess(res, stats, 'Dashboard stats');
});

const getLeaderboard = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const data = await analyticsService.getLeaderboard(limit);
  return sendSuccess(res, data);
});

// ── Admin: Dataset Export ─────────────────────────────────────────────────────

const exportDataset = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const format = req.query.format || 'json';

  if (!['json', 'csv'].includes(format)) {
    return sendBadRequest(res, 'Format must be json or csv');
  }

  const data = await analyticsService.exportDataset(taskId, format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dataset-${taskId}.csv"`);
    return res.send(data);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="dataset-${taskId}.json"`);
  return res.send(data);
});

// ── Wallet ───────────────────────────────────────────────────────────────────

const getMyWallet = asyncHandler(async (req, res) => {
  const data = await walletService.getWalletSummary(req.user.id);
  return sendSuccess(res, data);
});

const getMyTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const result = await walletService.getTransactions(req.user.id, {
    page: parseInt(page), limit: parseInt(limit), type,
  });
  return sendPaginated(res, result, 'Transactions retrieved');
});

const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, method, accountInfo } = req.body;
  if (!amount || amount <= 0) return sendBadRequest(res, 'Valid amount required');
  const result = await walletService.requestWithdrawal(req.user.id, amount, { method, accountInfo });
  return sendSuccess(res, result, 'Withdrawal requested');
});

const adminAdjustWallet = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { amount, description } = req.body;
  const result = await walletService.adminAdjust(userId, amount, req.user.id, description);
  return sendSuccess(res, result, 'Wallet adjusted');
});

module.exports = {
  getAllUsers, getUser, updateUserStatus, updateUserRole,
  getDashboard, getLeaderboard, exportDataset,
  getMyWallet, getMyTransactions, requestWithdrawal, adminAdjustWallet,
};
