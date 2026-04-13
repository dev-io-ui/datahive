const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');
const walletService = require('./walletService');
const logger = require('../utils/logger');

/**
 * Razorpay Payouts API integration
 *
 * Razorpay X (Current Account) is required for payouts.
 * Sign up at: https://razorpay.com/x/
 *
 * Flow:
 * 1. Create/fetch Contact for the user
 * 2. Create Fund Account (UPI ID or bank account)
 * 3. Create Payout (triggers actual money transfer)
 * 4. Webhook updates status asynchronously
 *
 * Test mode:
 * - Use test API keys (rzp_test_xxx)
 * - UPI payouts work in test mode to any UPI ID
 * - No real money is moved
 */

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RZP_ACCOUNT_NUMBER = process.env.RAZORPAY_ACCOUNT_NUMBER; // Your RazorpayX current account
const RZP_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const rzpAuth = {
  username: RZP_KEY_ID,
  password: RZP_KEY_SECRET,
};

const rzpBase = 'https://api.razorpay.com/v1';

// ── Helper: Razorpay API call ─────────────────────────────────────────────────
const rzpCall = async (method, path, data = {}) => {
  try {
    const res = await axios({
      method,
      url: `${rzpBase}${path}`,
      auth: rzpAuth,
      data,
      headers: { 'Content-Type': 'application/json' },
    });
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.error?.description || err.message;
    logger.error(`Razorpay API error [${method} ${path}]:`, msg);
    throw new Error(`Razorpay: ${msg}`);
  }
};

