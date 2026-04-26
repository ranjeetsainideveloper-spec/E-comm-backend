const StoreSettings = require('../models/StoreSettings');

const MAX_DELIVERY_CHARGE = 50;

const DEFAULT_SETTINGS = {
  deliveryCharge: 50
};

const normalizeDeliveryCharge = (value) => {
  const amount = Number(value);
  if (Number.isNaN(amount) || amount < 0) return DEFAULT_SETTINGS.deliveryCharge;
  return Math.min(MAX_DELIVERY_CHARGE, Math.round(amount));
};

const getStoreSettings = async () => {
  let settings = await StoreSettings.findOne();
  if (!settings) {
    settings = await StoreSettings.create(DEFAULT_SETTINGS);
  } else {
    const normalized = normalizeDeliveryCharge(settings.deliveryCharge);
    if (Number(settings.deliveryCharge) !== normalized) {
      settings.deliveryCharge = normalized;
      await settings.save();
    }
  }
  return settings;
};

const getDeliveryCharge = async () => {
  const settings = await getStoreSettings();
  return normalizeDeliveryCharge(settings.deliveryCharge);
};

module.exports = {
  DEFAULT_SETTINGS,
  MAX_DELIVERY_CHARGE,
  getStoreSettings,
  getDeliveryCharge,
  normalizeDeliveryCharge
};
