const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const mongoosePaginate = require('mongoose-paginate-v2');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password by default
    },
    role: {
      type: String,
      enum: ['contributor', 'validator', 'admin'],
      default: 'contributor',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'pending'],
      default: 'active',
    },

    // Profile
    avatar: String,
    bio: String,
    language: { type: String, default: 'en' },

    // Wallet
    wallet: {
      balance: { type: Number, default: 0, min: 0 },
      totalEarned: { type: Number, default: 0 },
      totalWithdrawn: { type: Number, default: 0 },
      pendingBalance: { type: Number, default: 0 }, // awaiting clearance
    },

    // Performance metrics (contributor)
    contributorStats: {
      totalSubmissions: { type: Number, default: 0 },
      acceptedSubmissions: { type: Number, default: 0 },
      rejectedSubmissions: { type: Number, default: 0 },
      acceptanceRate: { type: Number, default: 0 }, // 0-100
    },

    // Performance metrics (validator)
    validatorStats: {
      totalValidations: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      avgRatingGiven: { type: Number, default: 0 },
    },

    // User rating (aggregate of received ratings)
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },

    // Auth
    refreshTokens: [{ type: String, select: false }], // Rotating refresh tokens
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ 'wallet.balance': 1 });

// Pre-save: hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000; // Slight offset to ensure token issued after
  next();
});

// Pre-save: update acceptance rate
userSchema.pre('save', function (next) {
  if (this.contributorStats.totalSubmissions > 0) {
    this.contributorStats.acceptanceRate = Math.round(
      (this.contributorStats.acceptedSubmissions / this.contributorStats.totalSubmissions) * 100
    );
  }
  next();
});

// Instance method: verify password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

// Static method: update contribution stats
userSchema.statics.updateContributorStats = async function (userId, status) {
  const inc = {
    'contributorStats.totalSubmissions': 1,
    [`contributorStats.${status}Submissions`]: 1,
  };
  await this.findByIdAndUpdate(userId, { $inc: inc });
};

userSchema.plugin(mongoosePaginate);

const User = mongoose.model('User', userSchema);
module.exports = User;
