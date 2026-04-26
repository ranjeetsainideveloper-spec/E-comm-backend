const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { getStoreSettings, getDeliveryCharge, normalizeDeliveryCharge, MAX_DELIVERY_CHARGE } = require('../utils/storeSettings');
const { syncWalletBalance } = require('../utils/wallet');

exports.getDashboardStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalOrders, totalProducts, revenueResult] = await Promise.all([
    User.countDocuments(),
    Order.countDocuments(),
    Product.countDocuments(),
    Order.aggregate([
      { $match: { paymentStatus: { $in: ['PAID', 'PENDING'] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ])
  ]);

  res.json({
    totalUsers,
    totalOrders,
    totalProducts,
    totalRevenue: revenueResult[0]?.totalRevenue || 0
  });
});

exports.getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });
  await Promise.all(users.map((user) => syncWalletBalance(user)));
  res.json(users);
});

exports.updateUserRole = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  user.role = req.body.role || user.role;
  await user.save();
  res.json({ _id: user._id, role: user.role });
});

exports.getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });
  res.json(orders);
});

exports.getReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find()
    .populate('user', 'name email')
    .populate('product', 'name')
    .sort({ createdAt: -1 });
  res.json(reviews);
});

exports.getStoreSettings = asyncHandler(async (req, res) => {
  const settings = await getStoreSettings();
  res.json({
    deliveryCharge: normalizeDeliveryCharge(settings.deliveryCharge),
    updatedAt: settings.updatedAt
  });
});

exports.updateStoreSettings = asyncHandler(async (req, res) => {
  const settings = await getStoreSettings();
  const nextDeliveryCharge = Number(req.body.deliveryCharge);

  if (Number.isNaN(nextDeliveryCharge) || nextDeliveryCharge < 0) {
    res.status(400);
    throw new Error('Delivery charge must be a valid non-negative number');
  }

  if (nextDeliveryCharge > MAX_DELIVERY_CHARGE) {
    res.status(400);
    throw new Error(`Delivery charge cannot be more than Rs.${MAX_DELIVERY_CHARGE}`);
  }

  settings.deliveryCharge = normalizeDeliveryCharge(nextDeliveryCharge);
  await settings.save();

  res.json({
    deliveryCharge: await getDeliveryCharge(),
    updatedAt: settings.updatedAt
  });
});
