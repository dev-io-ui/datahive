const mongoose = require('mongoose');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const logger = require('../utils/logger');

class WalletService {
  /**
   * Generic credit operation (atomic)
   * Uses findOneAndUpdate to atomically update balance and record transaction
   */
  async credit(userId, amount, type, reference = {}, description = '') {
    if (amount <= 0) throw new Error('Credit amount must be positive');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            'wallet.balance': amount,
            'wallet.totalEarned': amount,
          },
        },
        { new: true, session }
      );

      if (!user) throw new Error('User not found');

      const tx = await WalletTransaction.create(
        [{
          user: userId,
          type,
          amount,
          status: 'completed',
          reference,
          description: description || `${type} credit`,
          balanceAfter: user.wallet.balance,
        }],
        { session }
      );

      await session.commitTransaction();
      logger.info(`Wallet credit: user=${userId} amount=${amount} type=${type} balance=${user.wallet.balance}`);
      return { transaction: tx[0], newBalance: user.wallet.balance };
    } catch (err) {
      await session.abortTransaction();
      logger.error(`Wallet credit failed: user=${userId} amount=${amount}`, err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Generic debit operation (atomic, checks sufficient balance)
   */
  async debit(userId, amount, type, reference = {}, description = '') {
    if (amount <= 0) throw new Error('Debit amount must be positive');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Atomic debit with balance check
      const user = await User.findOneAndUpdate(
        {
          _id: userId,
          'wallet.balance': { $gte: amount }, // Only deduct if sufficient balance
        },
        {
          $inc: {
            'wallet.balance': -amount,
            'wallet.totalWithdrawn': amount,
          },
        },
        { new: true, session }
      );

      if (!user) {
        const err = new Error('Insufficient balance');
        err.statusCode = 400;
        throw err;
      }

      const tx = await WalletTransaction.create(
        [{
          user: userId,
          type,
          amount: -amount,
          status: 'completed',
          reference,
          description: description || `${type} debit`,
          balanceAfter: user.wallet.balance,
        }],
        { session }
      );

      await session.commitTransaction();
      return { transaction: tx[0], newBalance: user.wallet.balance };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async creditContributor(userId, amount, reference) {
    return this.credit(userId, amount, 'submission_reward', reference, 'Submission accepted reward');
  }

  async creditValidator(userId, amount, reference) {
    return this.credit(userId, amount, 'validation_reward', reference, 'Validation reward');
  }

  async requestWithdrawal(userId, amount, withdrawalDetails) {
    return this.debit(userId, amount, 'withdrawal', {}, `Withdrawal to ${withdrawalDetails.method}`);
  }

  /**
   * Get transaction history (paginated)
   */
  async getTransactions(userId, { page = 1, limit = 20, type } = {}) {
    const filter = { user: userId };
    if (type) filter.type = type;

    return WalletTransaction.paginate(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  /**
   * Get wallet summary for a user
   */
  async getWalletSummary(userId) {
    const user = await User.findById(userId).select('wallet');
    const recentTx = await WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    return { wallet: user.wallet, recentTransactions: recentTx };
  }

  /**
   * Admin: adjust wallet balance manually
   */
  async adminAdjust(userId, amount, adminId, description) {
    const type = amount > 0 ? 'bonus' : 'penalty';
    const absAmount = Math.abs(amount);
    const fn = amount > 0 ? this.credit.bind(this) : this.debit.bind(this);
    return fn(userId, absAmount, type, {}, description);
  }

  /**
   * Platform-wide wallet analytics (admin)
   */
  async getPlatformStats() {
    const [result] = await WalletTransaction.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);
    return result;
  }
}

module.exports = new WalletService();
