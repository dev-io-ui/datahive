const { body, param, query, validationResult } = require('express-validator');
const { sendBadRequest } = require('../utils/apiResponse');

/**
 * Runs after validation chains — returns 400 if any errors found
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendBadRequest(res, 'Validation failed', errors.array());
  }
  next();
};

// ── Auth validators ──────────────────────────────────────────────────────────
const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('role')
    .optional()
    .isIn(['contributor', 'validator'])
    .withMessage('Role must be contributor or validator'),
  validate,
];

const loginValidator = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
  validate,
];

// ── Task validators ──────────────────────────────────────────────────────────
const createTaskValidator = [
  body('title').trim().notEmpty().withMessage('Title required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description required'),
  body('type').isIn(['audio', 'text', 'image']).withMessage('Type must be audio, text, or image'),
  body('instructions').trim().notEmpty().withMessage('Instructions required'),
  body('pricePerTask')
    .isFloat({ min: 0.01 }).withMessage('Price must be at least 0.01'),
  body('totalSlots')
    .isInt({ min: 1 }).withMessage('Total slots must be at least 1'),
  body('validationsRequired')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Validations required must be 1-5'),
  body('validatorRewardPercent')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Validator reward percent must be 0-100'),
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard']).withMessage('Difficulty must be easy, medium, or hard'),
  body('project').optional().isMongoId().withMessage('Valid project ID required'),
  validate,
];

const createProjectTaskValidator = [
  body('title').trim().notEmpty().withMessage('Title required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description required'),
  body('type').isIn(['audio', 'text', 'image']).withMessage('Type must be audio, text, or image'),
  body('instructions').trim().notEmpty().withMessage('Instructions required'),
  body('pricePerTask').isFloat({ min: 0.01 }).withMessage('Price must be at least 0.01'),
  body('totalSlots').isInt({ min: 1 }).withMessage('Total slots must be at least 1'),
  validate,
];

const generateProjectTasksValidator = [
  body('taskType').isIn(['audio', 'text', 'image']).withMessage('Task type must be audio, text, or image'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('language').trim().notEmpty().withMessage('Language is required'),
  body('country').trim().notEmpty().withMessage('Country is required'),
  body('count').isInt({ min: 1, max: 100 }).withMessage('Count must be between 1 and 100'),
  body('pricePerTask').optional().isFloat({ min: 0.01 }).withMessage('Price must be at least 0.01'),
  body('totalSlots').optional().isInt({ min: 1 }).withMessage('Total slots must be at least 1'),
  validate,
];

const updateTaskValidator = [
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('status').optional().isIn(['draft', 'active', 'paused', 'completed', 'archived']),
  body('pricePerTask').optional().isFloat({ min: 0.01 }),
  body('totalSlots').optional().isInt({ min: 1 }),
  validate,
];

// ── Submission validators ────────────────────────────────────────────────────
const submitTaskValidator = [
  body('taskId').isMongoId().withMessage('Valid task ID required'),
  body('assignmentId').isMongoId().withMessage('Valid assignment ID required'),
  body('textContent').optional().isString().isLength({ max: 50000 }),
  validate,
];

// ── Validation validators ────────────────────────────────────────────────────
const validateSubmissionValidator = [
  body('assignmentId').isMongoId().withMessage('Valid assignment ID required'),
  body('decision').isIn(['accept', 'reject']).withMessage('Decision must be accept or reject'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('feedback').optional().isString().isLength({ max: 2000 }),
  body('rejectionReason')
    .if(body('decision').equals('reject'))
    .notEmpty().withMessage('Rejection reason required when rejecting')
    .isIn(['poor_quality', 'incorrect_format', 'off_topic', 'duplicate', 'technical_issue', 'other']),
  validate,
];

// ── Pagination validators ────────────────────────────────────────────────────
const paginationValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  validate,
];

// ── Param validators ─────────────────────────────────────────────────────────
const mongoIdParam = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
  validate,
];

module.exports = {
  validate,
  registerValidator,
  loginValidator,
  createTaskValidator,
  createProjectTaskValidator,
  generateProjectTasksValidator,
  updateTaskValidator,
  submitTaskValidator,
  validateSubmissionValidator,
  paginationValidator,
  mongoIdParam,
};
