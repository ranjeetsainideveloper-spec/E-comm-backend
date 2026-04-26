const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/role');

router.route('/').get(protect, walletController.getWallet);
router.route('/history').get(protect, walletController.getWalletHistory);
router.route('/credit').post(protect, adminOnly, walletController.creditWalletAdmin);
router.route('/debit').post(protect, adminOnly, walletController.debitWalletAdmin);
router.route('/stats').get(protect, adminOnly, walletController.getWalletStats);

module.exports = router;