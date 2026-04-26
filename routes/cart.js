const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const cartController = require('../controllers/cartController');

router.get('/', protect, cartController.getCart);
router.post('/add', protect, cartController.addToCart);
router.put('/item/:itemId', protect, cartController.updateItem);
router.delete('/item/:itemId', protect, cartController.removeItem);
router.delete('/clear', protect, cartController.clearCart);

module.exports = router;
