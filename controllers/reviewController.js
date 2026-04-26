const asyncHandler = require('express-async-handler');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { recalculateProductRating } = require('./productController');

exports.addReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const review = await Review.create({
    user: req.user._id,
    product: product._id,
    rating,
    comment
  });

  product.reviews.push(review._id);
  await product.save();
  await recalculateProductRating(product._id);

  const populated = await Review.findById(review._id).populate('user', 'name avatar');
  res.status(201).json(populated);
});

exports.updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }
  if (String(review.user) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not allowed');
  }

  if (req.body.rating !== undefined) review.rating = req.body.rating;
  if (req.body.comment !== undefined) review.comment = req.body.comment;
  if (req.body.isApproved !== undefined && req.user.role === 'admin') review.isApproved = req.body.isApproved;

  await review.save();
  await recalculateProductRating(review.product);
  res.json(review);
});

exports.deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }
  if (String(review.user) !== String(req.user._id) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not allowed');
  }

  await Product.findByIdAndUpdate(review.product, {
    $pull: { reviews: review._id }
  });
  const productId = review.product;
  await review.deleteOne();
  await recalculateProductRating(productId);
  res.json({ message: 'Review removed' });
});

exports.voteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }

  const mode = req.body.mode === 'dislike' ? 'dislike' : 'like';
  const userId = req.user._id;

  review.likes = review.likes.filter((id) => String(id) !== String(userId));
  review.dislikes = review.dislikes.filter((id) => String(id) !== String(userId));

  if (mode === 'like') review.likes.push(userId);
  if (mode === 'dislike') review.dislikes.push(userId);

  await review.save();
  res.json({
    _id: review._id,
    likes: review.likes.length,
    dislikes: review.dislikes.length
  });
});

exports.getAllReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find()
    .populate('user', 'name email')
    .populate('product', 'name')
    .sort({ createdAt: -1 });
  res.json(reviews);
});
