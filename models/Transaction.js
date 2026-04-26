const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    
    // Razorpay payment details
    razorpayOrderId: {
      type: String,
      required: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      index: true,
      default: null
    },
    razorpaySignature: {
      type: String,
      default: null
    },
    
    // Payment details
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'netbanking', 'upi', 'wallet', 'emi'],
      default: null
    },
    
    // Payment status
    status: {
      type: String,
      enum: ['initiated', 'pending', 'captured', 'authorized', 'failed', 'refunded'],
      default: 'initiated'
    },
    
    // Razorpay response
    razorpayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    
    // Error tracking
    failureReason: {
      type: String,
      default: null
    },
    failureCode: {
      type: String,
      default: null
    },
    
    // Refund details
    refunded: {
      type: Boolean,
      default: false
    },
    refundId: {
      type: String,
      default: null
    },
    refundAmount: {
      type: Number,
      default: null
    },
    refundReason: {
      type: String,
      default: null
    },
    
    // Timestamps
    initiatedAt: {
      type: Date,
      default: Date.now
    },
    capturedAt: {
      type: Date,
      default: null
    },
    failedAt: {
      type: Date,
      default: null
    },
    refundedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for quick lookups
TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ order: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ razorpayOrderId: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
