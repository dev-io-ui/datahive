const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

/**
 * ValidationAssignment — records that a specific validator was assigned a specific submission.
 *
 * Locking strategy:
 * - When a validator requests a submission, we atomically set lockedBy + lockExpiry
 * - Only one validator can hold the lock at a time (unique sparse index on submission+lockedBy)
 * - If validator doesn't complete within lockExpiry, lock is released and submission
 *   can be assigned to another validator
 * - Multiple validators CAN review the same submission (multi-validation), but only
 *   one at a time holds the lock
 */
const validationAssignmentSchema = new mongoose.Schema(
  {
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    validator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Lock fields (prevent two validators working simultaneously)
    lockedAt: { type: Date, default: Date.now },
    lockExpiry: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ['assigned', 'in_review', 'completed', 'expired', 'skipped'],
      default: 'assigned',
    },

    // Decision (filled on completion)
    decision: {
      type: String,
      enum: ['accept', 'reject'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      maxlength: [2000, 'Feedback cannot exceed 2000 characters'],
    },
    rejectionReason: {
      type: String,
      enum: [
        'poor_quality',
        'incorrect_format',
        'off_topic',
        'duplicate',
        'technical_issue',
        'other',
      ],
    },

    // Validator reward
    rewardAmount: Number,
    rewardPaid: { type: Boolean, default: false },

    // Timing
    assignedAt: { type: Date, default: Date.now },
    reviewStartedAt: Date,
    completedAt: Date,
    timeSpentSeconds: Number, // how long validator spent reviewing
  },
  { timestamps: true }
);

// A validator can only have one active assignment per submission
validationAssignmentSchema.index({ submission: 1, validator: 1 }, { unique: true });
validationAssignmentSchema.index({ validator: 1, status: 1 });
validationAssignmentSchema.index({ submission: 1, status: 1 });
validationAssignmentSchema.index({ lockExpiry: 1 });
validationAssignmentSchema.index({ task: 1, status: 1 });

// Release expired validation locks
validationAssignmentSchema.statics.releaseExpired = async function () {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: { $in: ['assigned', 'in_review'] },
      lockExpiry: { $lt: now },
    },
    { status: 'expired' }
  );
  return result.modifiedCount;
};
validationAssignmentSchema.plugin(mongoosePaginate);
const ValidationAssignment = mongoose.model('ValidationAssignment', validationAssignmentSchema);
module.exports = ValidationAssignment;
