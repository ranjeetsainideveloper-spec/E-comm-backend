const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Product = require('../models/Product');

exports.getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'wishlist',
    populate: { path: 'category', select: 'name slug' }
  });
  res.json(user?.wishlist || []);
});

exports.toggleWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const user = await User.findById(req.user._id);
  const exists = user.wishlist.find((id) => String(id) === String(productId));
  if (exists) {
    user.wishlist = user.wishlist.filter((id) => String(id) !== String(productId));
  } else {
    user.wishlist.push(productId);
  }

  await user.save();
  const wishlist = await User.findById(req.user._id).populate('wishlist');
  res.json(wishlist.wishlist);
});
