const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('express-async-handler');
const { getDeliveryCharge } = require('../utils/storeSettings');
const User = require('../models/User');
const { syncWalletBalance, debitWallet, creditWallet } = require('../utils/wallet');

const VALID_ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED'];
const VALID_PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED'];
const VALID_SUPPORT_TYPES = ['RETURN', 'REPLACE', 'OTHER'];
const SUPPORT_WINDOW_DAYS = 3;

const ensureOrderAccess = (order, user, res) => {
  const belongsToUser = String(order.user) === String(user._id) || String(order.user?._id) === String(user._id);
  if (!belongsToUser && user.role !== 'admin') {
    res.status(403);
    throw new Error('Not allowed');
  }
};

const mapFileUrls = (files = []) => files.map((file) => `/uploads/${file.filename}`);

const getSupportWindowDeadline = (order) => {
  const baseDate = order.deliveredAt || order.createdAt;
  if (!baseDate) return null;
  return new Date(new Date(baseDate).getTime() + SUPPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
};

const isSupportWindowExpired = (order) => {
  const deadline = getSupportWindowDeadline(order);
  if (!deadline) return false;
  return Date.now() > deadline.getTime();
};

const buildSupportWindowMeta = (order) => {
  const deadline = getSupportWindowDeadline(order);
  const expired = isSupportWindowExpired(order);
  return {
    supportWindowDays: SUPPORT_WINDOW_DAYS,
    supportDeadline: deadline,
    supportExpired: expired
  };
};

const populateReturnMessages = async (orderId) =>
  Order.findById(orderId)
    .populate('user', 'name email phone refundDetails')
    .populate('products.product', 'name thumbnail')
    .populate('returnMessages.sender.user', 'name email role avatar');

exports.placeOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod = 'COD', products } = req.body;
  let finalProducts = [];
  let cart = null;

  if (Array.isArray(products) && products.length > 0) {
    const items = await Promise.all(
      products.map(async (item) => {
        const product = await Product.findById(item.productId);
        if (!product) {
          throw new Error('Invalid product in order');
        }
        return {
          product: product._id,
          productKeyId: product.productKeyId || '',
          name: product.name,
          image: product.thumbnail || product.images[0] || '',
          quantity: Number(item.quantity || 1),
          size: item.size || '',
          price: product.price - (product.price * product.discount) / 100
        };
      })
    );
    finalProducts = items;
  } else {
    cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      res.status(400);
      throw new Error('Cart is empty');
    }

    finalProducts = cart.items.map((item) => ({
      product: item.product._id,
      productKeyId: item.product.productKeyId || '',
      name: item.product.name,
      image: item.product.thumbnail || item.product.images[0] || '',
      quantity: item.quantity,
        size: item.size || '',
        price: item.product.price - (item.product.price * item.product.discount) / 100
      }));
  }

  const itemsAmount = Number(
    finalProducts.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
  );
  const deliveryCharge = await getDeliveryCharge();
  const totalAmount = Number((itemsAmount + deliveryCharge).toFixed(2));
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  await syncWalletBalance(user);

  const isWalletPayment = paymentMethod === 'WALLET';

  if (isWalletPayment) {
    await debitWallet(user, {
      amount: totalAmount,
      note: 'Wallet used for Shopva order'
    });
  }

  const order = await Order.create({
    user: req.user._id,
    products: finalProducts,
    itemsAmount,
    deliveryCharge,
    totalAmount,
    shippingAddress,
    paymentMethod,
    // Scanner method removed — wallet payments are auto-marked as PAID, others remain PENDING
    paymentStatus: isWalletPayment ? 'PAID' : 'PENDING',
    paidAt: isWalletPayment ? new Date() : undefined
  });

  if (isWalletPayment) {
    user.wallet.entries[user.wallet.entries.length - 1].orderId = order._id;
    await user.save();
    await syncWalletBalance(user);
  }

  if (cart) {
    cart.items = [];
    await cart.save();
  }

  res.status(201).json(order);
});

exports.getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders.map((order) => ({
    ...order.toObject(),
    ...buildSupportWindowMeta(order)
  })));
});

exports.getOrderById = asyncHandler(async (req, res) => {
  const order = await populateReturnMessages(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  ensureOrderAccess(order, req.user, res);

  res.json({
    ...order.toObject(),
    ...buildSupportWindowMeta(order)
  });
});

exports.getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .populate('user', 'name email phone refundDetails')
    .populate('products.product', 'name thumbnail')
    .populate('returnMessages.sender.user', 'name email role avatar')
    .sort({ createdAt: -1 });
  res.json(orders.map((order) => ({
    ...order.toObject(),
    ...buildSupportWindowMeta(order)
  })));
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (req.body.orderStatus) {
    if (!VALID_ORDER_STATUSES.includes(req.body.orderStatus)) {
      res.status(400);
      throw new Error('Invalid order status');
    }
    order.orderStatus = req.body.orderStatus;
  }

  if (req.body.paymentStatus) {
    if (!VALID_PAYMENT_STATUSES.includes(req.body.paymentStatus)) {
      res.status(400);
      throw new Error('Invalid payment status');
    }
    order.paymentStatus = req.body.paymentStatus;
  }

  if (order.orderStatus === 'DELIVERED' && !order.deliveredAt) {
    order.deliveredAt = new Date();
  }
  if (order.paymentStatus === 'PAID' && !order.paidAt) {
    order.paidAt = new Date();
  }

  await order.save();
  res.json(order);
});

