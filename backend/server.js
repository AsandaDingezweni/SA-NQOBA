require('node:dns/promises').setServers(['1.1.1.1', '8.8.8.8']);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');

// 1. Load environment variables from the .env file
dotenv.config();

// 2. Initialize Express app
const app = express();

// 3. Middleware
app.use(cors()); // Allows the frontend to talk to the backend
app.use(express.json()); // Allows the backend to read JSON data from requests
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// 4. Connect to MongoDB Atlas (The Cloud Database)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas (SA-NQOBA Database)'))
  .catch((err) => console.error('MongoDB connection error:', err));

// 5. A simple test route to check if the server is running
app.get('/', (req, res) => {
  res.send('SA-NQOBA API is running perfectly!');
});

// 6. Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`SA-NQOBA Server is running on http://localhost:${PORT}`);
});