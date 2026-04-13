console.log("🔥 withdrawalController start");
const withdrawalService = require('../services/withdrawalService');

console.log("after with bewfor rozer[ay] withdrawalService");
const razorpayService = require('../services/razorpayService');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/apiResponse');

// User: request withdrawal
const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, payoutMethod, upiId, bankAccount } = req.body;
  const result = await withdrawalService.requestWithdrawal(req.user.id, {
    amount, payoutMethod, upiId, bankAccount
  });
  return sendCreated(res, result, 'Withdrawal request submitted. It will be processed within 1-2 business days.');
});

// User: cancel own withdrawal
const cancelWithdrawal = asyncHandler(async (req, res) => {
  await withdrawalService.cancelWithdrawal(req.params.id, req.user.id);
  return sendSuccess(res, {}, 'Withdrawal cancelled and amount refunded to wallet');
});

// User: my withdrawal history
const getMyWithdrawals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await withdrawalService.getUserWithdrawals(req.user.id, {
    page: parseInt(page), limit: parseInt(limit)
  });
  return sendPaginated(res, result, 'Withdrawal history');
});

// Admin: list all withdrawals
const getAllWithdrawals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const result = await withdrawalService.getAllWithdrawals({
    page: parseInt(page), limit: parseInt(limit), status
  });
  return sendPaginated(res, result, 'Withdrawals retrieved');
});

// Admin: approve and trigger payout
const approveWithdrawal = asyncHandler(async (req, res) => {
  const result = await withdrawalService.approveWithdrawal(req.params.id, req.user.id);
  return sendSuccess(res, result, 'Withdrawal approved and payout initiated');
});

// Admin: reject and refund
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { note } = req.body;
  await withdrawalService.rejectWithdrawal(req.params.id, req.user.id, note);
  return sendSuccess(res, {}, 'Withdrawal rejected and amount refunded');
});

// Razorpay webhook (no auth — verified by signature)
const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  // rawBody is set by express.raw() middleware on this route
  await razorpayService.handleWebhook(req.rawBody, signature);
  return res.json({ received: true });
});

module.exports = {
  requestWithdrawal, cancelWithdrawal, getMyWithdrawals,
  getAllWithdrawals, approveWithdrawal, rejectWithdrawal,
  razorpayWebhook,
};