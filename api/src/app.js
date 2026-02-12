const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { connectDB } = require('./db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const itineraryRoutes = require('./routes/itineraryRoutes');
const interactionRoutes = require('./routes/userInteractionRoutes');
const destinationRoutes = require("./routes/destinationRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");

const app = express();

app.use(cors());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/itineraries', itineraryRoutes);
app.use('/api/interactions', interactionRoutes);
app.use("/api/destinations", destinationRoutes);
app.use("/api/recommendations", recommendationRoutes);
//route for testing
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

module.exports = app;
