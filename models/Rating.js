const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rating', ratingSchema);
