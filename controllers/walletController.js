const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { creditWallet, debitWallet, syncWalletBalance } = require('../utils/wallet');

// @desc    Get user wallet balance and transaction history
// @route   GET /api/wallet
// @access  Private
const getWallet = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('wallet');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Sync wallet balance to ensure expired credits are handled
  await syncWalletBalance(user);

  res.json({
    balance: user.wallet.balance,
    entries: user.wallet.entries
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50) // Return last 50 transactions
  });
});

// @desc    Get wallet transaction history with pagination
// @route   GET /api/wallet/history
// @access  Private
const getWalletHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const user = await User.findById(req.user._id).select('wallet');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Sync wallet balance first
  await syncWalletBalance(user);

  const entries = user.wallet.entries
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(skip, skip + limit);

  const totalEntries = user.wallet.entries.length;

  res.json({
    balance: user.wallet.balance,
    entries,
    pagination: {
      page,
      limit,
      total: totalEntries,
      pages: Math.ceil(totalEntries / limit)
    }
  });
});

const creditWalletAdmin = asyncHandler(async (req, res) => {
  const { userId, amount, note } = req.body;

  if (!userId || !amount) {
    res.status(400);
    throw new Error('User ID and amount are required');
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  await creditWallet(user, {
    amount: Number(amount),
    note: note || 'Manual wallet credit by admin'
  });

  res.json({
    message: 'Wallet credited successfully',
    wallet: user.wallet
  });
});

// @desc    Debit wallet (admin only - for manual adjustments)
// @route   POST /api/wallet/debit
// @access  Private/Admin
const debitWalletAdmin = asyncHandler(async (req, res) => {
  const { userId, amount, note } = req.body;

  if (!userId || !amount) {
    res.status(400);
    throw new Error('User ID and amount are required');
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  await debitWallet(user, {
    amount: Number(amount),
    note: note || 'Manual wallet debit by admin'
  });

  res.json({
    message: 'Wallet debited successfully',
    wallet: user.wallet
  });
});

// @desc    Get wallet statistics (admin only)
// @route   GET /api/wallet/stats
// @access  Private/Admin
const getWalletStats = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('wallet name email');

  let totalBalance = 0;
  let totalCredits = 0;
  let totalDebits = 0;
  let activeWallets = 0;

  users.forEach(user => {
    if (user.wallet && user.wallet.balance > 0) {
      activeWallets++;
      totalBalance += user.wallet.balance;

      user.wallet.entries.forEach(entry => {
        if (entry.type === 'CREDIT') {
          totalCredits += entry.amount;
        } else if (entry.type === 'DEBIT') {
          totalDebits += entry.amount;
        }
      });
    }
  });

  res.json({
    totalBalance: Math.round(totalBalance),
    totalCredits: Math.round(totalCredits),
    totalDebits: Math.round(totalDebits),
    activeWallets,
    totalUsers: users.length
  });
});

module.exports = {
  getWallet,
  getWalletHistory,
  creditWalletAdmin,
  debitWalletAdmin,
  getWalletStats
};