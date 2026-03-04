require("dotenv").config();
const http = require("http");

const { connectDB } = require('./src/db');
const app = require('./src/app');
const { setupCollaborationWebSocket } = require("./src/services/collaborationRealtime");

// Only start server locally, not on Vercel
if (require.main === module) {
  connectDB().then(() => {
    const PORT = process.env.PORT || 3000;
    const server = http.createServer(app);
    setupCollaborationWebSocket(server);
    server.listen(PORT, () => console.log(`API running on port ${PORT}`));
  }).catch(err => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });
} else {
  // For serverless runtimes, db connection is awaited per request in app.js
  module.exports = app;
}
