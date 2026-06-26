const Bull = require('bull');
const logger = require('../utils/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
};

// Queue factory - creates a Bull queue with standard config
const createQueue = (name) => {
  const queue = new Bull(name, {
    redis: redisConfig,
    defaultJobOptions: {
      removeOnComplete: 50,  // keep last 50 completed jobs
      removeOnFail: 100,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });

  // queue.on('error', (err) => logger.error(`Queue [${name}] error:`, err));
  // queue.on('failed', (job, err) => logger.error(`Queue [${name}] job ${job.id} failed:`, err.message));
  // queue.on('completed', (job) => logger.info(`Queue [${name}] job ${job.id} completed`));

  return queue;
};

// Named queues
const fileProcessingQueue = createQueue('file-processing');
const notificationQueue = createQueue('notifications');
const auditQueue = createQueue('audit-checks');
const walletQueue = createQueue('wallet-transactions');
const aiTaskQueue = createQueue('ai-task-generation');

module.exports = {
  fileProcessingQueue,
  notificationQueue,
  auditQueue,
  walletQueue,
  aiTaskQueue,
};
