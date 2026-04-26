const asyncHandler = require('express-async-handler');

exports.uploadImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const urls = files.map((file) => `/uploads/${file.filename}`);
  res.status(201).json({ urls });
});

exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Avatar file is required');
  }

  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});
