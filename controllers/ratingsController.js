const asyncHandler = require('express-async-handler');
const Rating = require('../models/Rating');
const Order = require('../models/Order');

// POST /api/ratings
exports.submitRating = asyncHandler(async (req, res) => {
  const { orderId, stars, feedback } = req.body;
  if (!orderId || !stars) {
    res.status(400);
    throw new Error('orderId and stars required');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not allowed');
  }

  if (order.orderStatus !== 'DELIVERED') {
    res.status(400);
    throw new Error('Can only rate delivered orders');
  }

  if (order.rated) {
    res.status(400);
    throw new Error('Order already rated');
  }

  const rating = await Rating.create({
    user: req.user._id,
    order: order._id,
    stars: Number(stars),
    feedback: feedback || ''
  });

  order.rated = true;
  await order.save();

  res.status(201).json({ success: true, rating });
});

// GET /api/ratings/admin - admin view
exports.adminList = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Admin access required');
  }

  const ratings = await Rating.find()
    .populate('user', 'name email')
    .populate('order', 'totalAmount createdAt')
    .sort({ createdAt: -1 });

  const total = await Rating.countDocuments();
  const avg = await Rating.aggregate([{ $group: { _id: null, avg: { $avg: '$stars' } } }]);

  res.json({ ratings, total, averageRating: avg[0]?.avg || 0 });
});

// DELETE /api/ratings/:id (admin)
exports.adminDelete = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Admin access required');
  }

  const rating = await Rating.findById(req.params.id);
  if (!rating) {
    res.status(404);
    throw new Error('Rating not found');
  }

  const order = await Order.findById(rating.order);
  if (order) {
    order.rated = false;
    await order.save();
  }

  await rating.remove();
  res.json({ success: true });
});

// GET /api/ratings/admin/export - admin CSV
exports.adminExport = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Admin access required');
  }

  const ratings = await Rating.find().populate('user', 'name email').populate('order', 'createdAt');

  // Build CSV
  let csv = 'Customer Name,Email,Order ID,Stars,Feedback,Date\n';
  ratings.forEach((r) => {
    const name = r.user?.name || '';
    const email = r.user?.email || '';
    const orderId = r.order?._id || '';
    const stars = r.stars;
    const feedback = '"' + (r.feedback || '').replace(/"/g, '""') + '"';
    const date = new Date(r.createdAt).toISOString();
    csv += `${name},${email},${orderId},${stars},${feedback},${date}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ratings.csv"');
  res.send(csv);
});
