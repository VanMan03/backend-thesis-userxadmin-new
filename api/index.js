const { connectDB } = require('./src/db');
const app = require('./src/app');

// Only start server locally, not on Vercel
if (require.main === module) {
  connectDB().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  }).catch(err => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });
} else {
  // For Vercel serverless functions, export the app directly
  connectDB().catch(err => console.error('DB connection error:', err));
  module.exports = app;
}