exports.cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (String(order.user) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Not allowed');
  }

  if (!['PLACED', 'CONFIRMED'].includes(order.orderStatus)) {
    res.status(400);
    throw new Error('This order cannot be cancelled now');
  }

  order.orderStatus = 'CANCELLED';
  await order.save();
  res.json(order);
});

exports.requestReturn = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (String(order.user) !== String(req.user._id)) {
    res.status(403);
    throw new Error('Not allowed');
  }

  const supportType = (req.body.type || 'RETURN').toUpperCase();
  if (!VALID_SUPPORT_TYPES.includes(supportType)) {
    res.status(400);
    throw new Error('Invalid support request type');
  }

  if (['RETURN', 'REPLACE'].includes(supportType) && order.orderStatus !== 'DELIVERED') {
    res.status(400);
    throw new Error('Return or replace request allowed only for delivered orders');
  }

  if (['RETURN', 'REPLACE', 'OTHER'].includes(supportType) && isSupportWindowExpired(order)) {
    res.status(400);
    throw new Error(`Support chat or return request is allowed only within ${SUPPORT_WINDOW_DAYS} days of delivery`);
  }

  if (supportType === 'OTHER' && order.orderStatus === 'CANCELLED') {
    res.status(400);
    throw new Error('Support request not allowed for cancelled orders');
  }

  const attachments = mapFileUrls(req.files);
  const reason = (req.body.reason || '').trim();

  order.orderStatus = 'RETURN_REQUESTED';
  order.returnRequest = {
    requestedAt: new Date(),
    reason,
    type: supportType,
    status: 'REQUESTED'
  };
  order.returnMessages.push({
    sender: {
      role: 'customer',
      user: req.user._id,
      name: req.user.name || ''
    },
    text: reason || `${supportType.toLowerCase()} request created by customer.`,
    attachments
  });
  await order.save();
  const populated = await populateReturnMessages(order._id);
  res.json(populated);
});

exports.getReturnMessages = asyncHandler(async (req, res) => {
  const order = await populateReturnMessages(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  ensureOrderAccess(order, req.user, res);
  res.json({
    _id: order._id,
    orderStatus: order.orderStatus,
    returnRequest: order.returnRequest,
    returnMessages: order.returnMessages || [],
    products: order.products || [],
    user: order.user,
    ...buildSupportWindowMeta(order)
  });
});

exports.addReturnMessage = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  ensureOrderAccess(order, req.user, res);

  if (!['RETURN_REQUESTED', 'RETURNED', 'DELIVERED'].includes(order.orderStatus)) {
    res.status(400);
    throw new Error('Return conversation is only available for delivered or return orders');
  }

  if (req.user.role !== 'admin' && isSupportWindowExpired(order)) {
    res.status(400);
    throw new Error(`You can message support only within ${SUPPORT_WINDOW_DAYS} days of delivery`);
  }

  const text = (req.body.text || '').trim();
  const attachments = mapFileUrls(req.files);
  if (!text && attachments.length === 0) {
    res.status(400);
    throw new Error('Message text or attachment is required');
  }

  const senderRole = req.user.role === 'admin' ? 'admin' : 'customer';
  order.returnMessages.push({
    sender: {
      role: senderRole,
      user: req.user._id,
      name: req.user.name || ''
    },
    text,
    attachments
  });

  if (senderRole === 'admin' && order.returnRequest?.status === 'REQUESTED') {
    order.returnRequest.status = 'UNDER_REVIEW';
  }

  await order.save();
  const populated = await populateReturnMessages(order._id);
  res.status(201).json({
    _id: populated._id,
    orderStatus: populated.orderStatus,
    returnRequest: populated.returnRequest,
    returnMessages: populated.returnMessages || [],
    products: populated.products || [],
    user: populated.user,
    ...buildSupportWindowMeta(populated)
  });
});

exports.refundOrderToWallet = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email phone refundDetails wallet');
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (!['RETURN_REQUESTED', 'RETURNED', 'DELIVERED'].includes(order.orderStatus)) {
    res.status(400);
    throw new Error('Wallet refund is only available for delivered or return orders');
  }

  if (order.returnRequest?.status === 'REFUNDED_TO_WALLET') {
    res.status(400);
    throw new Error('Wallet refund already processed for this order');
  }

  const user = await User.findById(order.user._id);
  if (!user) {
    res.status(404);
    throw new Error('Customer not found');
  }

  await creditWallet(user, {
    amount: order.totalAmount,
    note: `Refund credited to Shopva wallet for order ${order._id.slice(-8)}`,
    orderId: order._id
  });

  order.returnRequest = {
    ...(order.returnRequest || {}),
    status: 'REFUNDED_TO_WALLET',
    refundedAt: new Date()
  };
  order.returnMessages.push({
    sender: {
      role: 'admin',
      user: req.user._id,
      name: req.user.name || 'Admin'
    },
    text: `Refund of Rs.${Math.round(order.totalAmount)} moved to Shopva wallet. Wallet credits expire after 4 months if unused.`
  });
  await order.save();

  const populated = await populateReturnMessages(order._id);
  res.json({
    order: populated,
    wallet: user.wallet
  });
});
