const Task = require('../models/Task');
const Project = require('../models/Project');
const assignmentService = require('../services/assignmentService');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendCreated, sendPaginated, sendNotFound } = require('../utils/apiResponse');

// Admin: Create a task
const createTask = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.body.project);
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }
  const task = await Task.create({ ...req.body, createdBy: req.user.id });
  return sendCreated(res, task, 'Task created successfully');
});

// Admin: Update a task
const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!task) return sendNotFound(res, 'Task not found');
  return sendSuccess(res, task, 'Task updated');
});

// Admin: Delete/archive a task
const archiveTask = asyncHandler(async (req, res) => {
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { status: 'archived' },
    { new: true }
  );
  if (!task) return sendNotFound(res, 'Task not found');
  return sendSuccess(res, task, 'Task archived');
});

// Public/contributor: List active tasks (paginated)
const getTasks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type, status, search, projectId } = req.query;

  const filter = {};
  // Non-admins only see active tasks
  if (req.user?.role !== 'admin') {
    filter.status = 'active';
  } else if (status) {
    filter.status = status;
  }
  if (type) filter.type = type;
  if (projectId) filter.project = projectId;
  if (search) filter.$text = { $search: search };

  const result = await Task.paginate(filter, {
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 100),
    populate: { path: 'createdBy', select: 'name' },
    sort: { createdAt: -1 },
  });

  return sendPaginated(res, result, 'Tasks retrieved');
});

// Get single task
const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id).populate('createdBy', 'name');
  if (!task) return sendNotFound(res, 'Task not found');
  return sendSuccess(res, task);
});

// Contributor: Request a task assignment
const assignTask = asyncHandler(async (req, res) => {
  const result = await assignmentService.assignTaskToContributor(req.user.id);

  if (result.alreadyAssigned) {
    return sendSuccess(res, result, 'You already have an active task assignment');
  }
  return sendSuccess(res, result, 'Task assigned successfully');
});

module.exports = { createTask, updateTask, archiveTask, getTasks, getTask, assignTask };
