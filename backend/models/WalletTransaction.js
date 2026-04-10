const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    type: {
      type: String,
      enum: [
        'submission_reward',    // Contributor earns on accepted submission
        'validation_reward',    // Validator earns per validation
        'bonus',                // Admin-granted bonus
        'penalty',              // Penalty for low quality
        'withdrawal',           // User cashes out
        'withdrawal_reversal',  // Failed withdrawal reversed
        'adjustment',           // Admin correction
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      // Positive = credit, negative = debit
    },

    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
    },

    // What triggered this transaction
    reference: {
      submission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
      validationAssignment: { type: mongoose.Schema.Types.ObjectId, ref: 'ValidationAssignment' },
      task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    },

    description: String,
    
    // Balance snapshot after this transaction (for reconciliation)
    balanceAfter: Number,

    // For withdrawals
    withdrawal: {
      method: String,   // 'bank_transfer', 'paypal', etc.
      accountInfo: String,  // masked account info
      processorRef: String, // External payment processor reference
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, status: 1 });
walletTransactionSchema.index({ 'reference.submission': 1 });

walletTransactionSchema.plugin(mongoosePaginate);

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
module.exports = WalletTransaction;
