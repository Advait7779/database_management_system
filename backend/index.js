require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Ensure uploads directory exists ──────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      // Allow localhost origins in development
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      // Allow any explicitly configured origin
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // In production, if FRONTEND_URL is not set, allow all (open) — log a warning
      if (!process.env.FRONTEND_URL && !process.env.CORS_ORIGIN) {
        console.warn(`[CORS] No FRONTEND_URL set — allowing origin: ${origin}`);
        return callback(null, true);
      }
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authLimiter, require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/search',   require('./routes/search'));
app.use('/api/download', require('./routes/download'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/comms',    require('./routes/comms'));
app.use('/api/reports',  require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const pool = require('./db/pool');
    await pool.query('SELECT 1');
    const env = {};
    for (const key in process.env) {
      if (key.match(/pass|secret|key|token/i)) {
        env[key] = '[REDACTED]';
      } else {
        env[key] = process.env[key];
      }
    }
    res.json({
      success: true,
      status: 'ok',
      database: 'connected',
      hostname: require('os').hostname(),
      env: env,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'error',
      database: 'disconnected',
      message: err.message,
    });
  }
});

// ── Note: Frontend is served as a separate service ───────────────────────────
// (No static file serving needed here)

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on 0.0.0.0:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔒 CORS origins: ${allowedOrigins.join(', ') || '(open)'}`);
  console.log(`📁 Uploads dir:  ${uploadsDir}\n`);
});

module.exports = app;
