const asyncHandler = require('express-async-handler');
const { getStoreSettings, normalizeDeliveryCharge, MAX_DELIVERY_CHARGE } = require('../utils/storeSettings');

exports.getPublicStoreSettings = asyncHandler(async (_req, res) => {
  const settings = await getStoreSettings();
  res.json({
    deliveryCharge: normalizeDeliveryCharge(settings.deliveryCharge)
  });
});

exports.getAdminStoreSettings = asyncHandler(async (_req, res) => {
  const settings = await getStoreSettings();
  res.json({
    deliveryCharge: normalizeDeliveryCharge(settings.deliveryCharge),
    updatedAt: settings.updatedAt
  });
});

exports.updateAdminStoreSettings = asyncHandler(async (req, res) => {
  const settings = await getStoreSettings();
  const nextDeliveryCharge = Number(req.body.deliveryCharge);

  if (Number.isNaN(nextDeliveryCharge) || nextDeliveryCharge < 0) {
    res.status(400);
    throw new Error('Delivery charge must be a valid non-negative number');
  }

  if (nextDeliveryCharge > MAX_DELIVERY_CHARGE) {
    res.status(400);
    throw new Error(`Delivery charge cannot be more than Rs.${MAX_DELIVERY_CHARGE}`);
  }

  settings.deliveryCharge = normalizeDeliveryCharge(nextDeliveryCharge);
  await settings.save();

  res.json({
    deliveryCharge: normalizeDeliveryCharge(settings.deliveryCharge),
    updatedAt: settings.updatedAt
  });
});
