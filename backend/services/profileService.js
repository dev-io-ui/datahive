const User = require('../models/User');

class ProfileService {
  /**
   * Get the logged-in user's own profile
   */
  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return user;
  }

  /**
   * Update the logged-in user's own profile (name, email, phone)
   */
  async updateProfile(userId, { name, email, phone }) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        const err = new Error('Email is already in use');
        err.statusCode = 409;
        throw err;
      }
      user.email = email.toLowerCase();
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;

    await user.save();
    return user;
  }

  /**
   * Permanently delete the logged-in user's account
   */
  async deleteAccount(userId) {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return user;
  }
}

module.exports = new ProfileService();