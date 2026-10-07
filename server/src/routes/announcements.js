'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const announcements = require('../controllers/announcementController');

const router = express.Router();

router.use(protect);

router.get('/stats/summary', asyncHandler(announcements.announcementStats));
router.get('/', asyncHandler(announcements.listAnnouncements));
router.post(
  '/',
  teacherOnly,
  validate({ body: { title: 'required', content: 'required|minlength:5' } }),
  asyncHandler(announcements.createAnnouncement)
);

router.get('/:id', asyncHandler(announcements.getAnnouncement));
router.put('/:id', teacherOnly, asyncHandler(announcements.updateAnnouncement));
router.delete('/:id', teacherOnly, asyncHandler(announcements.deleteAnnouncement));

module.exports = router;
