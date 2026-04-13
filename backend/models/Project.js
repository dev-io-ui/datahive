const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

/**
 * Project — a "bucket" that groups related tasks together.
 * Example: "Hindi Voice Dataset for Google" contains 3 tasks:
 *   - Record sentence (audio)
 *   - Transcribe audio (text)
 *   - Validate transcript (text)
 *
 * This solves the admin confusion problem: instead of seeing a flat list
 * of tasks with no context, admin sees Projects with client, language,
 * country, and all tasks neatly nested under them.
 */
const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [200, 'Project name too long'],
    },
    description: {
      type: String,
      maxlength: [5000, 'Description too long'],
    },

    // ── Client Info ───────────────────────────────────────────────────────────
    client: {
      name: { type: String, required: [true, 'Client name is required'], trim: true },
      email: { type: String, trim: true, lowercase: true },
      company: { type: String, trim: true },
      contractRef: { type: String, trim: true }, // internal reference/PO number
    },

    // ── Dataset Metadata ──────────────────────────────────────────────────────
    dataset: {
      language: {
        type: String,
        required: [true, 'Language is required'],
        // ISO 639-1 codes: en, hi, te, ta, mr, bn, gu, kn, ml, pa, ur, etc.
      },
      languageLabel: String, // Human readable: "Hindi", "Telugu"
      country: {
        type: String,
        required: [true, 'Country is required'],
        // ISO 3166-1 alpha-2: IN, US, GB, AU, etc.
      },
      countryLabel: String,  // "India", "United States"
      dialect: String,       // e.g. "Mumbai Hindi", "Hyderabad Telugu"
      domain: {
        type: String,
        enum: ['general', 'medical', 'legal', 'finance', 'agriculture', 'education', 'ecommerce', 'other'],
        default: 'general',
      },
      dataType: {
        type: String,
        enum: ['speech', 'text', 'image', 'multimodal'],
        default: 'speech',
      },
      targetSize: String,    // "10,000 utterances", "5GB audio"
    },

    // ── Status & Progress ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed', 'archived'],
      default: 'draft',
    },

    // Budget tracking
    budget: {
      total: { type: Number, default: 0 },      // Total project budget
      allocated: { type: Number, default: 0 },   // Assigned to tasks
      spent: { type: Number, default: 0 },       // Actually paid out
    },

    // Color for visual distinction in UI
    color: {
      type: String,
      default: '#6366f1', // indigo
      match: [/^#[0-9A-Fa-f]{6}$/, 'Invalid color hex'],
    },

    // Icon/emoji for quick recognition
    icon: { type: String, default: '📁' },

    // Tags for filtering
    tags: [{ type: String, trim: true }],

    // Timeline
    startDate: Date,
    deadline: Date,

    // Relations
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Cached counts (updated via hooks for performance)
    taskCount: { type: Number, default: 0 },
    submissionCount: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Virtual: completion percentage
projectSchema.virtual('completionRate').get(function () {
  if (!this.submissionCount) return 0;
  return Math.round((this.acceptedCount / this.submissionCount) * 100);
});

// Virtual: is overdue?
projectSchema.virtual('isOverdue').get(function () {
  return this.deadline && this.deadline < new Date() && this.status !== 'completed';
});

projectSchema.index({ status: 1 });
projectSchema.index({ 'dataset.language': 1 });
projectSchema.index({ 'dataset.country': 1 });
projectSchema.index({ 'client.name': 1 });
projectSchema.index({ createdBy: 1 });
projectSchema.index({ tags: 1 });

projectSchema.plugin(mongoosePaginate);

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;