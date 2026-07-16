const profileService = require('../services/profileService');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess } = require('../utils/apiResponse');

const getProfile = asyncHandler(async (req, res) => {
  const user = await profileService.getProfile(req.user.id);
  return sendSuccess(res, user, 'Profile retrieved');
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  const user = await profileService.updateProfile(req.user.id, { name, email, phone });
  return sendSuccess(res, user, 'Profile updated successfully');
});

const deleteAccount = asyncHandler(async (req, res) => {
  await profileService.deleteAccount(req.user.id);
  return sendSuccess(res, {}, 'Account deleted successfully');
});

module.exports = { getProfile, updateProfile, deleteAccount };