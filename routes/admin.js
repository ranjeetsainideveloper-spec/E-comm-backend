const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/role');
const adminController = require('../controllers/adminController');
const reviewController = require('../controllers/reviewController');

router.get('/dashboard', protect, adminOnly, adminController.getDashboardStats);
router.get('/users', protect, adminOnly, adminController.getUsers);
router.put('/users/:id/role', protect, adminOnly, adminController.updateUserRole);
router.get('/orders', protect, adminOnly, adminController.getOrders);
router.get('/reviews', protect, adminOnly, adminController.getReviews);
router.get('/settings', protect, adminOnly, adminController.getStoreSettings);
router.put('/settings', protect, adminOnly, adminController.updateStoreSettings);
router.put('/reviews/:id', protect, adminOnly, reviewController.updateReview);
router.delete('/reviews/:id', protect, adminOnly, reviewController.deleteReview);

module.exports = router;
