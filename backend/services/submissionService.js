const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const TaskAssignment = require('../models/TaskAssignment');
const ValidationAssignment = require('../models/ValidationAssignment');
const Task = require('../models/Task');
const walletService = require('./walletService');
const logger = require('../utils/logger');

class SubmissionService {
  /**
   * Create a new submission
   */
  async createSubmission({ taskId, assignmentId, contributorId, textContent, file }) {
    // Verify assignment is valid and belongs to this contributor
    const assignment = await TaskAssignment.findOne({
      _id: assignmentId,
      task: taskId,
      contributor: contributorId,
      status: { $in: ['assigned', 'in_progress'] },
      lockExpiry: { $gt: new Date() },
    });

    if (!assignment) {
      const err = new Error('Invalid or expired assignment');
      err.statusCode = 400;
      throw err;
    }

    const task = await Task.findById(taskId);
    if (!task || task.status !== 'active') {
      const err = new Error('Task is no longer active');
      err.statusCode = 400;
      throw err;
    }

    // Check for duplicate submission (idempotency)
    const existing = await Submission.findOne({ task: taskId, contributor: contributorId });
    if (existing) {
      const err = new Error('You have already submitted for this task');
      err.statusCode = 409;
      throw err;
    }

    // Build content object based on task type
    const content = {};
    if (task.type === 'text') {
      if (!textContent) {
        const err = new Error('Text content required for text tasks');
        err.statusCode = 400;
        throw err;
      }
      content.text = textContent;
    } else {
      if (!file) {
        const err = new Error(`File required for ${task.type} tasks`);
        err.statusCode = 400;
        throw err;
      }
      content.fileUrl = file.location || `/uploads/${file.filename}`; // S3 or local
      content.fileKey = file.key || file.filename;
      content.fileSize = file.size;
      content.mimeType = file.mimetype;
    }

    // Determine if this submission should be audited
    // (flag is stored on the submission; actual audit processing is handled
    // separately / manually for now since the queue has been removed)
    const isAuditSample = task.requiresAudit && Math.random() < task.auditSampleRate;

    const submission = await Submission.create({
      task: taskId,
      contributor: contributorId,
      assignment: assignmentId,
      content,
      isAuditSample,
    });

    // Mark assignment as submitted
    await TaskAssignment.findByIdAndUpdate(assignmentId, {
      status: 'submitted',
      submission: submission._id,
      submittedAt: new Date(),
    });

    // Update task completed count
    await Task.findByIdAndUpdate(taskId, { $inc: { completedCount: 1 } });

    // NOTE: Background file processing (virus scan, metadata extraction,
    // thumbnail) and audit-queue dispatch have been intentionally removed.
    // The submission is fully created and usable without them. If/when a
    // reliable queue is back in place, re-add dispatch here as a
    // best-effort, non-blocking call (never awaited in a way that can fail
    // or hang this request).

    logger.info(`Submission created: ${submission._id} for task ${taskId} by contributor ${contributorId}`);
    return submission;
  }

  /**
   * Process a validator's decision on a submission
   *
   * Multi-validation logic:
   * - Record this validator's decision
   * - If we now have enough validations (validationsRequired), compute final decision
   * - Final decision = majority vote (accept wins ties)
   * - Trigger wallet credits for contributor (if accepted) and validator
   */
  async processValidation({ assignmentId, validatorId, decision, rating, feedback, rejectionReason }) {
    // Find and verify the validation assignment
    const valAssignment = await ValidationAssignment.findOne({
      _id: assignmentId,
      validator: validatorId,
      status: { $in: ['assigned', 'in_review'] },
      lockExpiry: { $gt: new Date() },
    });

    if (!valAssignment) {
      const err = new Error('Validation assignment not found or expired');
      err.statusCode = 404;
      throw err;
    }

    const submission = await Submission.findById(valAssignment.submission).populate('task');
    if (!submission) {
      const err = new Error('Submission not found');
      err.statusCode = 404;
      throw err;
    }

    const task = submission.task;
    const timeSpentSeconds = valAssignment.reviewStartedAt
      ? Math.round((Date.now() - valAssignment.reviewStartedAt.getTime()) / 1000)
      : null;

    // ── Complete the validation assignment ──
    await ValidationAssignment.findByIdAndUpdate(assignmentId, {
      status: 'completed',
      decision,
      rating,
      feedback,
      rejectionReason,
      completedAt: new Date(),
      timeSpentSeconds,
    });

    // ── Update submission validation counters ──
    const isAccept = decision === 'accept';
    const updateResult = await Submission.findByIdAndUpdate(
      submission._id,
      {
        $inc: {
          validationCount: 1,
          acceptCount: isAccept ? 1 : 0,
          rejectCount: isAccept ? 0 : 1,
        },
        $push: { validationAssignments: assignmentId },
      },
      { new: true }
    );

    // ── Pay validator ──
    await walletService.creditValidator(validatorId, valAssignment.rewardAmount, {
      validationAssignment: assignmentId,
      submission: submission._id,
      task: task._id,
    });

    await ValidationAssignment.findByIdAndUpdate(assignmentId, { rewardPaid: true });

    // ── Check if we have enough validations for final decision ──
    const validationsRequired = task.validationsRequired || 1;
    let finalDecision = null;

    if (updateResult.validationCount >= validationsRequired) {
      // Majority vote: if acceptCount > rejectCount → accept, else reject
      finalDecision = updateResult.acceptCount > updateResult.rejectCount ? 'accepted' : 'rejected';

      await Submission.findByIdAndUpdate(submission._id, {
        status: finalDecision,
        finalDecision,
        finalDecisionAt: new Date(),
        avgRating: await this._computeAvgRating(submission._id),
      });

      // Update contributor stats
      const User = require('../models/User');
      await User.updateContributorStats(submission.contributor, finalDecision);

      // Credit contributor wallet if accepted
      if (finalDecision === 'accepted') {
        const validatorCut = task.pricePerTask * (task.validatorRewardPercent / 100) * validationsRequired;
        const contributorPay = task.pricePerTask - validatorCut;
        await walletService.creditContributor(submission.contributor, contributorPay, {
          submission: submission._id,
          task: task._id,
        });
      }

      logger.info(`Final decision for submission ${submission._id}: ${finalDecision} (${updateResult.acceptCount}A/${updateResult.rejectCount}R)`);
    }

    return { valAssignment, submission: updateResult, finalDecision };
  }

