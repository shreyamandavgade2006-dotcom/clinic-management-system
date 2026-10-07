'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const whatsapp = require('../controllers/whatsappController');

const router = express.Router();

router.use(protect);

router.get('/status', asyncHandler(whatsapp.status));
router.get('/logs', asyncHandler(whatsapp.logs));
router.get('/defaulters', asyncHandler(whatsapp.defaulters));
router.post('/attendance-alerts', teacherOnly, asyncHandler(whatsapp.triggerAttendanceAlerts));
router.post('/send', teacherOnly, asyncHandler(whatsapp.sendManual));
router.post('/test', teacherOnly, asyncHandler(whatsapp.sendTest));

module.exports = router;
