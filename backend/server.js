require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');

const connectDB = require('./config/database');
const routes = require('./routes/index');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api', generalLimiter);

// ── Static files (local dev uploads) ─────────────────────────────────────────
app.use('/uploads', express.static('uploads'));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── 404 & Error handlers ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Startup ───────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();

  // Initialize queue workers (only if Redis is available)
  if (process.env.REDIS_HOST) {
    try {
      require('./queues/workers');
      logger.info('Queue workers started');
    } catch (err) {
      logger.warn('Redis not available, running without queues:', err.message);
    }
  }

  app.listen(PORT, () => {
    logger.info(`DataHive API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

start();

module.exports = app; // for testing
