const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    location: { type: String, default: '' },
    refundDetails: {
      accountHolderName: { type: String, default: '' },
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      upiId: { type: String, default: '' }
    },
    wallet: {
      balance: { type: Number, default: 0 },
      entries: [
        {
          type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
          amount: { type: Number, required: true, min: 0 },
          note: { type: String, default: '' },
          orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
          expiresAt: { type: Date, default: null },
          createdAt: { type: Date, default: Date.now }
        }
      ]
    },
    role: { type: String, enum: ['user', 'admin', 'vendor'], default: 'user' },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    addressBook: [
      {
        fullName: String,
        mobile: String,
        addressLine: String,
        city: String,
        state: String,
        postalCode: String,
        country: { type: String, default: 'India' }
      }
    ]
    ,
    // In-app notifications for user (e.g., order status updates)
    notifications: [
      {
        type: { type: String, default: 'order' },
        title: { type: String, default: '' },
        message: { type: String, default: '' },
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    ,
    // Password reset token (for forgot/reset password flow)
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
