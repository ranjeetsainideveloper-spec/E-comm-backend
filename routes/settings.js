const express = require('express');
const router = express.Router();
const storeSettingsController = require('../controllers/storeSettingsController');

router.get('/store', storeSettingsController.getPublicStoreSettings);

module.exports = router;
