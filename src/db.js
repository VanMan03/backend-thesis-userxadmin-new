const mongoose = require('mongoose');

async function connectDB() {
const uri = process.env.MONGO_URI;
if (!uri) throw new Error('MONGO_URI missing');
await mongoose.connect(uri);
console.log('Mongo connected');
}

module.exports = { connectDB };