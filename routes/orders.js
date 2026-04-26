const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/role');
const orderController = require('../controllers/orderController');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename(req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.post('/', protect, orderController.placeOrder);
router.get('/myorders', protect, orderController.getMyOrders);
router.put('/:id/cancel', protect, orderController.cancelMyOrder);
router.put('/:id/return-request', protect, upload.array('media', 5), orderController.requestReturn);
router.get('/:id/return-chat', protect, orderController.getReturnMessages);
router.post('/:id/return-chat/message', protect, upload.array('media', 5), orderController.addReturnMessage);
router.post('/:id/refund-wallet', protect, adminOnly, orderController.refundOrderToWallet);
router.get('/:id', protect, orderController.getOrderById);
router.get('/', protect, adminOnly, orderController.getAllOrders);
router.put('/:id/status', protect, adminOnly, orderController.updateOrderStatus);

module.exports = router;
