const submissionService = require('../services/submissionService');
const Submission = require('../models/Submission');
const assignmentService = require('../services/assignmentService');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  sendSuccess, sendCreated, sendPaginated, sendNotFound
} = require('../utils/apiResponse');

// Contributor: Submit a task
const submitTask = asyncHandler(async (req, res) => {
  const { taskId, assignmentId, textContent } = req.body;
  const file = req.file; // multer-uploaded file

  const submission = await submissionService.createSubmission({
    taskId,
    assignmentId,
    contributorId: req.user.id,
    textContent,
    file,
  });

  return sendCreated(res, submission, 'Submission received! It will be reviewed shortly.');
});

// Contributor: View my submissions
const getMySubmissions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const result = await submissionService.getMySubmissions(req.user.id, {
    page: parseInt(page), limit: parseInt(limit), status,
  });
  return sendPaginated(res, result, 'Submissions retrieved');
});

// Validator: Request a submission to review
const assignSubmission = asyncHandler(async (req, res) => {
  const result = await assignmentService.assignSubmissionToValidator(req.user.id);
  return sendSuccess(res, result, 'Submission assigned for review');
});

// Validator: Submit review decision
const validateSubmission = asyncHandler(async (req, res) => {
  const { assignmentId, decision, rating, feedback, rejectionReason } = req.body;
  const result = await submissionService.processValidation({
    assignmentId,
    validatorId: req.user.id,
    decision,
    rating,
    feedback,
    rejectionReason,
  });
  return sendSuccess(res, result, `Submission ${decision}ed successfully`);
});

// Validator: Get my validation history
const getMyValidations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const ValidationAssignment = require('../models/ValidationAssignment');
  const result = await ValidationAssignment.paginate(
    { validator: req.user.id },
    {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'submission', select: 'content status avgRating' },
        { path: 'task', select: 'title type' },
      ],
      sort: { createdAt: -1 },
    }
  );
  return sendPaginated(res, result, 'Validation history retrieved');
});

// Admin: Get all submissions (with filters)
const getAllSubmissions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, taskId, contributorId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (taskId) filter.task = taskId;
  if (contributorId) filter.contributor = contributorId;

  const result = await Submission.paginate(filter, {
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 100),
    populate: [
      { path: 'task', select: 'title type pricePerTask' },
      { path: 'contributor', select: 'name email' },
    ],
    sort: { createdAt: -1 },
  });
  return sendPaginated(res, result, 'Submissions retrieved');
});

// Admin: Get single submission with full validation details
const getSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate('task')
    .populate('contributor', 'name email')
    .populate({
      path: 'validationAssignments',
      populate: { path: 'validator', select: 'name' },
    });
  if (!submission) return sendNotFound(res, 'Submission not found');
  return sendSuccess(res, submission);
});

module.exports = {
  submitTask,
  getMySubmissions,
  assignSubmission,
  validateSubmission,
  getMyValidations,
  getAllSubmissions,
  getSubmission,
};
