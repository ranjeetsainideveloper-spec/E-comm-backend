const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('express-async-handler');
const { normalizeWallet, syncWalletBalance } = require('../utils/wallet');
const crypto = require('crypto');

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('name, email and password are required');
  }

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({ name, email, password });
  normalizeWallet(user);
  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    location: user.location,
    refundDetails: user.refundDetails,
    wallet: user.wallet,
    role: user.role,
    token: generateToken(user)
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  await syncWalletBalance(user);
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    location: user.location,
    refundDetails: user.refundDetails,
    wallet: user.wallet,
    role: user.role,
    token: generateToken(user)
  });
});

exports.getProfile = asyncHandler(async (req, res) => {
  await syncWalletBalance(req.user);
  res.json(req.user);
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.name = req.body.name || user.name;
  user.phone = req.body.phone || user.phone;
  user.avatar = req.body.avatar || user.avatar;
  user.location = req.body.location ?? user.location;
  if (req.body.refundDetails) {
    user.refundDetails = {
      ...(user.refundDetails || {}),
      ...req.body.refundDetails
    };
  }
  if (req.body.password) {
    user.password = req.body.password;
  }

  await user.save();
  await syncWalletBalance(user);
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatar: user.avatar,
    location: user.location,
    refundDetails: user.refundDetails,
    wallet: user.wallet
  });
});

exports.logout = asyncHandler(async (req, res) => {
  res.json({ message: 'Logout success - delete token on client' });
});

// POST /api/auth/forgot-password
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error('Email required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    // respond success to avoid user enumeration
    return res.json({ message: 'If an account exists, a reset link will be sent (see server console for demo).' });
  }

  const token = crypto.randomBytes(20).toString('hex');
  const expires = Date.now() + 1000 * 60 * 60; // 1 hour

  user.resetPasswordToken = token;
  user.resetPasswordExpires = expires;
  await user.save();

  const resetLink = `${process.env.ADMIN_URL || 'http://localhost:5174'}/reset-password?token=${token}`;
  // For demo: print reset link to server console (or send via email in production)
  console.log('Password reset link (demo):', resetLink);

  res.json({ message: 'If an account exists, a reset link will be sent (see server console for demo).' });
});

// POST /api/auth/reset-password
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400);
    throw new Error('token and password required');
  }

  const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
  if (!user) {
    res.status(400);
    throw new Error('Invalid or expired token');
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ message: 'Password reset successful' });
});
