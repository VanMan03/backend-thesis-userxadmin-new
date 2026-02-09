const mongoose = require('mongoose');

let isConnected = false;
let connectPromise = null;

async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  if (connectPromise) return connectPromise;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI missing');

  connectPromise = mongoose.connect(uri)
    .then(() => {
      isConnected = true;
      console.log('Mongo connected');
    })
    .catch((err) => {
      connectPromise = null;
      throw err;
    });

  return connectPromise;
}

module.exports = { connectDB };
