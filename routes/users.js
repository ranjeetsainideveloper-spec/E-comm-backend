const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.get('/wishlist', protect, userController.getWishlist);
router.post('/wishlist/toggle', protect, userController.toggleWishlist);

module.exports = router;
