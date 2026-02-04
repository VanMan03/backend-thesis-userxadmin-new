const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./db');

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
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/itineraries', itineraryRoutes);
app.use('/api/interactions', interactionRoutes);
app.use("/api/destinations", destinationRoutes);
app.use("/api/recommendations", recommendationRoutes);


//route for testing
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
connectDB().then(() => app.listen(PORT, () => console.log(`API running on port
${PORT}`)));