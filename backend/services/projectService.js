const Project = require('../models/Project');
const Task = require('../models/Task');
const Submission = require('../models/Submission');
const mongoose = require('mongoose');
const aiTaskService = require('./aiTaskService');
const aiProjectService = require('./ai/aiProjectService');
const { aiTaskQueue } = require('../config/queues');

class ProjectService {
  /**
   * Create a new project
   */
  async createProject(data, adminId) {
    const project = await Project.create({ ...data, createdBy: adminId });
    return project;
  }

  async generateProjectWithAI({ idea, save = false }, adminId) {
    const generated = await aiProjectService.generateProject({ idea, adminId, includeTasks: save });
    const projectData = this.normalizeGeneratedProject(generated.project);
    const taskDrafts = save
      ? generated.tasks.map((task) => this.normalizeGeneratedTask(task))
      : [];

    await this.validateGeneratedProject(projectData, adminId);
    if (save) {
      await this.validateGeneratedTasks(taskDrafts, adminId);
    }

    if (!save) {
      return {
        saved: false,
        providerUsed: generated.providerUsed,
        project: projectData,
      };
    }

    const project = await this.createProject(projectData, adminId);
    const tasks = [];
    for (const taskDraft of taskDrafts) {
      tasks.push(await this.createTaskInProject(project._id, taskDraft, adminId));
    }

    return {
      saved: true,
      providerUsed: generated.providerUsed,
      project,
      tasks,
    };
  }

  normalizeGeneratedProject(project) {
    return {
      name: this.cleanString(project.name),
      description: this.cleanString(project.description),
      client: {
        name: this.cleanString(project.client?.name),
        email: this.cleanString(project.client?.email).toLowerCase(),
        company: this.cleanString(project.client?.company),
        contractRef: this.cleanString(project.client?.contractRef),
      },
      dataset: {
        language: this.cleanString(project.dataset?.language).toLowerCase(),
        languageLabel: this.cleanString(project.dataset?.languageLabel),
        country: this.cleanString(project.dataset?.country).toUpperCase(),
        countryLabel: this.cleanString(project.dataset?.countryLabel),
        dialect: this.cleanString(project.dataset?.dialect),
        domain: this.cleanString(project.dataset?.domain) || 'general',
        dataType: this.cleanString(project.dataset?.dataType) || 'text',
        targetSize: this.cleanString(project.dataset?.targetSize),
      },
      status: project.status,
      budget: {
        total: Number(project.budget?.total) || 0,
        allocated: Number(project.budget?.allocated) || 0,
        spent: Number(project.budget?.spent) || 0,
      },
      color: this.cleanString(project.color) || '#6366f1',
      icon: this.cleanString(project.icon) || 'AI',
      tags: Array.isArray(project.tags)
        ? project.tags.map((tag) => this.cleanString(tag)).filter(Boolean)
        : [],
      startDate: project.startDate,
      deadline: project.deadline,
    };
  }

  normalizeGeneratedTask(task) {
    return {
      title: this.cleanString(task.title),
      description: this.cleanString(task.description),
      type: this.cleanString(task.type),
      instructions: this.cleanString(task.instructions),
      sampleData: {
        text: this.cleanString(task.sampleData?.text),
        fileUrl: this.cleanString(task.sampleData?.fileUrl),
        description: this.cleanString(task.sampleData?.description),
      },
      pricePerTask: Number(task.pricePerTask),
      totalSlots: Number(task.totalSlots),
      validationsRequired: Number(task.validationsRequired) || 1,
      validatorRewardPercent: Number(task.validatorRewardPercent) || 20,
      status: task.status || 'active',
      tags: Array.isArray(task.tags)
        ? task.tags.map((tag) => this.cleanString(tag)).filter(Boolean)
        : [],
      category: this.cleanString(task.category),
      difficulty: this.cleanString(task.difficulty) || 'medium',
      estimatedMinutes: task.estimatedMinutes ? Number(task.estimatedMinutes) : undefined,
    };
  }

  async validateGeneratedProject(projectData, adminId) {
    const project = new Project({ ...projectData, createdBy: adminId });
    await project.validate();
  }

  async validateGeneratedTasks(tasks, adminId) {
    if (!tasks.length) {
      throw Object.assign(new Error('AI did not generate any tasks'), { statusCode: 422 });
    }

    const projectId = new mongoose.Types.ObjectId();
    for (const taskData of tasks) {
      const task = new Task({
        ...taskData,
        project: projectId,
        createdBy: adminId,
      });
      await task.validate();
    }
  }