  /**
   * Compute average rating across all completed validations for a submission
   */
  async _computeAvgRating(submissionId) {
    const result = await ValidationAssignment.aggregate([
      { $match: { submission: new mongoose.Types.ObjectId(submissionId), status: 'completed', rating: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$rating' } } },
    ]);
    return result[0]?.avg ? Math.round(result[0].avg * 10) / 10 : 0;
  }

  /**
   * Get contributor's submission history (paginated)
   */
  async getMySubmissions(contributorId, { page = 1, limit = 5, status } = {}) {
    const filter = { contributor: contributorId };
    if (status) filter.status = status;

    return Submission.paginate(filter, {
      page,
      limit,
      populate: [{ path: 'task', select: 'title type pricePerTask' }],
      sort: { createdAt: -1 },
    });
  }
}

module.exports = new SubmissionService();


// const mongoose = require('mongoose');
// const Submission = require('../models/Submission');
// const TaskAssignment = require('../models/TaskAssignment');
// const ValidationAssignment = require('../models/ValidationAssignment');
// const Task = require('../models/Task');
// const walletService = require('./walletService');
// const { fileProcessingQueue, auditQueue } = require('../config/queues');
// const logger = require('../utils/logger');

// class SubmissionService {
//   /**
//    * Create a new submission
//    */
//   async createSubmission({ taskId, assignmentId, contributorId, textContent, file }) {
//     // Verify assignment is valid and belongs to this contributor
//     const assignment = await TaskAssignment.findOne({
//       _id: assignmentId,
//       task: taskId,
//       contributor: contributorId,
//       status: { $in: ['assigned', 'in_progress'] },
//       lockExpiry: { $gt: new Date() },
//     });

//     if (!assignment) {
//       const err = new Error('Invalid or expired assignment');
//       err.statusCode = 400;
//       throw err;
//     }

//     const task = await Task.findById(taskId);
//     if (!task || task.status !== 'active') {
//       const err = new Error('Task is no longer active');
//       err.statusCode = 400;
//       throw err;
//     }

//     // Check for duplicate submission (idempotency)
//     const existing = await Submission.findOne({ task: taskId, contributor: contributorId });
//     if (existing) {
//       const err = new Error('You have already submitted for this task');
//       err.statusCode = 409;
//       throw err;
//     }

//     // Build content object based on task type
//     const content = {};
//     if (task.type === 'text') {
//       if (!textContent) {
//         const err = new Error('Text content required for text tasks');
//         err.statusCode = 400;
//         throw err;
//       }
//       content.text = textContent;
//     } else {
//       if (!file) {
//         const err = new Error(`File required for ${task.type} tasks`);
//         err.statusCode = 400;
//         throw err;
//       }
//       content.fileUrl = file.location || `/uploads/${file.filename}`; // S3 or local
//       content.fileKey = file.key || file.filename;
//       content.fileSize = file.size;
//       content.mimeType = file.mimetype;
//     }

//     // Determine if this submission should be audited
//     const isAuditSample = task.requiresAudit && Math.random() < task.auditSampleRate;

//     const submission = await Submission.create({
//       task: taskId,
//       contributor: contributorId,
//       assignment: assignmentId,
//       content,
//       isAuditSample,
//     });

//     // Mark assignment as submitted
//     await TaskAssignment.findByIdAndUpdate(assignmentId, {
//       status: 'submitted',
//       submission: submission._id,
//       submittedAt: new Date(),
//     });

//     // Update task completed count
//     await Task.findByIdAndUpdate(taskId, { $inc: { completedCount: 1 } });

//     // Queue async file processing (virus scan, metadata extraction, thumbnail)
//     if (task.type !== 'text') {
//       await fileProcessingQueue.add('process-file', {
//         submissionId: submission._id.toString(),
//         fileKey: content.fileKey,
//         taskType: task.type,
//       });
//     }

//     // Queue audit if sampled
//     if (isAuditSample) {
//       await auditQueue.add('audit-submission', {
//         submissionId: submission._id.toString(),
//       }, { delay: 5000 });
//     }

//     logger.info(`Submission created: ${submission._id} for task ${taskId} by contributor ${contributorId}`);
//     return submission;
//   }

//   /**
//    * Process a validator's decision on a submission
//    *
//    * Multi-validation logic:
//    * - Record this validator's decision
//    * - If we now have enough validations (validationsRequired), compute final decision
//    * - Final decision = majority vote (accept wins ties)
//    * - Trigger wallet credits for contributor (if accepted) and validator
//    */
//   async processValidation({ assignmentId, validatorId, decision, rating, feedback, rejectionReason }) {
//     // Find and verify the validation assignment
//     const valAssignment = await ValidationAssignment.findOne({
//       _id: assignmentId,
//       validator: validatorId,
//       status: { $in: ['assigned', 'in_review'] },
//       lockExpiry: { $gt: new Date() },
//     });

//     if (!valAssignment) {
//       const err = new Error('Validation assignment not found or expired');
//       err.statusCode = 404;
//       throw err;
//     }

//     const submission = await Submission.findById(valAssignment.submission).populate('task');
//     if (!submission) {
//       const err = new Error('Submission not found');
//       err.statusCode = 404;
//       throw err;
//     }

//     const task = submission.task;
//     const timeSpentSeconds = valAssignment.reviewStartedAt
//       ? Math.round((Date.now() - valAssignment.reviewStartedAt.getTime()) / 1000)
//       : null;

//     // ── Complete the validation assignment ──
//     await ValidationAssignment.findByIdAndUpdate(assignmentId, {
//       status: 'completed',
//       decision,
//       rating,
//       feedback,
//       rejectionReason,
//       completedAt: new Date(),
//       timeSpentSeconds,
//     });

//     // ── Update submission validation counters ──
//     const isAccept = decision === 'accept';
//     const updateResult = await Submission.findByIdAndUpdate(
//       submission._id,
//       {
//         $inc: {
//           validationCount: 1,
//           acceptCount: isAccept ? 1 : 0,
//           rejectCount: isAccept ? 0 : 1,
//         },
//         $push: { validationAssignments: assignmentId },
//       },
//       { new: true }
//     );

//     // ── Pay validator ──
//     await walletService.creditValidator(validatorId, valAssignment.rewardAmount, {
//       validationAssignment: assignmentId,
//       submission: submission._id,
//       task: task._id,
//     });

//     await ValidationAssignment.findByIdAndUpdate(assignmentId, { rewardPaid: true });

//     // ── Check if we have enough validations for final decision ──
//     const validationsRequired = task.validationsRequired || 1;
//     let finalDecision = null;

//     if (updateResult.validationCount >= validationsRequired) {
//       // Majority vote: if acceptCount > rejectCount → accept, else reject
//       finalDecision = updateResult.acceptCount > updateResult.rejectCount ? 'accepted' : 'rejected';

//       await Submission.findByIdAndUpdate(submission._id, {
//         status: finalDecision,
//         finalDecision,
//         finalDecisionAt: new Date(),
//         avgRating: await this._computeAvgRating(submission._id),
//       });

//       // Update contributor stats
//       const User = require('../models/User');
//       await User.updateContributorStats(submission.contributor, finalDecision);

//       // Credit contributor wallet if accepted
//       if (finalDecision === 'accepted') {
//         const validatorCut = task.pricePerTask * (task.validatorRewardPercent / 100) * validationsRequired;
//         const contributorPay = task.pricePerTask - validatorCut;
//         await walletService.creditContributor(submission.contributor, contributorPay, {
//           submission: submission._id,
//           task: task._id,
//         });
//       }

//       logger.info(`Final decision for submission ${submission._id}: ${finalDecision} (${updateResult.acceptCount}A/${updateResult.rejectCount}R)`);
//     }

//     return { valAssignment, submission: updateResult, finalDecision };
//   }

//   /**
//    * Compute average rating across all completed validations for a submission
//    */
//   async _computeAvgRating(submissionId) {
//     const result = await ValidationAssignment.aggregate([
//       { $match: { submission: new mongoose.Types.ObjectId(submissionId), status: 'completed', rating: { $exists: true } } },
//       { $group: { _id: null, avg: { $avg: '$rating' } } },
//     ]);
//     return result[0]?.avg ? Math.round(result[0].avg * 10) / 10 : 0;
//   }

//   /**
//    * Get contributor's submission history (paginated)
//    */
//   async getMySubmissions(contributorId, { page = 1, limit = 5, status } = {}) {
//     const filter = { contributor: contributorId };
//     if (status) filter.status = status;

//     return Submission.paginate(filter, {
//       page,
//       limit,
//       populate: [{ path: 'task', select: 'title type pricePerTask' }],
//       sort: { createdAt: -1 },
//     });
//   }
// }

// module.exports = new SubmissionService();
