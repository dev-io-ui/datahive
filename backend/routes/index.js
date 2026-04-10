const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter, assignmentLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const {
  registerValidator, loginValidator,
  createTaskValidator, updateTaskValidator,
  submitTaskValidator, validateSubmissionValidator,
  paginationValidator, mongoIdParam,
} = require('../middleware/validators');
const { upload } = require('../config/storage');

const authCtrl = require('../controllers/authController');
const taskCtrl = require('../controllers/taskController');
const submissionCtrl = require('../controllers/submissionController');
const adminCtrl = require('../controllers/adminController');

// ── Health check ─────────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Auth routes ───────────────────────────────────────────────────────────────
router.post('/auth/register', authLimiter, registerValidator, authCtrl.register);
router.post('/auth/login', authLimiter, loginValidator, authCtrl.login);
router.post('/auth/refresh', authCtrl.refreshToken);
router.post('/auth/logout', authenticate, authCtrl.logout);
router.post('/auth/logout-all', authenticate, authCtrl.logoutAll);
router.get('/auth/me', authenticate, authCtrl.getMe);

// ── Task routes ───────────────────────────────────────────────────────────────
router.get('/tasks', authenticate, paginationValidator, taskCtrl.getTasks);
router.get('/tasks/:id', authenticate, mongoIdParam('id'), taskCtrl.getTask);
router.get('/tasks/assign/next', authenticate, authorize('contributor'), assignmentLimiter, taskCtrl.assignTask);

// Admin task management
router.post('/tasks', authenticate, authorize('admin'), createTaskValidator, taskCtrl.createTask);
router.put('/tasks/:id', authenticate, authorize('admin'), mongoIdParam('id'), updateTaskValidator, taskCtrl.updateTask);
router.delete('/tasks/:id', authenticate, authorize('admin'), mongoIdParam('id'), taskCtrl.archiveTask);

// ── Submission routes ─────────────────────────────────────────────────────────
// Contributor: submit
router.post(
  '/submissions',
  authenticate,
  authorize('contributor'),
  uploadLimiter,
  upload.single('file'), // handles audio/image uploads
  submitTaskValidator,
  submissionCtrl.submitTask
);

// Contributor: my submissions
router.get('/submissions/my', authenticate, authorize('contributor'), paginationValidator, submissionCtrl.getMySubmissions);

// Validator: get a submission to review
router.get('/submissions/assign', authenticate, authorize('validator'), assignmentLimiter, submissionCtrl.assignSubmission);

// Validator: submit review
router.post('/submissions/validate', authenticate, authorize('validator'), validateSubmissionValidator, submissionCtrl.validateSubmission);

// Validator: my validation history
router.get('/submissions/validations/my', authenticate, authorize('validator'), paginationValidator, submissionCtrl.getMyValidations);

// Admin: all submissions
router.get('/submissions', authenticate, authorize('admin'), paginationValidator, submissionCtrl.getAllSubmissions);
router.get('/submissions/:id', authenticate, authorize('admin'), mongoIdParam('id'), submissionCtrl.getSubmission);

// ── Wallet routes ─────────────────────────────────────────────────────────────
router.get('/wallet', authenticate, adminCtrl.getMyWallet);
router.get('/wallet/transactions', authenticate, paginationValidator, adminCtrl.getMyTransactions);
router.post('/wallet/withdraw', authenticate, adminCtrl.requestWithdrawal);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get('/admin/dashboard', authenticate, authorize('admin'), adminCtrl.getDashboard);
router.get('/admin/leaderboard', authenticate, authorize('admin'), adminCtrl.getLeaderboard);

router.get('/admin/users', authenticate, authorize('admin'), paginationValidator, adminCtrl.getAllUsers);
router.get('/admin/users/:id', authenticate, authorize('admin'), mongoIdParam('id'), adminCtrl.getUser);
router.patch('/admin/users/:id/status', authenticate, authorize('admin'), mongoIdParam('id'), adminCtrl.updateUserStatus);
router.patch('/admin/users/:id/role', authenticate, authorize('admin'), mongoIdParam('id'), adminCtrl.updateUserRole);
router.post('/admin/users/:id/wallet', authenticate, authorize('admin'), mongoIdParam('id'), adminCtrl.adminAdjustWallet);

router.get('/admin/tasks/:taskId/export', authenticate, authorize('admin'), adminCtrl.exportDataset);

module.exports = router;
