const mongoose = require('mongoose');

/**
 * TaskAssignment — records that a specific contributor was assigned a specific task.
 *
 * Race condition prevention strategy:
 * 1. Atomic findOneAndUpdate with $inc on Task.assignedCount with condition check
 * 2. Unique compound index on (task, contributor) prevents double-assignment
 * 3. Lock expiry allows re-assignment if contributor abandons the task
 */
const taskAssignmentSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    contributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'submitted', 'expired', 'abandoned'],
      default: 'assigned',
    },

    // Lock mechanism: when assigned, set expiry. If contributor doesn't submit
    // before lockExpiry, the assignment is released back to the pool.
    lockedAt: { type: Date, default: Date.now },
    lockExpiry: {
      type: Date,
      required: true,
      // Set at assignment time: now + LOCK_EXPIRY_MINUTES
    },

    // Linked submission (populated on submit)
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
    },

    // Attempt tracking (for retry scenarios)
    attemptNumber: { type: Number, default: 1 },
    
    // Time tracking
    startedAt: Date,
    submittedAt: Date,
    expiredAt: Date,
  },
  { timestamps: true }
);

// CRITICAL: Prevents a contributor from being assigned the same task twice
taskAssignmentSchema.index({ task: 1, contributor: 1 }, { unique: true });
taskAssignmentSchema.index({ status: 1 });
taskAssignmentSchema.index({ lockExpiry: 1 }); // for expiry cleanup job
taskAssignmentSchema.index({ contributor: 1, status: 1 });

// Auto-expire: find assignments past lockExpiry
taskAssignmentSchema.statics.releaseExpired = async function () {
  const now = new Date();
  const expired = await this.find({
    status: { $in: ['assigned', 'in_progress'] },
    lockExpiry: { $lt: now },
  });

  if (expired.length === 0) return 0;

  const Task = mongoose.model('Task');
  
  // Bulk update expired assignments
  await this.updateMany(
    { _id: { $in: expired.map(e => e._id) } },
    { status: 'expired', expiredAt: now }
  );

  // Return slots back to tasks
  const taskIds = [...new Set(expired.map(e => e.task.toString()))];
  await Task.updateMany(
    { _id: { $in: taskIds } },
    { $inc: { assignedCount: -1 } }
  );

  return expired.length;
};

const TaskAssignment = mongoose.model('TaskAssignment', taskAssignmentSchema);
module.exports = TaskAssignment;
