const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  submitRating,
  adminList,
  adminDelete,
  adminExport
} = require('../controllers/ratingsController');

router.post('/', protect, submitRating);
router.get('/admin', protect, adminList);
router.delete('/:id', protect, adminDelete);
router.get('/admin/export', protect, adminExport);

module.exports = router;
