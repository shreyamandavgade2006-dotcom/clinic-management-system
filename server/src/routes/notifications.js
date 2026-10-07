'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const notifications = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);

router.get('/', asyncHandler(notifications.listNotifications));
router.put('/read-all', asyncHandler(notifications.markAllRead));
router.delete('/', asyncHandler(notifications.clearRead));
router.post('/broadcast', teacherOnly, asyncHandler(notifications.broadcast));
router.put('/:id/read', asyncHandler(notifications.markRead));
router.delete('/:id', asyncHandler(notifications.deleteNotification));

module.exports = router;
