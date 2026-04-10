const mongoose = require('mongoose');
const Task = require('../models/Task');
const Submission = require('../models/Submission');
const User = require('../models/User');
const ValidationAssignment = require('../models/ValidationAssignment');
const WalletTransaction = require('../models/WalletTransaction');

class AnalyticsService {
  /**
   * Admin dashboard summary stats
   */
  async getDashboardStats() {
    const [
      taskStats,
      submissionStats,
      userStats,
      revenueStats,
    ] = await Promise.all([
      this._getTaskStats(),
      this._getSubmissionStats(),
      this._getUserStats(),
      this._getRevenueStats(),
    ]);

    return { taskStats, submissionStats, userStats, revenueStats };
  }

  async _getTaskStats() {
    const result = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalSlots: { $sum: '$totalSlots' },
          completedSlots: { $sum: '$completedCount' },
          totalValue: { $sum: { $multiply: ['$pricePerTask', '$totalSlots'] } },
        },
      },
    ]);

    const byStatus = {};
    result.forEach(r => { byStatus[r._id] = r; });

    const total = await Task.countDocuments();
    return { total, byStatus };
  }

  async _getSubmissionStats() {
    const [statusCounts, dailyTrend, acceptanceRate] = await Promise.all([
      Submission.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Submission.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Submission.aggregate([
        { $match: { status: { $in: ['accepted', 'rejected'] } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          },
        },
        {
          $project: {
            rate: { $multiply: [{ $divide: ['$accepted', '$total'] }, 100] },
          },
        },
      ]),
    ]);

    const byStatus = {};
    statusCounts.forEach(s => { byStatus[s._id] = s.count; });

    return {
      byStatus,
      dailyTrend,
      acceptanceRate: Math.round(acceptanceRate[0]?.rate || 0),
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    };
  }

  async _getUserStats() {
    const [roleCounts, activeUsers] = await Promise.all([
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      User.countDocuments({
        lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    const byRole = {};
    roleCounts.forEach(r => { byRole[r._id] = r.count; });

    return {
      total: Object.values(byRole).reduce((a, b) => a + b, 0),
      byRole,
      activeThisWeek: activeUsers,
    };
  }

  async _getRevenueStats() {
    const result = await WalletTransaction.aggregate([
      { $match: { status: 'completed', amount: { $gt: 0 } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const byType = {};
    result.forEach(r => { byType[r._id] = { total: r.total, count: r.count }; });

    const totalPaidOut = result.reduce((acc, r) => acc + r.total, 0);
    return { byType, totalPaidOut };
  }

  /**
   * Export dataset: all accepted submissions for a task
   */
  async exportDataset(taskId, format = 'json') {
    const submissions = await Submission.find({
      task: taskId,
      status: 'accepted',
    })
      .populate('contributor', 'name')
      .populate('task', 'title type')
      .lean();

    const rows = submissions.map(s => ({
      id: s._id.toString(),
      taskTitle: s.task.title,
      taskType: s.task.type,
      contributorName: s.contributor.name,
      textContent: s.content.text || null,
      fileUrl: s.content.fileUrl || null,
      mimeType: s.content.mimeType || null,
      fileSize: s.content.fileSize || null,
      avgRating: s.avgRating,
      submittedAt: s.createdAt,
      validatedAt: s.finalDecisionAt,
    }));

    if (format === 'json') {
      return JSON.stringify(rows, null, 2);
    }

    // CSV
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]).join(',');
    const csvRows = rows.map(row =>
      Object.values(row)
        .map(v => (v === null ? '' : `"${String(v).replace(/"/g, '""')}"`) )
        .join(',')
    );
    return [headers, ...csvRows].join('\n');
  }

  /**
   * Top contributors leaderboard
   */
  async getLeaderboard(limit = 20) {
    return User.find({ role: 'contributor', status: 'active' })
      .select('name contributorStats wallet.totalEarned rating')
      .sort({ 'contributorStats.acceptedSubmissions': -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = new AnalyticsService();
