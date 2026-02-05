const { connectDB } = require('./src/db');
const app = require('./src/app');

connectDB();

module.exports = app;