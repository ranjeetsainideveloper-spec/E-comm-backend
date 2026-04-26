const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    productKeyId: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0, min: 0, max: 90 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, default: 'Generic' },
    sizes: [{ type: String }],
    stock: { type: Number, default: 0, min: 0 },
    ratings: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    images: [{ type: String }],
    thumbnail: { type: String, default: '' },
    isFeatured: { type: Boolean, default: false },
    tags: [{ type: String }]
  },
  { timestamps: true }
);

productSchema.virtual('finalPrice').get(function finalPrice() {
  return Number((this.price - (this.price * this.discount) / 100).toFixed(2));
});

productSchema.set('toJSON', { virtuals: true });
productSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Product', productSchema);
