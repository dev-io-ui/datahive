const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, deleteAccount } = require('../controllers/profileController');

// NOTE: import whatever auth middleware your other routers use to set
// req.user (e.g. the one guarding /tasks, /wallet, etc). I don't have that
// file's contents, so swap `authenticate` below for the real export name.
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getProfile);
router.put('/', authenticate, updateProfile);
router.delete('/', authenticate, deleteAccount);

module.exports = router;

/*
  Mount this in routes/index.js next to your other feature routers:

    router.use('/profile', require('./profileRoutes'));

  It'll then be reachable at /api/v1/profile (GET/PUT/DELETE).
*/