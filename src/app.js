require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const itineraryRoutes = require('./routes/itineraryRoutes');
const interactionRoutes = require('./routes/userInteractionRoutes');
const destinationRoutes = require("./routes/destinationRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");

const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

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