  cleanString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
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

    const totalTaskCount = tasks.length;
    const completedTaskCount = tasks.filter((task) => (
      task.status === 'completed' || (task.totalSlots > 0 && task.completedCount >= task.totalSlots)
    )).length;

    return {
      project,
      tasks: tasksWithStats,
      totalTaskCount,
      completedTaskCount,
    };
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

  async createTaskInProject(projectId, taskData, adminId) {
    const project = await Project.findById(projectId);
    if (!project) throw Object.assign(new Error('Project not found'), { statusCode: 404 });
    if (project.status !== 'active') {
      throw Object.assign(new Error('Cannot create tasks in inactive project'), { statusCode: 400 });
    }

    const task = await Task.create({
      ...taskData,
      project: projectId,
      createdBy: adminId,
    });

    await this.refreshProjectTaskCount(projectId);
    return task;
  }

  async generateTasksForProject(projectId, payload, adminId) {
    const project = await Project.findById(projectId);
    if (!project) throw Object.assign(new Error('Project not found'), { statusCode: 404 });
    if (project.status !== 'active') {
      throw Object.assign(new Error('Task generation allowed only for active projects'), { statusCode: 400 });
    }

    const count = Math.min(Math.max(parseInt(payload.count, 10) || 10, 1), 100);
    if (count > 20 && process.env.REDIS_HOST) {
      const job = await aiTaskQueue.add('generate-project-tasks', {
        projectId,
        adminId,
        payload: { ...payload, count },
      });
      return { queued: true, jobId: job.id, count, providerUsed: 'queued' };
    }

    const result = await this.generateAndStoreTasks(projectId, adminId, { ...payload, count });
    return {
      queued: false,
      count: result.tasks.length,
      tasks: result.tasks,
      providerUsed: result.providerUsed,
    };
  }

  async getGenerationJobStatus(projectId, jobId) {
    const job = await aiTaskQueue.getJob(jobId);
    if (!job) throw Object.assign(new Error('Generation job not found'), { statusCode: 404 });

    if (String(job.data?.projectId) !== String(projectId)) {
      throw Object.assign(new Error('Generation job does not belong to this project'), { statusCode: 403 });
    }

    const [isCompleted, isFailed, isDelayed, isActive, isWaiting] = await Promise.all([
      job.isCompleted(),
      job.isFailed(),
      job.isDelayed(),
      job.isActive(),
      job.isWaiting(),
    ]);

    let status = 'unknown';
    if (isCompleted) status = 'completed';
    else if (isFailed) status = 'failed';
    else if (isActive) status = 'active';
    else if (isDelayed) status = 'delayed';
    else if (isWaiting) status = 'waiting';

    return {
      jobId: String(job.id),
      status,
      attemptsMade: job.attemptsMade,
      progress: job.progress() || 0,
      result: job.returnvalue || null,
      providerUsed: job.returnvalue?.providerUsed || null,
      failedReason: job.failedReason || null,
    };
  }

  async generateAndStoreTasks(projectId, adminId, payload) {
    const generatedResult = await aiTaskService.generateTasks(payload);
    const generated = generatedResult.tasks || [];
    const existing = await Task.find({ project: projectId }).select('title').lean();
    const existingSet = new Set(existing.map((item) => item.title.trim().toLowerCase()));

    const toInsert = generated
      .map((item) => {
        const title = (item.title || '').trim();
        if (!title) return null;
        const dedupeKey = title.toLowerCase();
        if (existingSet.has(dedupeKey)) return null;
        existingSet.add(dedupeKey);
        return {
          title,
          description: item.description || payload.description,
          type: payload.taskType,
          instructions: item.instructions || 'Follow project instructions carefully.',
          sampleData: {
            text: item.sampleInput || '',
            description: item.expectedOutput || '',
          },
          pricePerTask: Number(payload.pricePerTask) || 1,
          totalSlots: Number(payload.totalSlots) || 1,
          status: 'active',
          project: projectId,
          createdBy: adminId,
        };
      })
      .filter(Boolean);

    if (toInsert.length === 0) {
      return { tasks: [], providerUsed: generatedResult.providerUsed || 'mock' };
    }
    const inserted = await Task.insertMany(toInsert);
    await this.refreshProjectTaskCount(projectId);
    return { tasks: inserted, providerUsed: generatedResult.providerUsed || 'mock' };
  }

  async refreshProjectTaskCount(projectId) {
    const total = await Task.countDocuments({ project: projectId });
    await Project.findByIdAndUpdate(projectId, { taskCount: total });
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
