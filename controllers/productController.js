const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Cart = require('../models/Cart');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

const normalizeProductKeyId = (value = '') => String(value || '').trim().toUpperCase();

const generateProductKeyId = async () => {
  let candidate = '';
  let exists = true;

  while (exists) {
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    candidate = `PRD-${randomPart}`;
    exists = await Product.exists({ productKeyId: candidate });
  }

  return candidate;
};

const parseSort = (sortBy = 'newest') => {
  if (sortBy === 'low_to_high') return { price: 1 };
  if (sortBy === 'high_to_low') return { price: -1 };
  if (sortBy === 'rating') return { ratings: -1 };
  return { createdAt: -1 };
};

exports.getProducts = asyncHandler(async (req, res) => {
  const {
    q,
    category,
    brand,
    size,
    minPrice = 0,
    maxPrice = 999999,
    minRating = 0,
    sort = 'newest',
    page = 1,
    limit = 12
  } = req.query;

  const query = {
    price: { $gte: Number(minPrice), $lte: Number(maxPrice) },
    ratings: { $gte: Number(minRating) }
  };

  if (q) query.name = { $regex: q, $options: 'i' };
  if (brand) query.brand = { $regex: `^${brand}$`, $options: 'i' };
  if (size) query.sizes = { $in: [size] };

  if (category) {
    const categoryDoc = await Category.findOne({ slug: category });
    if (categoryDoc) query.category = categoryDoc._id;
  }

  const options = {
    page: Number(page),
    limit: Number(limit),
    sort: parseSort(sort),
    populate: { path: 'category', select: 'name slug' }
  };

  const result = await Product.paginate(query, options);
  res.json(result);
});

exports.getFeaturedProducts = asyncHandler(async (req, res) => {
  const featured = await Product.find({ isFeatured: true })
    .limit(12)
    .sort({ createdAt: -1 })
    .populate('category', 'name slug');
  res.json(featured);
});

exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name slug')
    .populate({
      path: 'reviews',
      match: { isApproved: true },
      populate: { path: 'user', select: 'name avatar' },
      options: { sort: { createdAt: -1 } }
    });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json(product);
});

exports.createProduct = asyncHandler(async (req, res) => {
  const { name, description, productKeyId, price, discount, category, brand, sizes, stock, images, thumbnail } = req.body;
  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) {
    res.status(400);
    throw new Error('Valid category is required');
  }

  const normalizedProductKeyId = normalizeProductKeyId(productKeyId) || await generateProductKeyId();

  const existingProduct = await Product.findOne({ productKeyId: normalizedProductKeyId });
  if (existingProduct) {
    res.status(400);
    throw new Error('Product key ID already exists');
  }

  if (!Array.isArray(images) || images.length < 4) {
    res.status(400);
    throw new Error('Minimum 4 product images are required');
  }

  const product = await Product.create({
    name,
    description,
    productKeyId: normalizedProductKeyId,
    price,
    discount,
    category,
    brand,
    sizes: Array.isArray(sizes) ? sizes : [],
    stock,
    images,
    thumbnail: thumbnail || (images && images[0]) || ''
  });

  const populated = await Product.findById(product._id).populate('category', 'name slug');
  res.status(201).json(populated);
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const fields = ['name', 'description', 'price', 'discount', 'brand', 'stock', 'thumbnail', 'isFeatured'];
  fields.forEach((field) => {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  });

  if (req.body.productKeyId !== undefined) {
    const normalizedProductKeyId = normalizeProductKeyId(req.body.productKeyId) || await generateProductKeyId();

    const existingProduct = await Product.findOne({
      productKeyId: normalizedProductKeyId,
      _id: { $ne: product._id }
    });
    if (existingProduct) {
      res.status(400);
      throw new Error('Product key ID already exists');
    }

    product.productKeyId = normalizedProductKeyId;
  }

  if (Array.isArray(req.body.sizes)) product.sizes = req.body.sizes;
  if (Array.isArray(req.body.images)) product.images = req.body.images;
  if (Array.isArray(req.body.images) && req.body.images.length < 4) {
    res.status(400);
    throw new Error('Minimum 4 product images are required');
  }

  if (req.body.category) {
    const categoryDoc = await Category.findById(req.body.category);
    if (!categoryDoc) {
      res.status(400);
      throw new Error('Invalid category');
    }
    product.category = req.body.category;
  }

  await product.save();
  const populated = await Product.findById(product._id).populate('category', 'name slug');
  res.json(populated);
});

exports.toggleProductLike = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const userId = String(req.user._id);
  const exists = product.likes.some((id) => String(id) === userId);
  if (exists) {
    product.likes = product.likes.filter((id) => String(id) !== userId);
  } else {
    product.likes.push(req.user._id);
  }
  await product.save();

  res.json({
    productId: product._id,
    likes: product.likes.length,
    liked: !exists
  });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  await Promise.all([
    Review.deleteMany({ product: product._id }),
    Cart.updateMany(
      { 'items.product': product._id },
      { $pull: { items: { product: product._id } } }
    ),
    User.updateMany(
      { wishlist: product._id },
      { $pull: { wishlist: product._id } }
    ),
    product.deleteOne()
  ]);

  res.json({ message: 'Product removed' });
});

exports.recalculateProductRating = async (productId) => {
  const reviews = await Review.find({ product: productId, isApproved: true });
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  const ratings = reviews.length ? total / reviews.length : 0;
  await Product.findByIdAndUpdate(productId, {
    ratings: Number(ratings.toFixed(1)),
    numReviews: reviews.length
  });
};

exports.getFilterMetadata = asyncHandler(async (req, res) => {
  const [brands, categories, sizes] = await Promise.all([
    Product.distinct('brand'),
    Category.find({ isActive: true }).select('name slug'),
    Product.distinct('sizes')
  ]);

  res.json({ brands, categories, sizes });
});

exports.getNewArrivals = asyncHandler(async (req, res) => {
  const products = await Product.find()
    .sort({ createdAt: -1 })
    .limit(12)
    .populate('category', 'name slug');
  res.json(products);
});

exports.searchSuggestions = asyncHandler(async (req, res) => {
  const q = req.query.q || '';
  if (!q.trim()) return res.json([]);

  const products = await Product.find({ name: { $regex: q, $options: 'i' } })
    .select('name')
    .limit(8);

  res.json(products.map((item) => item.name));
});

exports.getRelatedProducts = asyncHandler(async (req, res) => {
  const source = await Product.findById(req.params.id);
  if (!source) {
    res.status(404);
    throw new Error('Product not found');
  }
  const related = await Product.find({
    _id: { $ne: source._id },
    category: source.category
  })
    .limit(8)
    .populate('category', 'name slug');

  res.json(related);
});
