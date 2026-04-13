
const WithdrawalRequest = require('../models/WithdrawalRequest');
const walletService = require('./walletService');
const razorpayService = require('./razorpayService');
const logger = require('../utils/logger');

const MIN_WITHDRAWAL = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT) || 10;

class WithdrawalService {
  /**
   * User submits a withdrawal request.
   * We immediately debit the wallet (hold the funds) to prevent double-spend.
   * If request is rejected, we refund.
   */
  async requestWithdrawal(userId, { amount, payoutMethod, upiId, bankAccount }) {
    if (amount < MIN_WITHDRAWAL) {
      const err = new Error(`Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}`);
      err.statusCode = 400;
      throw err;
    }

    // Validate payout details
    if (payoutMethod === 'upi' && !upiId) {
      const err = new Error('UPI ID is required');
      err.statusCode = 400;
      throw err;
    }
    if (payoutMethod === 'bank_transfer' && (!bankAccount?.accountNumber || !bankAccount?.ifsc)) {
      const err = new Error('Account number and IFSC are required for bank transfer');
      err.statusCode = 400;
      throw err;
    }

    // Debit wallet immediately (hold funds)
    const { transaction } = await walletService.debit(
      userId, amount, 'withdrawal',
      {}, `Withdrawal request — ₹${amount} via ${payoutMethod}`
    );

    // Create withdrawal request record
    const withdrawalReq = await WithdrawalRequest.create({
      user: userId,
      amount,
      payoutMethod,
      upiId,
      bankAccount,
      walletTransaction: transaction._id,
      status: 'pending',
    });

    logger.info(`Withdrawal request created: ${withdrawalReq._id} for user ${userId}, ₹${amount}`);
    return withdrawalReq;
  }

  /**
   * Admin approves a withdrawal — triggers Razorpay payout
   */
  async approveWithdrawal(requestId, adminId) {
    const request = await WithdrawalRequest.findById(requestId);
    if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    if (request.status !== 'pending') {
      throw Object.assign(new Error(`Cannot approve — status is ${request.status}`), { statusCode: 400 });
    }

    await WithdrawalRequest.findByIdAndUpdate(requestId, {
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: new Date(),
    });

    // Trigger Razorpay payout
    const result = await razorpayService.processWithdrawal(requestId);
    return result;
  }

  /**
   * Admin rejects — refunds wallet
   */
  async rejectWithdrawal(requestId, adminId, note) {
    const request = await WithdrawalRequest.findById(requestId);
    if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    if (!['pending'].includes(request.status)) {
      throw Object.assign(new Error('Can only reject pending requests'), { statusCode: 400 });
    }

    await WithdrawalRequest.findByIdAndUpdate(requestId, {
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      reviewNote: note,
    });

    // Refund wallet
    await walletService.credit(
      request.user, request.amount, 'withdrawal_reversal',
      { withdrawal: requestId },
      `Withdrawal rejected — refunded: ${note || 'Admin rejection'}`
    );

    logger.info(`Withdrawal ${requestId} rejected and refunded`);
  }

  /**
   * User cancels their own pending request
   */
  async cancelWithdrawal(requestId, userId) {
    const request = await WithdrawalRequest.findOne({ _id: requestId, user: userId });
    if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    if (request.status !== 'pending') {
      throw Object.assign(new Error('Only pending requests can be cancelled'), { statusCode: 400 });
    }

    await WithdrawalRequest.findByIdAndUpdate(requestId, { status: 'cancelled' });
    await walletService.credit(
      userId, request.amount, 'withdrawal_reversal',
      { withdrawal: requestId }, 'Withdrawal cancelled — refunded'
    );
  }

  /**
   * Get withdrawal history for a user
   */
  async getUserWithdrawals(userId, { page = 1, limit = 20 } = {}) {
    return WithdrawalRequest.paginate(
      { user: userId },
      { page, limit, sort: { createdAt: -1 } }
    );
  }

  /**
   * Admin: get all pending withdrawals
   */
  async getAllWithdrawals({ page = 1, limit = 20, status } = {}) {
    const filter = {};
    if (status) filter.status = status;
    return WithdrawalRequest.paginate(filter, {
      page, limit,
      populate: { path: 'user', select: 'name email wallet' },
      sort: { createdAt: -1 },
    });
  }
}

module.exports = new WithdrawalService();