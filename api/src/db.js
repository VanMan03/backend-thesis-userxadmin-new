const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI; // ✅ FIXED NAME
  if (!uri) throw new Error('MONGODB_URI missing');

  await mongoose.connect(uri);
  isConnected = true;
  console.log('Mongo connected');
}

module.exports = { connectDB };
