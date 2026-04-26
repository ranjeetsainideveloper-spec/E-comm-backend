const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Requires admin role' });
    return;
  }
  next();
};

module.exports = { adminOnly };