class RazorpayService {
  /**
   * Step 1: Create or retrieve a Razorpay Contact for a user.
   * Contacts represent the recipient of a payout.
   */
  async getOrCreateContact(user) {
    // If we already have a contact for this user, reuse it
    // (store contactId in user profile for efficiency — check DB first)
    const existingRequest = await WithdrawalRequest.findOne({
      user: user._id,
      'razorpay.contactId': { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    if (existingRequest?.razorpay?.contactId) {
      return existingRequest.razorpay.contactId;
    }

    // Create new contact
    const contact = await rzpCall('POST', '/contacts', {
      name: user.name,
      email: user.email,
      type: 'employee', // or 'vendor', 'customer'
      reference_id: user._id.toString(),
    });

    return contact.id;
  }

  /**
   * Step 2: Create a Fund Account (UPI or bank) linked to the contact.
   * Fund accounts are the actual destination for payouts.
   */
  async createFundAccount(contactId, payoutMethod, details) {
    let fundAccountData = {
      contact_id: contactId,
    };

    if (payoutMethod === 'upi') {
      fundAccountData.account_type = 'vpa'; // Virtual Payment Address
      fundAccountData.vpa = { address: details.upiId };
    } else if (payoutMethod === 'bank_transfer') {
      fundAccountData.account_type = 'bank_account';
      fundAccountData.bank_account = {
        name: details.accountHolderName,
        ifsc: details.ifsc,
        account_number: details.accountNumber,
      };
    }

    const fundAccount = await rzpCall('POST', '/fund_accounts', fundAccountData);
    return fundAccount.id;
  }

  /**
   * Step 3: Initiate the actual payout.
   * This moves money from your RazorpayX account to the fund account.
   */
  async createPayout(fundAccountId, amountInRupees, referenceId, purpose = 'payout') {
    const payout = await rzpCall('POST', '/payouts', {
      account_number: RZP_ACCOUNT_NUMBER,
      fund_account_id: fundAccountId,
      amount: Math.round(amountInRupees * 100), // Razorpay uses paise (1 INR = 100 paise)
      currency: 'INR',
      mode: 'UPI',         // UPI for instant, NEFT/IMPS/RTGS for bank
      purpose,
      queue_if_low_balance: true,
      reference_id: referenceId,
      narration: `DataHive withdrawal ${referenceId}`,
    });

    return payout;
  }

  /**
   * Full withdrawal flow: debit wallet → create razorpay payout
   */
  async processWithdrawal(withdrawalRequestId) {
    const request = await WithdrawalRequest.findById(withdrawalRequestId).populate('user');
    if (!request) throw new Error('Withdrawal request not found');
    if (request.status !== 'approved') throw new Error('Request must be approved first');

    const { user, amount, payoutMethod } = request;

    try {
      // Update status to processing
      await WithdrawalRequest.findByIdAndUpdate(withdrawalRequestId, {
        status: 'processing',
        processedAt: new Date(),
      });

      // Step 1: Get/create contact
      const contactId = await this.getOrCreateContact(user);

      // Step 2: Create fund account
      const fundAccountId = await this.createFundAccount(contactId, payoutMethod, {
        upiId: request.upiId,
        accountNumber: request.bankAccount?.accountNumber,
        ifsc: request.bankAccount?.ifsc,
        accountHolderName: request.bankAccount?.accountHolderName,
      });

      // Step 3: Create payout
      const referenceId = `DH-${withdrawalRequestId.toString().slice(-8).toUpperCase()}`;
      const payout = await this.createPayout(fundAccountId, amount, referenceId);

      // Save Razorpay details
      await WithdrawalRequest.findByIdAndUpdate(withdrawalRequestId, {
        'razorpay.contactId': contactId,
        'razorpay.fundAccountId': fundAccountId,
        'razorpay.payoutId': payout.id,
        'razorpay.payoutStatus': payout.status,
        'razorpay.referenceId': referenceId,
      });

      logger.info(`Razorpay payout initiated: ${payout.id} for ${amount} INR to user ${user._id}`);
      return { success: true, payoutId: payout.id, status: payout.status };

    } catch (err) {
      // Payout failed — refund wallet
      logger.error(`Payout failed for withdrawal ${withdrawalRequestId}:`, err.message);

      await WithdrawalRequest.findByIdAndUpdate(withdrawalRequestId, {
        status: 'failed',
        'razorpay.failureReason': err.message,
      });

      // Refund the debited amount back to wallet
      await walletService.credit(user._id, amount, 'withdrawal_reversal', {}, `Withdrawal failed — refunded: ${err.message}`);

      throw err;
    }
  }

  /**
   * Webhook handler: Razorpay calls this URL with payout status updates.
   * Endpoint: POST /api/v1/webhooks/razorpay
   *
   * Always verify the webhook signature before processing!
   */
  async handleWebhook(rawBody, signature) {
    // ── Verify signature ─────────────────────────────────────────────────────
    const expectedSig = crypto
      .createHmac('sha256', RZP_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      logger.warn('Razorpay webhook: invalid signature');
      const err = new Error('Invalid webhook signature');
      err.statusCode = 400;
      throw err;
    }

    const event = JSON.parse(rawBody);
    logger.info(`Razorpay webhook: ${event.event}`, { payoutId: event.payload?.payout?.entity?.id });

    const payoutEntity = event.payload?.payout?.entity;
    if (!payoutEntity) return;

    const request = await WithdrawalRequest.findOne({
      'razorpay.payoutId': payoutEntity.id,
    });

    if (!request) {
      logger.warn(`No withdrawal request for payout ${payoutEntity.id}`);
      return;
    }

    switch (event.event) {
      case 'payout.processed':
        // Money successfully sent
        await WithdrawalRequest.findByIdAndUpdate(request._id, {
          status: 'completed',
          completedAt: new Date(),
          'razorpay.payoutStatus': 'processed',
          'razorpay.utr': payoutEntity.utr,
        });
        logger.info(`Withdrawal completed: ${request._id}, UTR: ${payoutEntity.utr}`);
        break;

      case 'payout.reversed':
      case 'payout.failed':
        // Payment bounced back — refund user wallet
        if (request.status !== 'failed') {
          await WithdrawalRequest.findByIdAndUpdate(request._id, {
            status: 'failed',
            'razorpay.payoutStatus': payoutEntity.status,
            'razorpay.failureReason': payoutEntity.failure_reason,
          });

          await walletService.credit(
            request.user,
            request.amount,
            'withdrawal_reversal',
            { withdrawal: request._id },
            `Withdrawal failed (${payoutEntity.failure_reason || event.event}) — refunded`
          );
          logger.info(`Withdrawal refunded: ${request._id}`);
        }
        break;

      default:
        // payout.initiated, payout.queued — just update status
        await WithdrawalRequest.findByIdAndUpdate(request._id, {
          'razorpay.payoutStatus': payoutEntity.status,
        });
    }
  }

  /**
   * Verify a webhook signature (static helper for use in route)
   */
  verifyWebhookSignature(rawBody, signature) {
    const expected = crypto
      .createHmac('sha256', RZP_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  }
}

module.exports = new RazorpayService();