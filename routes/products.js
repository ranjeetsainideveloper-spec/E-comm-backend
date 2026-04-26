const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/role');
const reviewController = require('../controllers/reviewController');

router.get('/', productController.getProducts);
router.get('/featured/list', productController.getFeaturedProducts);
router.get('/new-arrivals/list', productController.getNewArrivals);
router.get('/filters/meta', productController.getFilterMetadata);
router.get('/search/suggestions', productController.searchSuggestions);
router.get('/:id', productController.getProduct);
router.get('/:id/related', productController.getRelatedProducts);
router.post('/', protect, adminOnly, productController.createProduct);
router.put('/:id', protect, adminOnly, productController.updateProduct);
router.delete('/:id', protect, adminOnly, productController.deleteProduct);
router.post('/:id/like', protect, productController.toggleProductLike);
router.post('/:productId/reviews', protect, reviewController.addReview);

module.exports = router;
