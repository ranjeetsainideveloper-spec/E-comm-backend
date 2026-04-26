const FOUR_MONTHS_IN_DAYS = 120;

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const normalizeWallet = (user) => {
  const entries = Array.isArray(user.wallet?.entries) ? user.wallet.entries : [];
  const now = new Date();

  const normalizedEntries = entries.map((entry) => {
    const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
    const isExpired = entry.type === 'CREDIT' && expiresAt && expiresAt < now;
    return {
      ...entry.toObject?.() || entry,
      expiresAt,
      isExpired
    };
  });

  const balance = normalizedEntries.reduce((sum, entry) => {
    if (entry.type === 'CREDIT') {
      return entry.isExpired ? sum : sum + Number(entry.amount || 0);
    }
    return sum - Number(entry.amount || 0);
  }, 0);

  user.wallet = {
    balance: Math.max(0, Number(balance.toFixed(2))),
    entries: normalizedEntries.map(({ isExpired, ...entry }) => entry)
  };

  return user.wallet;
};

const syncWalletBalance = async (user) => {
  normalizeWallet(user);
  await user.save();
  return user.wallet;
};

const creditWallet = async (user, { amount, note = '', orderId = null }) => {
  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Wallet credit amount must be greater than zero');
  }

  user.wallet.entries.push({
    type: 'CREDIT',
    amount: numericAmount,
    note,
    orderId,
    expiresAt: addMonths(new Date(), 4)
  });

  return syncWalletBalance(user);
};

const debitWallet = async (user, { amount, note = '', orderId = null }) => {
  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Wallet debit amount must be greater than zero');
  }

  const wallet = normalizeWallet(user);
  if (wallet.balance < numericAmount) {
    throw new Error('Insufficient Shopva wallet balance');
  }

  user.wallet.entries.push({
    type: 'DEBIT',
    amount: numericAmount,
    note,
    orderId
  });

  return syncWalletBalance(user);
};

module.exports = {
  FOUR_MONTHS_IN_DAYS,
  normalizeWallet,
  syncWalletBalance,
  creditWallet,
  debitWallet
};
