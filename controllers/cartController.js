const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('express-async-handler');

const getDiscountedPrice = (product) => {
  const price = Number(product?.price || 0);
  const discount = Number(product?.discount || 0);
  return Number((price - (price * discount) / 100).toFixed(2));
};

const formatCart = (cart) => {
  const items = cart?.items || [];
  const subtotal = items.reduce(
    (sum, item) => sum + getDiscountedPrice(item.product) * Number(item.quantity || 1),
    0
  );
  return {
    _id: cart?._id,
    user: cart?.user,
    items,
    subtotal: Number(subtotal.toFixed(2))
  };
};

exports.getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  res.json(formatCart(cart || { items: [] }));
});

exports.addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, size = '' } = req.body;
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

  const itemIndex = cart.items.findIndex(
    (item) => String(item.product) === String(productId) && String(item.size || '') === String(size || '')
  );

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += Number(quantity);
  } else {
    cart.items.push({ product: productId, quantity: Number(quantity), size });
  }

  await cart.save();
  const populated = await Cart.findById(cart._id).populate('items.product');
  res.json(formatCart(populated));
});

exports.updateItem = asyncHandler(async (req, res) => {
  const { quantity, size } = req.body;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error('Cart not found');
  }

  const item = cart.items.id(req.params.itemId);
  if (!item) {
    res.status(404);
    throw new Error('Cart item not found');
  }
  if (quantity !== undefined) item.quantity = Number(quantity);
  if (size !== undefined) item.size = size;

  await cart.save();
  const populated = await Cart.findById(cart._id).populate('items.product');
  res.json(formatCart(populated));
});

exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error('Cart not found');
  }

  cart.items = cart.items.filter((item) => String(item._id) !== String(req.params.itemId));
  await cart.save();
  const populated = await Cart.findById(cart._id).populate('items.product');
  res.json(formatCart(populated));
});

exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.json({ items: [], subtotal: 0 });

  cart.items = [];
  await cart.save();
  res.json({ items: [], subtotal: 0 });
});
