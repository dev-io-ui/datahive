const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Task description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    type: {
      type: String,
      enum: ['audio', 'text', 'image'],
      required: [true, 'Task type is required'],
    },
    instructions: {
      type: String,
      required: [true, 'Instructions are required'],
      maxlength: [10000, 'Instructions too long'],
    },

    // Optional sample to show contributors what's expected
    sampleData: {
      text: String,
      fileUrl: String,
      description: String,
    },

    // Economics
    pricePerTask: {
      type: Number,
      required: [true, 'Price per task is required'],
      min: [0.01, 'Price must be at least 0.01'],
    },
    validatorRewardPercent: {
      type: Number,
      default: 20, // Validator earns 20% of task price
      min: 0,
      max: 100,
    },

    // Capacity
    totalSlots: {
      type: Number,
      required: [true, 'Total slots is required'],
      min: [1, 'Must have at least 1 slot'],
    },
    assignedCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },

    // Multi-validation settings
    validationsRequired: {
      type: Number,
      default: 1, // How many validators must review each submission
      min: 1,
      max: 5,
    },

    // Status
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed', 'archived'],
      default: 'draft',
    },

    // Metadata
    tags: [{ type: String, trim: true }],
    category: String,
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    estimatedMinutes: Number, // how long the task should take

    // Audit flags
    requiresAudit: { type: Boolean, default: false },
    auditSampleRate: { type: Number, default: 0.1 }, // 10% sampled for audit

    // Relations
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      // optional — tasks can exist standalone or inside a project
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Dates
    startsAt: Date,
    endsAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Virtuals
taskSchema.virtual('availableSlots').get(function () {
  return Math.max(0, this.totalSlots - this.assignedCount);
});

taskSchema.virtual('completionRate').get(function () {
  if (this.totalSlots === 0) return 0;
  return Math.round((this.completedCount / this.totalSlots) * 100);
});

taskSchema.virtual('validatorReward').get(function () {
  return parseFloat(((this.pricePerTask * this.validatorRewardPercent) / 100).toFixed(4));
});

// Indexes
taskSchema.index({ status: 1, type: 1 });
taskSchema.index({ status: 1, assignedCount: 1, totalSlots: 1 }); // for assignment queries
taskSchema.index({ createdBy: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ endsAt: 1 }, { expireAfterSeconds: 0, sparse: true }); // TTL index

taskSchema.plugin(mongoosePaginate);

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;


// const mongoose = require('mongoose');
// const mongoosePaginate = require('mongoose-paginate-v2');

// const taskSchema = new mongoose.Schema(
//   {
//     title: {
//       type: String,
//       required: [true, 'Task title is required'],
//       trim: true,
//       maxlength: [200, 'Title cannot exceed 200 characters'],
//     },
//     description: {
//       type: String,
//       required: [true, 'Task description is required'],
//       maxlength: [5000, 'Description cannot exceed 5000 characters'],
//     },
//     type: {
//       type: String,
//       enum: ['audio', 'text', 'image'],
//       required: [true, 'Task type is required'],
//     },
//     instructions: {
//       type: String,
//       required: [true, 'Instructions are required'],
//       maxlength: [10000, 'Instructions too long'],
//     },

//     // Optional sample to show contributors what's expected
//     sampleData: {
//       text: String,
//       fileUrl: String,
//       description: String,
//     },

//     // Economics
//     pricePerTask: {
//       type: Number,
//       required: [true, 'Price per task is required'],
//       min: [0.01, 'Price must be at least 0.01'],
//     },
//     validatorRewardPercent: {
//       type: Number,
//       default: 20, // Validator earns 20% of task price
//       min: 0,
//       max: 100,
//     },

//     // Capacity
//     totalSlots: {
//       type: Number,
//       required: [true, 'Total slots is required'],
//       min: [1, 'Must have at least 1 slot'],
//     },
//     assignedCount: { type: Number, default: 0 },
//     completedCount: { type: Number, default: 0 },

//     // Multi-validation settings
//     validationsRequired: {
//       type: Number,
//       default: 1, // How many validators must review each submission
//       min: 1,
//       max: 5,
//     },

//     // Status
//     status: {
//       type: String,
//       enum: ['draft', 'active', 'paused', 'completed', 'archived'],
//       default: 'draft',
//     },

//     // Metadata
//     tags: [{ type: String, trim: true }],
//     category: String,
//     difficulty: {
//       type: String,
//       enum: ['easy', 'medium', 'hard'],
//       default: 'medium',
//     },
//     estimatedMinutes: Number, // how long the task should take

//     // Audit flags
//     requiresAudit: { type: Boolean, default: false },
//     auditSampleRate: { type: Number, default: 0.1 }, // 10% sampled for audit

//     // Relations
//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//     },

//     // Dates
//     startsAt: Date,
//     endsAt: Date,
//   },
//   {
//     timestamps: true,
//     toJSON: { virtuals: true },
//   }
// );

// // Virtuals
// taskSchema.virtual('availableSlots').get(function () {
//   return Math.max(0, this.totalSlots - this.assignedCount);
// });

// taskSchema.virtual('completionRate').get(function () {
//   if (this.totalSlots === 0) return 0;
//   return Math.round((this.completedCount / this.totalSlots) * 100);
// });

// taskSchema.virtual('validatorReward').get(function () {
//   return parseFloat(((this.pricePerTask * this.validatorRewardPercent) / 100).toFixed(4));
// });

// // Indexes
// taskSchema.index({ status: 1, type: 1 });
// taskSchema.index({ status: 1, assignedCount: 1, totalSlots: 1 }); // for assignment queries
// taskSchema.index({ createdBy: 1 });
// taskSchema.index({ tags: 1 });
// taskSchema.index({ endsAt: 1 }, { expireAfterSeconds: 0, sparse: true }); // TTL index

// taskSchema.plugin(mongoosePaginate);

// const Task = mongoose.model('Task', taskSchema);
// module.exports = Task;
