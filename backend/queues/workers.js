const { fileProcessingQueue, auditQueue, walletQueue, aiTaskQueue } = require('../config/queues');
const Submission = require('../models/Submission');
const logger = require('../utils/logger');
const projectService = require('../services/projectService');

// ── File Processing Worker ───────────────────────────────────────────────────
fileProcessingQueue.process('process-file', async (job) => {
  const { submissionId, fileKey, taskType } = job.data;
  logger.info(`Processing file for submission ${submissionId}`);

  try {
    // In production: run virus scan, extract metadata, generate thumbnails
    // For now: mark as processed
    await Submission.findByIdAndUpdate(submissionId, {
      processingStatus: 'processed',
    });

    // For audio: extract duration using ffprobe
    if (taskType === 'audio') {
      // const duration = await extractAudioDuration(fileKey);
      // await Submission.findByIdAndUpdate(submissionId, { 'content.duration': duration });
    }

    logger.info(`File processing complete for submission ${submissionId}`);
    return { submissionId, status: 'processed' };
  } catch (err) {
    await Submission.findByIdAndUpdate(submissionId, { processingStatus: 'failed' });
    throw err; // Bull will handle retry
  }
});

// ── Audit Worker ─────────────────────────────────────────────────────────────
auditQueue.process('audit-submission', async (job) => {
  const { submissionId } = job.data;
  logger.info(`Running audit on submission ${submissionId}`);

  // In production: run AI quality checks, flag suspicious patterns, etc.
  // For now: simple random pass/fail simulation for demo
  const auditResult = Math.random() > 0.1 ? 'pass' : 'fail'; // 90% pass rate

  await Submission.findByIdAndUpdate(submissionId, { auditResult });

  logger.info(`Audit complete for submission ${submissionId}: ${auditResult}`);
  return { submissionId, auditResult };
});

// ── AI task generation worker ────────────────────────────────────────────────
aiTaskQueue.process('generate-project-tasks', async (job) => {
  const { projectId, adminId, payload } = job.data;
  logger.info(`Generating AI tasks for project ${projectId}`);
  const result = await projectService.generateAndStoreTasks(projectId, adminId, payload);
  return { projectId, created: result.tasks.length, providerUsed: result.providerUsed };
});

// ── Periodic expired lock release ─────────────────────────────────────────────
// This would be triggered by a cron job or repeating Bull job
const { releaseExpiredLocks } = require('./services/assignmentService');

// Run lock cleanup every 5 minutes via Bull repeatable job
const setupRepeatableJobs = async () => {
  // Clean up expired task/validation locks
  await fileProcessingQueue.add(
    'release-expired-locks',
    {},
    { repeat: { cron: '*/5 * * * *' }, jobId: 'lock-cleanup' }
  );
};

// Register the handler
fileProcessingQueue.process('release-expired-locks', async () => {
  const assignmentService = require('./services/assignmentService');
  return assignmentService.releaseExpiredLocks();
});

logger.info('Queue workers initialized');

module.exports = { setupRepeatableJobs };
