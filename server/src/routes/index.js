'use strict';

const express = require('express');
const { databaseStatus } = require('../config/db');
const { providerStatus } = require('../services/aiService');
const env = require('../config/env');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Smart Student Management System API',
      version: '1.0.0',
      endpoints: [
        '/api/health',
        '/api/auth',
        '/api/students',
        '/api/teachers',
        '/api/subjects',
        '/api/attendance',
        '/api/marks',
        '/api/assignments',
        '/api/exams',
        '/api/quizzes  (AI question & assessment generator)',
        '/api/notifications',
        '/api/announcements',
        '/api/whatsapp  (attendance alerts)',
        '/api/dashboard',
        '/api/ai',
      ],
    },
  });
});

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
      database: databaseStatus(),
      ai: providerStatus(),
      whatsapp: env.whatsappProvider,
    },
  });
});

router.use('/auth', require('./auth'));
router.use('/students', require('./students'));
router.use('/teachers', require('./teachers'));
router.use('/subjects', require('./subjects'));
router.use('/attendance', require('./attendance'));
router.use('/marks', require('./marks'));
router.use('/assignments', require('./assignments'));
router.use('/exams', require('./exams'));
router.use('/quizzes', require('./quizzes'));
router.use('/notifications', require('./notifications'));
router.use('/announcements', require('./announcements'));
router.use('/whatsapp', require('./whatsapp'));
router.use('/dashboard', require('./dashboard'));
router.use('/ai', require('./ai'));

module.exports = router;
