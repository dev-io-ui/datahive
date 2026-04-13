const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

/**
 * WithdrawalRequest — tracks user withdrawal requests through the payout lifecycle.
 *
 * Flow:
 *   User requests withdrawal → status: pending
 *   Admin reviews (or auto-approves) → status: approved
 *   Razorpay payout initiated → status: processing, razorpayPayoutId set
 *   Razorpay webhook confirms → status: completed
 *   Razorpay webhook failure → status: failed → user balance refunded
 */
const withdrawalRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [10, 'Minimum withdrawal is ₹10'],
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'processing', 'completed', 'failed', 'rejected', 'cancelled'],
      default: 'pending',
    },

    // Bank / UPI details (encrypted in production — store only last4 or masked)
    payoutMethod: {
      type: String,
      enum: ['upi', 'bank_transfer', 'paypal'],
      required: true,
    },

    // UPI
    upiId: { type: String, trim: true },

    // Bank transfer
    bankAccount: {
      accountNumber: { type: String, trim: true }, // store masked in prod
      ifsc: { type: String, trim: true, uppercase: true },
      accountHolderName: { type: String, trim: true },
      bankName: { type: String, trim: true },
    },

    // Razorpay integration
    razorpay: {
      contactId: String,     // rzp contact ID created for this user
      fundAccountId: String, // rzp fund account (UPI/bank) ID
      payoutId: String,      // rzp payout ID once initiated
      payoutStatus: String,  // mirrors razorpay's payout.status field
      referenceId: String,   // our internal reference sent to razorpay
      failureReason: String,
      utr: String,           // Unique Transaction Reference (bank UTR)
    },

    // Admin action
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: String,  // reason for rejection etc.

    // Linked wallet transaction (debit)
    walletTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },

    // Timestamps
    requestedAt: { type: Date, default: Date.now },
    processedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

withdrawalRequestSchema.index({ user: 1, status: 1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });
withdrawalRequestSchema.index({ 'razorpay.payoutId': 1 }, { sparse: true });

withdrawalRequestSchema.plugin(mongoosePaginate);

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
module.exports = WithdrawalRequest;