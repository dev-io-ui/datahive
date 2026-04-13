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

console.log("authCtrl");
const authCtrl = require('../controllers/authController');
console.log("taskCtrl");
const taskCtrl = require('../controllers/taskController');
console.log("submi");
const submissionCtrl = require('../controllers/submissionController');
console.log("admin");
const adminCtrl = require('../controllers/adminController');
console.log("project");
const projectCtrl  = require('../controllers/projectController');
console.log("wirth");
const withdrawalCtrl  = require('../controllers/withdrawalController');
console.log("after all import")


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


// ── Project routes ─────────────────────────────────────────────
router.get('/projects/languages', authenticate, projectCtrl.getLanguageOptions);

router.get('/projects',
  authenticate,
  authorize('admin'),
  paginationValidator,
  projectCtrl.getProjects
);

router.post('/projects',
  authenticate,
  authorize('admin'),
  projectCtrl.createProject
);

router.get('/projects/:id',
  authenticate,
  authorize('admin'),
  mongoIdParam('id'),
  projectCtrl.getProject
);

router.put('/projects/:id',
  authenticate,
  authorize('admin'),
  mongoIdParam('id'),
  projectCtrl.updateProject
);

router.patch('/projects/:id/status',
  authenticate,
  authorize('admin'),
  mongoIdParam('id'),
  projectCtrl.setProjectStatus
);

router.post('/projects/:id/tasks',
  authenticate,
  authorize('admin'),
  mongoIdParam('id'),
  projectCtrl.assignTask
);


// ── Withdrawal routes ──────────────────────────────────────────

// User
// router.post('/withdrawals',
//   authenticate,
//   authorize('contributor', 'validator'),
//   withdrawalCtrl.rejectWithdrawal
// );

router.post('/withdrawals',
  authenticate,
  authorize('contributor', 'validator'),
  withdrawalCtrl.requestWithdrawal
);

router.get('/withdrawals/my',
  authenticate,
  paginationValidator,
  withdrawalCtrl.getMyWithdrawals
);

router.delete('/withdrawals/:id',
  authenticate,
  mongoIdParam('id'),
  withdrawalCtrl.cancelWithdrawal
);


// Admin
router.get('/admin/withdrawals',
  authenticate,
  authorize('admin'),
  paginationValidator,
  withdrawalCtrl.getAllWithdrawals
);

router.post('/admin/withdrawals/:id/approve',
  authenticate,
  authorize('admin'),
  mongoIdParam('id'),
  withdrawalCtrl.approveWithdrawal
);

router.post('/admin/withdrawals/:id/reject',
  authenticate,
  authorize('admin'),
  mongoIdParam('id'),
  withdrawalCtrl.rejectWithdrawal
);


// ── Razorpay webhook ───────────────────────────────────────────
router.post(
  '/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  withdrawalCtrl.razorpayWebhook
);


module.exports = router;
