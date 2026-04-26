require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');

const categoriesData = [
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Beauty', slug: 'beauty' },
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Footwear', slug: 'footwear' }
];

const seed = async () => {
  await connectDB();

  await Promise.all([User.deleteMany(), Category.deleteMany(), Product.deleteMany()]);

  const admin = await User.create({
    name: 'Admin',
    email: 'admin@example.com',
    password: 'Admin@123',
    role: 'admin'
  });

  const categories = await Category.insertMany(categoriesData);
  const fashion = categories.find((c) => c.slug === 'fashion');
  const beauty = categories.find((c) => c.slug === 'beauty');
  const electronics = categories.find((c) => c.slug === 'electronics');

  await Product.insertMany([
    {
      name: 'Women Printed Kurti',
      description: 'Lightweight cotton kurti for daily wear.',
      price: 899,
      discount: 20,
      category: fashion._id,
      brand: 'Trendz',
      sizes: ['S', 'M', 'L', 'XL'],
      stock: 40,
      ratings: 4.3,
      numReviews: 0,
      images: [
        'https://images.unsplash.com/photo-1583391733956-6c78276477e2?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1612423284934-2850a4ea6b0f?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80'
      ],
      thumbnail: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?auto=format&fit=crop&w=900&q=80',
      isFeatured: true
    },
    {
      name: 'Vitamin C Face Serum',
      description: 'Skin brightening hydrating serum.',
      price: 599,
      discount: 10,
      category: beauty._id,
      brand: 'GlowUp',
      sizes: ['100ml'],
      stock: 80,
      ratings: 4.1,
      numReviews: 0,
      images: [
        'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1607602132700-0682583f0b0f?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80'
      ],
      thumbnail: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=900&q=80',
      isFeatured: true
    },
    {
      name: 'Bluetooth Earbuds',
      description: 'High bass earbuds with low latency gaming mode.',
      price: 1499,
      discount: 25,
      category: electronics._id,
      brand: 'SoundFox',
      sizes: [],
      stock: 55,
      ratings: 4.5,
      numReviews: 0,
      images: [
        'https://images.unsplash.com/photo-1577174881658-0f30ed549adc?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?auto=format&fit=crop&w=900&q=80'
      ],
      thumbnail: 'https://images.unsplash.com/photo-1577174881658-0f30ed549adc?auto=format&fit=crop&w=900&q=80',
      isFeatured: true
    }
  ]);

  console.log('Seed complete');
  console.log('Admin credentials: admin@example.com / Admin@123');
  console.log(`Admin user id: ${admin._id}`);
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
