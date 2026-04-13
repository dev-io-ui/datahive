// ── projectController.js ──────────────────────────────────────────────────────
const projectService = require('../services/projectService');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendCreated, sendPaginated, sendNotFound } = require('../utils/apiResponse');

const createProject = asyncHandler(async (req, res) => {
  const project = await projectService.createProject(req.body, req.user.id);
  return sendCreated(res, project, 'Project created');
});

const getProjects = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, language, country, search } = req.query;
  const result = await projectService.getProjects({
    page: parseInt(page), limit: parseInt(limit), status, language, country, search
  });
  return sendPaginated(res, result, 'Projects retrieved');
});

const getProject = asyncHandler(async (req, res) => {
  const data = await projectService.getProjectDetail(req.params.id);
  return sendSuccess(res, data);
});

const updateProject = asyncHandler(async (req, res) => {
  const project = await projectService.updateProject(req.params.id, req.body);
  return sendSuccess(res, project, 'Project updated');
});

const setProjectStatus = asyncHandler(async (req, res) => {
  await projectService.setProjectStatus(req.params.id, req.body.status);
  return sendSuccess(res, {}, 'Project status updated');
});

const assignTask = asyncHandler(async (req, res) => {
  const task = await projectService.assignTaskToProject(req.body.taskId, req.params.id);
  return sendSuccess(res, task, 'Task assigned to project');
});

const getLanguageOptions = asyncHandler(async (req, res) => {
  const options = projectService.getLanguageOptions();
  return sendSuccess(res, options);
});

module.exports = { createProject, getProjects, getProject, updateProject, setProjectStatus, assignTask, getLanguageOptions };