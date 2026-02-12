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

const corsOptions = {
  origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

const app = express();
const isProd = process.env.NODE_ENV === "production";
const defaultAllowedOrigins = ["https://bulusan-wanderer.vercel.app"];
const envAllowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);
const localhostPattern = /^http:\/\/localhost:\d+$/;

const corsOptions = {
  origin: (origin, cb) => {
    const isLocalhost = !!origin && localhostPattern.test(origin);
    if (
      !origin ||
      allowedOrigins.has(origin) ||
      (!isProd && isLocalhost)
    ) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true,
};

app.use(express.json());
app.use(morgan('dev'));
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed:', err);
    res.status(500).json({ message: 'Database unavailable' });
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

module.exports = app;
