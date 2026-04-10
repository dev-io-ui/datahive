const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const submissionSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    contributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskAssignment',
    },

    // Submitted content (only one will be populated based on task type)
    content: {
      text: String,        // for text tasks
      fileUrl: String,     // S3 URL for audio/image
      fileKey: String,     // S3 key for deletion
      fileSize: Number,    // bytes
      mimeType: String,
      duration: Number,    // audio duration in seconds
      metadata: mongoose.Schema.Types.Mixed, // extra data from contributor
    },

    // Overall submission status
    status: {
      type: String,
      enum: ['pending', 'under_review', 'accepted', 'rejected', 'disputed'],
      default: 'pending',
    },

    // Final decision (set when validationsRequired are met)
    finalDecision: {
      type: String,
      enum: ['accepted', 'rejected'],
    },
    finalDecisionAt: Date,

    // Validation tracking
    validationAssignments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ValidationAssignment',
    }],
    validationCount: { type: Number, default: 0 }, // how many validations done
    acceptCount: { type: Number, default: 0 },
    rejectCount: { type: Number, default: 0 },

    // Average rating given by validators
    avgRating: { type: Number, default: 0, min: 0, max: 5 },

    // Quality
    qualityScore: { type: Number, min: 0, max: 100 }, // computed quality metric

    // Processing
    processingStatus: {
      type: String,
      enum: ['queued', 'processing', 'processed', 'failed'],
      default: 'queued',
    },

    // Audit
    isAuditSample: { type: Boolean, default: false },
    auditResult: {
      type: String,
      enum: ['pass', 'fail'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Compound index: prevent duplicate submissions per contributor per task
submissionSchema.index({ task: 1, contributor: 1 }, { unique: true });
submissionSchema.index({ status: 1, task: 1 });
submissionSchema.index({ contributor: 1, status: 1 });
submissionSchema.index({ 'validationAssignments': 1 });
submissionSchema.index({ createdAt: -1 });

// Virtual: is this submission fully validated?
submissionSchema.virtual('isFullyValidated').get(function () {
  // Will be set based on task.validationsRequired at service layer
  return this.finalDecision != null;
});

submissionSchema.plugin(mongoosePaginate);

const Submission = mongoose.model('Submission', submissionSchema);
module.exports = Submission;
