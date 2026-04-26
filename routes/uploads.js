const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/role');
const { uploadImages, uploadAvatar } = require('../controllers/uploadController');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename(req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});

const upload = multer({ storage });

const router = express.Router();
router.post('/', protect, adminOnly, upload.array('images', 6), uploadImages);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

module.exports = router;
