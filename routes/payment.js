const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  initiateRazorpayOrder,
  verifyRazorpayPayment,
  getRazorpayOrderStatus,
  getTransactionHistory,
  getTransactionDetails,
  getTransactionByOrderId,
  getPaymentStatistics,
  downloadInvoice
} = require('../controllers/paymentController');

// Razorpay payment endpoints
router.post('/razorpay/initiate', protect, initiateRazorpayOrder);
router.post('/razorpay/verify', protect, verifyRazorpayPayment);
router.get('/razorpay/status/:orderId', protect, getRazorpayOrderStatus);

// Transaction history endpoints
router.get('/transactions', protect, getTransactionHistory);
router.get('/transactions/:transactionId', protect, getTransactionDetails);
router.get('/transactions/razorpay/:razorpayOrderId', protect, getTransactionByOrderId);

// Admin endpoints
router.get('/admin/statistics', protect, adminOnly, getPaymentStatistics);

// Invoice endpoints
router.get('/invoice/:orderId', protect, downloadInvoice);

module.exports = router;
