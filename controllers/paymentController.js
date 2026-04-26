const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const Razorpay = require('razorpay');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const { getDeliveryCharge } = require('../utils/storeSettings');

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

// Razorpay credentials are read from environment variables.
// Set these in your backend environment (for example, in a .env file or your process manager):
// RAZORPAY_KEY_ID=your_razorpay_key_id_here
// RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
// The function below will throw a clear error if they are missing.
const ensureRazorpayConfig = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay credentials missing. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend env.');
    error.statusCode = 500;
    throw error;
  }
};

const getRazorpayClient = () => {
  ensureRazorpayConfig();
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

const buildOrderProductsFromCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    const error = new Error('Cart is empty');
    error.statusCode = 400;
    throw error;
  }

  return {
    cart,
    items: cart.items.map((item) => ({
      product: item.product._id,
      name: item.product.name,
      image: item.product.thumbnail || item.product.images[0] || '',
      quantity: item.quantity,
      size: item.size || '',
      price: item.product.price - (item.product.price * item.product.discount) / 100
    }))
  };
};

const finalizeOrderPayment = async (order, payload = {}) => {
  if (!order) return null;

  order.paymentStatus = 'PAID';
  order.orderStatus = 'CONFIRMED';
  order.paymentDetails = {
    ...order.paymentDetails,
    gateway: 'RAZORPAY',
    merchantOrderId: payload.razorpayOrderId || order.paymentDetails?.merchantOrderId || '',
    txnId: payload.razorpayPaymentId || order.paymentDetails?.txnId || '',
    bankTxnId: payload.bankTxnId || order.paymentDetails?.bankTxnId || '',
    gatewayName: 'RAZORPAY',
    callbackPayload: payload.callbackPayload || order.paymentDetails?.callbackPayload || null
  };
  if (!order.paidAt) order.paidAt = new Date();
  await order.save();

  await Cart.findOneAndUpdate(
    { user: order.user },
    { $set: { items: [] } },
    { new: true }
  );

  // Create transaction record
  if (payload.razorpayOrderId && payload.razorpayPaymentId) {
    const transaction = await Transaction.create({
      user: order.user,
      order: order._id,
      razorpayOrderId: payload.razorpayOrderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      razorpaySignature: payload.razorpaySignature || '',
      amount: order.totalAmount,
      status: 'captured',
      razorpayResponse: payload.callbackPayload || {},
      capturedAt: new Date()
    });
    order.transaction = transaction._id;
    await order.save();
  }

  return order;
};

const markOrderPaymentFailed = async (order, payload = {}) => {
  if (!order) return null;

  order.paymentStatus = 'FAILED';
  order.paymentDetails = {
    ...order.paymentDetails,
    gateway: 'RAZORPAY',
    merchantOrderId: payload.razorpayOrderId || order.paymentDetails?.merchantOrderId || '',
    txnId: payload.razorpayPaymentId || order.paymentDetails?.txnId || '',
    bankTxnId: payload.bankTxnId || order.paymentDetails?.bankTxnId || '',
    gatewayName: 'RAZORPAY',
    callbackPayload: payload.callbackPayload || order.paymentDetails?.callbackPayload || null
  };
  await order.save();

  // Create failed transaction record
  if (payload.razorpayOrderId) {
    const transaction = await Transaction.create({
      user: order.user,
      order: order._id,
      razorpayOrderId: payload.razorpayOrderId,
      razorpayPaymentId: payload.razorpayPaymentId || '',
      razorpaySignature: payload.razorpaySignature || '',
      amount: order.totalAmount,
      status: 'failed',
      failureReason: payload.failureReason || 'Payment verification failed',
      failureCode: payload.failureCode || '',
      razorpayResponse: payload.callbackPayload || {},
      failedAt: new Date()
    });
    order.transaction = transaction._id;
    await order.save();
  }

  return order;
};

