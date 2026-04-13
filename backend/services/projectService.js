const Project = require('../models/Project');
const Task = require('../models/Task');
const Submission = require('../models/Submission');
const mongoose = require('mongoose');

class ProjectService {
  /**
   * Create a new project
   */
  async createProject(data, adminId) {
    const project = await Project.create({ ...data, createdBy: adminId });
    return project;
  }

  /**
   * Get all projects with live task/submission stats
   */
  async getProjects({ page = 1, limit = 20, status, language, country, search } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (language) filter['dataset.language'] = language;
    if (country) filter['dataset.country'] = country;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'client.name': { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const result = await Project.paginate(filter, {
      page,
      limit,
      populate: { path: 'createdBy', select: 'name' },
      sort: { createdAt: -1 },
    });

    // Attach live task counts per project
    const projectIds = result.docs.map(p => p._id);
    const taskStats = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      {
        $group: {
          _id: '$project',
          totalTasks: { $sum: 1 },
          activeTasks: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalSlots: { $sum: '$totalSlots' },
          completedSlots: { $sum: '$completedCount' },
          budgetAllocated: { $sum: { $multiply: ['$pricePerTask', '$totalSlots'] } },
        },
      },
    ]);

    const statsMap = {};
    taskStats.forEach(s => { statsMap[s._id.toString()] = s; });

    result.docs = result.docs.map(p => {
      const obj = p.toJSON();
      obj._id = p._id.toString();
      obj.liveStats = statsMap[p._id.toString()] || {
        totalTasks: 0, activeTasks: 0, totalSlots: 0, completedSlots: 0, budgetAllocated: 0
      };
      return obj;
    });

    return result;
  }

  /**
   * Get a single project with all its tasks
   */
  async getProjectDetail(projectId) {
    const project = await Project.findById(projectId).populate('createdBy', 'name');
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = 404;
      throw err;
    }

    // Fetch all tasks in this project
    const tasks = await Task.find({ project: projectId })
      .sort({ createdAt: 1 })
      .lean();

    // Fetch submission counts per task
    const submissionStats = await Submission.aggregate([
      { $match: { task: { $in: tasks.map(t => t._id) } } },
      {
        $group: {
          _id: '$task',
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        },
      },
    ]);

    const subMap = {};
    submissionStats.forEach(s => { subMap[s._id.toString()] = s; });

    const tasksWithStats = tasks.map(t => ({
      ...t,
      submissionStats: subMap[t._id.toString()] || { total: 0, pending: 0, accepted: 0, rejected: 0 },
    }));

    return { project, tasks: tasksWithStats };
  }

  /**
   * Update project
   */
  async updateProject(projectId, data) {
    const project = await Project.findByIdAndUpdate(projectId, data, {
      new: true,
      runValidators: true,
    });
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = 404;
      throw err;
    }
    return project;
  }

  /**
   * Assign an existing task to a project (or move between projects)
   */
  async assignTaskToProject(taskId, projectId) {
    const [task, project] = await Promise.all([
      Task.findById(taskId),
      Project.findById(projectId),
    ]);
    if (!task) throw Object.assign(new Error('Task not found'), { statusCode: 404 });
    if (!project) throw Object.assign(new Error('Project not found'), { statusCode: 404 });

    task.project = projectId;
    await task.save();

    // Update project task count
    await Project.findByIdAndUpdate(projectId, { $inc: { taskCount: 1 } });

    return task;
  }

  /**
   * Bulk status update all tasks in a project
   */
  async setProjectStatus(projectId, status) {
    await Project.findByIdAndUpdate(projectId, { status });
    if (status === 'paused') {
      await Task.updateMany({ project: projectId, status: 'active' }, { status: 'paused' });
    } else if (status === 'active') {
      await Task.updateMany({ project: projectId, status: 'paused' }, { status: 'active' });
    }
  }

  /**
   * Available language codes and labels
   */
  getLanguageOptions() {
    return [
      { code: 'en', label: 'English' },
      { code: 'hi', label: 'Hindi' },
      { code: 'te', label: 'Telugu' },
      { code: 'ta', label: 'Tamil' },
      { code: 'mr', label: 'Marathi' },
      { code: 'bn', label: 'Bengali' },
      { code: 'gu', label: 'Gujarati' },
      { code: 'kn', label: 'Kannada' },
      { code: 'ml', label: 'Malayalam' },
      { code: 'pa', label: 'Punjabi' },
      { code: 'ur', label: 'Urdu' },
      { code: 'or', label: 'Odia' },
      { code: 'as', label: 'Assamese' },
      { code: 'zh', label: 'Chinese' },
      { code: 'ar', label: 'Arabic' },
      { code: 'fr', label: 'French' },
      { code: 'de', label: 'German' },
      { code: 'es', label: 'Spanish' },
      { code: 'pt', label: 'Portuguese' },
      { code: 'ja', label: 'Japanese' },
      { code: 'ko', label: 'Korean' },
      { code: 'ru', label: 'Russian' },
      { code: 'tr', label: 'Turkish' },
    ];
  }
}

module.exports = new ProjectService();