require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const { helmetConfig, apiRateLimiter } = require('./config/security');
const pool = require('./db/pool');
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const filesRoutes = require('./routes/files');

const app = express();
app.set('trust proxy', 1);

app.use(helmetConfig());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new pgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'replace_me_long_random',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000,
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use('/api', apiRateLimiter);

app.use(express.static(path.join(process.cwd(), 'public')));

// API routes
app.use('/api', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/uploads', filesRoutes);

// 404 for API
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: { message: 'Endpoint not found.' } });
});

// Fallback to index (or auth page). Keep simple:
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});