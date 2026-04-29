/**
 * Usage: node scripts/resetAdminPassword.js [email] [newPassword]
 * Defaults: email=admin@example.com, newPassword=Admin@123
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ecomm-pro';

const emailArg = process.argv[2] || process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
const newPassword = process.argv[3] || process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';

(async () => {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: emailArg });
    if (!user) {
      console.log(`No user found with email ${emailArg}. Creating new admin user.`);
      const created = await User.create({ name: 'Admin', email: emailArg, password: newPassword, role: 'admin' });
      console.log('Admin user created:', created.email);
      process.exit(0);
    }

    user.password = newPassword;
    if (user.role !== 'admin') user.role = 'admin';
    await user.save();

    console.log(`Password for ${emailArg} updated to the provided value.`);
    console.log('Please change this password after login for security.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
