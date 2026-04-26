const mongoose = require('mongoose');

const storeSettingsSchema = new mongoose.Schema(
  {
    deliveryCharge: { type: Number, default: 50, min: 0, max: 50 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
