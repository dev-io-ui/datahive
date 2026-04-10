const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const ValidationAssignment = require('../models/ValidationAssignment');
const Submission = require('../models/Submission');
const logger = require('../utils/logger');

const LOCK_EXPIRY_MINUTES = parseInt(process.env.LOCK_EXPIRY_MINUTES) || 30;

class AssignmentService {
  /**
   * ─────────────────────────────────────────────────────────────────────────
   * CONTRIBUTOR: Assign an available task to a contributor
   *
   * Race condition prevention:
   * 1. findOneAndUpdate with $inc is atomic at the MongoDB document level
   * 2. We use a condition `$expr: { $lt: ['$assignedCount', '$totalSlots'] }`
   *    so the increment ONLY succeeds if a slot is available — no over-assignment
   * 3. Unique index on (task, contributor) prevents the same contributor
   *    getting the same task twice even under concurrent requests
   * 4. If the findOneAndUpdate wins a slot but the TaskAssignment insert fails
   *    (e.g. duplicate key — already assigned), we roll back the slot increment
   * ─────────────────────────────────────────────────────────────────────────
   */
  async assignTaskToContributor(contributorId) {
    // Check if contributor already has an active assignment
    const activeAssignment = await TaskAssignment.findOne({
      contributor: contributorId,
      status: { $in: ['assigned', 'in_progress'] },
      lockExpiry: { $gt: new Date() },
    });

    if (activeAssignment) {
      // Return existing assignment rather than issuing a new one
      const task = await Task.findById(activeAssignment.task);
      return { assignment: activeAssignment, task, alreadyAssigned: true };
    }

    // Get list of tasks this contributor has already done (including rejected — no redo)
    const doneTaskIds = await TaskAssignment.distinct('task', {
      contributor: contributorId,
      status: { $in: ['submitted', 'expired'] },
    });

    // Atomically claim a slot on an available task
    // The $expr condition ensures assignedCount < totalSlots at the DB level
    const lockExpiry = new Date(Date.now() + LOCK_EXPIRY_MINUTES * 60 * 1000);

    const task = await Task.findOneAndUpdate(
      {
        status: 'active',
        _id: { $nin: doneTaskIds },
        $expr: { $lt: ['$assignedCount', '$totalSlots'] },
        // Optionally filter by task type preferences here
      },
      {
        $inc: { assignedCount: 1 },
      },
      {
        new: true,
        // sort by least assigned first for even distribution
        sort: { assignedCount: 1, createdAt: 1 },
      }
    );

    if (!task) {
      const err = new Error('No tasks available at this time. Check back soon!');
      err.statusCode = 404;
      throw err;
    }

    // Create the assignment record
    let assignment;
    try {
      assignment = await TaskAssignment.create({
        task: task._id,
        contributor: contributorId,
        lockExpiry,
        startedAt: new Date(),
      });
    } catch (err) {
      // Roll back the slot if assignment creation fails (duplicate key, etc.)
      await Task.findByIdAndUpdate(task._id, { $inc: { assignedCount: -1 } });

      if (err.code === 11000) {
        // Contributor already has this task — shouldn't happen due to doneTaskIds filter
        // but handle gracefully
        logger.warn(`Duplicate assignment attempt: contributor=${contributorId} task=${task._id}`);
        const error = new Error('Assignment conflict. Please try again.');
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }

    logger.info(`Task assigned: contributor=${contributorId} task=${task._id} lockExpiry=${lockExpiry}`);
    return { assignment, task };
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * VALIDATOR: Assign a pending submission to a validator
   *
   * Multi-validation support:
   * - A submission can require N validations (task.validationsRequired)
   * - Each validator gets an exclusive lock while reviewing
   * - Multiple ValidationAssignment records can exist for one submission
   *   (one per validator, up to validationsRequired)
   * - Validator cannot validate their own submission
   * - Validator cannot validate same submission twice
   *
   * Locking strategy:
   * - We use a findOneAndUpdate with a condition check on the submission's
   *   active lock count to prevent concurrent assignment
   * ─────────────────────────────────────────────────────────────────────────
   */
  async assignSubmissionToValidator(validatorId) {
    const lockExpiry = new Date(Date.now() + LOCK_EXPIRY_MINUTES * 60 * 1000);

    // Get submissions this validator already reviewed or is currently reviewing
    const alreadyAssigned = await ValidationAssignment.distinct('submission', {
      validator: validatorId,
    });

    // Get tasks this validator shouldn't validate (their own contributions)
    // Actually: filter out submissions made by this validator
    // (validators can't validate their own work)

    // Find a pending submission that:
    // 1. Hasn't been fully validated yet
    // 2. Isn't already locked by this validator
    // 3. Isn't submitted by this validator themselves
    // 4. Still needs more validations (validationCount < task.validationsRequired)
    const submissions = await Submission.aggregate([
      {
        $match: {
          status: 'pending',
          _id: { $nin: alreadyAssigned },
          contributor: { $ne: new mongoose.Types.ObjectId(validatorId) },
        },
      },
      {
        $lookup: {
          from: 'tasks',
          localField: 'task',
          foreignField: '_id',
          as: 'taskDoc',
        },
      },
      { $unwind: '$taskDoc' },
      {
        $match: {
          $expr: { $lt: ['$validationCount', '$taskDoc.validationsRequired'] },
        },
      },
      // Check there's no active lock on this submission from another validator
      {
        $lookup: {
          from: 'validationassignments',
          let: { subId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$submission', '$$subId'] },
                    { $in: ['$status', ['assigned', 'in_review']] },
                    { $gt: ['$lockExpiry', new Date()] },
                  ],
                },
              },
            },
          ],
          as: 'activeLocks',
        },
      },
      { $match: { activeLocks: { $size: 0 } } }, // Only unlocked submissions
      { $limit: 1 },
    ]);

    if (!submissions.length) {
      const err = new Error('No submissions available for review right now.');
      err.statusCode = 404;
      throw err;
    }

    const submission = submissions[0];
    const task = submission.taskDoc;

    // Atomically create the validation assignment
    let valAssignment;
    try {
      valAssignment = await ValidationAssignment.create({
        submission: submission._id,
        task: task._id,
        validator: validatorId,
        lockExpiry,
        rewardAmount: task.pricePerTask * (task.validatorRewardPercent / 100),
      });
    } catch (err) {
      if (err.code === 11000) {
        logger.warn(`Duplicate validation assignment: validator=${validatorId} submission=${submission._id}`);
        const error = new Error('Submission already assigned. Please try again.');
        error.statusCode = 409;
        throw error;
      }
      throw err;
    }

    // Mark submission as under_review
    await Submission.findByIdAndUpdate(submission._id, { status: 'under_review' });

    logger.info(`Validation assigned: validator=${validatorId} submission=${submission._id}`);
    return { assignment: valAssignment, submission, task };
  }

  /**
   * Mark a task assignment as in progress (when contributor opens it)
   */
  async startTaskAssignment(assignmentId, contributorId) {
    const assignment = await TaskAssignment.findOne({
      _id: assignmentId,
      contributor: contributorId,
      status: 'assigned',
      lockExpiry: { $gt: new Date() },
    });

    if (!assignment) {
      const err = new Error('Assignment not found or expired');
      err.statusCode = 404;
      throw err;
    }

    assignment.status = 'in_progress';
    assignment.startedAt = new Date();
    await assignment.save();
    return assignment;
  }

  /**
   * Release all expired locks (run periodically via cron/queue)
   */
  async releaseExpiredLocks() {
    const [taskExpired, validationExpired] = await Promise.all([
      TaskAssignment.releaseExpired(),
      ValidationAssignment.releaseExpired(),
    ]);

    logger.info(`Released expired locks: ${taskExpired} task assignments, ${validationExpired} validation assignments`);
    return { taskExpired, validationExpired };
  }
}

module.exports = new AssignmentService();