exports.initiateRazorpayOrder = asyncHandler(async (req, res) => {
  const { shippingAddress } = req.body;
  if (!shippingAddress?.fullName || !shippingAddress?.mobile || !shippingAddress?.addressLine) {
    res.status(400);
    throw new Error('Shipping address is incomplete');
  }

  const { items } = await buildOrderProductsFromCart(req.user._id);
  const itemsAmount = Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
  const deliveryCharge = await getDeliveryCharge();
  const totalAmount = Number((itemsAmount + deliveryCharge).toFixed(2));
  const receipt = `shopva_${Date.now()}`;
  const razorpay = getRazorpayClient();

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100),
    currency: 'INR',
    receipt,
    payment_capture: 1,
    notes: {
      userId: String(req.user._id),
      phone: shippingAddress.mobile
    }
  });

  const order = await Order.create({
    user: req.user._id,
    products: items,
    itemsAmount,
    deliveryCharge,
    totalAmount,
    shippingAddress,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PENDING',
    orderStatus: 'PLACED',
    paymentDetails: {
      gateway: 'RAZORPAY',
      merchantOrderId: razorpayOrder.id,
      callbackPayload: { receipt }
    }
  });

  res.json({
    internalOrderId: order._id,
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    deliveryCharge,
    itemsAmount,
    // The Razorpay publishable Key ID sent to the frontend. Set this in your backend env.
    // Example (.env): RAZORPAY_KEY_ID=rzp_test_yourKeyHere
    key: process.env.RAZORPAY_KEY_ID,
    name: 'Shopva',
    description: 'Shopva Order Payment',
    prefill: {
      name: req.user.name || shippingAddress.fullName,
      email: req.user.email || '',
      contact: shippingAddress.mobile
    },
    notes: {
      internalOrderId: String(order._id)
    },
    redirectUrl: `${FRONTEND_URL}/orders?paymentOrder=${order._id}`
  });
});

exports.verifyRazorpayPayment = asyncHandler(async (req, res) => {
  ensureRazorpayConfig();

  const {
    internalOrderId,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature
  } = req.body;

  if (!internalOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    res.status(400);
    throw new Error('Incomplete Razorpay verification payload');
  }

  const order = await Order.findById(internalOrderId);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not allowed');
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    await markOrderPaymentFailed(order, {
      razorpayOrderId,
      razorpayPaymentId,
      callbackPayload: req.body
    });
    res.status(400);
    throw new Error('Invalid Razorpay signature');
  }

  const updatedOrder = await finalizeOrderPayment(order, {
    razorpayOrderId,
    razorpayPaymentId,
    callbackPayload: req.body
  });

  res.json({
    success: true,
    order: updatedOrder
  });
});

exports.getRazorpayOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not allowed');
  }

  res.json(order);
});

/**
 * Get all transactions for a user
 */
exports.getTransactionHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const transactions = await Transaction.find({ user: req.user._id })
    .populate('order', 'orderNumber totalAmount orderStatus')
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(skip);

  const total = await Transaction.countDocuments({ user: req.user._id });
  const totalPages = Math.ceil(total / limit);

  res.json({
    transactions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages
    }
  });
});

/**
 * Get transaction details
 */
exports.getTransactionDetails = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.transactionId)
    .populate('order')
    .populate('user', 'name email mobile');

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  if (String(transaction.user._id) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not allowed');
  }

  res.json(transaction);
});

/**
 * Get transaction by Razorpay order ID
 */
exports.getTransactionByOrderId = asyncHandler(async (req, res) => {
  const { razorpayOrderId } = req.params;

  const transaction = await Transaction.findOne({ razorpayOrderId })
    .populate('order')
    .populate('user', 'name email mobile');

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  if (String(transaction.user._id) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not allowed');
  }

  res.json(transaction);
});

/**
 * Get payment statistics for admin
 */
exports.getPaymentStatistics = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Admin access required');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = {
    totalTransactions: await Transaction.countDocuments(),
    totalCaptured: await Transaction.countDocuments({ status: 'captured' }),
    totalFailed: await Transaction.countDocuments({ status: 'failed' }),
    totalRefunded: await Transaction.countDocuments({ status: 'refunded' }),
    todayTransactions: await Transaction.countDocuments({
      createdAt: { $gte: today }
    }),
    totalCapturedAmount: await Transaction.aggregate([
      { $match: { status: 'captured' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    todayAmount: await Transaction.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: '$status', total: { $sum: '$amount' } } }
    ])
  };

  res.json(stats);
});

/**
 * Download invoice (placeholder - can be enhanced with PDF generation)
 */
exports.downloadInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId)
    .populate('products.product')
    .populate('user', 'name email mobile');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (String(order.user._id) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not allowed');
  }

  // Here you would generate PDF or send invoice data
  res.json({
    invoice: {
      orderNumber: order.orderNumber,
      date: order.createdAt,
      items: order.products,
      totalAmount: order.totalAmount,
      shippingAddress: order.shippingAddress,
      paymentStatus: order.paymentStatus
    }
  });
});
