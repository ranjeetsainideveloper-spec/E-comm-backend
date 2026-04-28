const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productKeyId: { type: String, default: '' },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    quantity: { type: Number, default: 1, min: 1 },
    size: { type: String, default: '' },
    price: { type: Number, required: true }
  },
  { _id: false }
);

const returnMessageSchema = new mongoose.Schema(
  {
    sender: {
      role: { type: String, enum: ['customer', 'admin'], required: true },
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, default: '' }
    },
    text: { type: String, default: '' },
    attachments: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    products: [orderItemSchema],
    itemsAmount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    shippingAddress: {
      fullName: String,
      mobile: String,
      addressLine: String,
      city: String,
      state: String,
      postalCode: String,
      country: { type: String, default: 'India' }
    },
    // Removed 'SCANNER' payment method — payments should be handled via Razorpay or Wallet/COD.
    paymentMethod: { type: String, enum: ['COD', 'RAZORPAY', 'WALLET'], default: 'COD' },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' },
    paymentDetails: {
      gateway: { type: String, default: '' },
      merchantOrderId: { type: String, default: '' },
      txnId: { type: String, default: '' },
      bankTxnId: { type: String, default: '' },
      gatewayName: { type: String, default: '' },
      callbackPayload: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    orderStatus: {
      type: String,
      enum: ['PLACED', 'PACKED', 'CONFIRMED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED'],
      default: 'PLACED'
    },
    returnRequest: {
      requestedAt: Date,
      reason: { type: String, default: '' },
      type: {
        type: String,
        enum: ['RETURN', 'REPLACE', 'OTHER'],
        default: 'RETURN'
      },
      status: {
        type: String,
        enum: ['NONE', 'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'REFUNDED_TO_WALLET'],
        default: 'NONE'
      },
      refundedAt: Date
    },
    returnMessages: [returnMessageSchema],
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    paidAt: Date,
    deliveredAt: Date
    ,
    // Whether the customer has submitted a rating for this order
    rated: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
