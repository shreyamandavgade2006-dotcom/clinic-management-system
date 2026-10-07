'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, studentOnly, teacherOnly } = require('../middleware/auth');
const dashboard = require('../controllers/dashboardController');

const router = express.Router();

router.use(protect);

router.get('/student', studentOnly, asyncHandler(dashboard.studentDashboard));
router.get('/teacher', teacherOnly, asyncHandler(dashboard.teacherDashboard));
router.get('/admin', asyncHandler(dashboard.adminOverview));
router.get('/analytics/:className', asyncHandler(dashboard.classAnalytics));
router.get('/leaderboard/:className', asyncHandler(dashboard.leaderboard));

module.exports = router;
