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

// Trust proxy headers (required behind Caddy/nginx reverse proxy)
// Fixes ERR_ERL_UNEXPECTED_X_FORWARDED_FOR from express-rate-limit
app.set('trust proxy', 1);

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

// ── Auto-migrate & seed on startup ────────────────────────────────────────────
async function initDatabase() {
  const pool = require('./db/pool');
  const bcrypt = require('bcryptjs');

  try {
    console.log('⏳ Running auto-migration...');
    const client = await pool.connect();

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'staff'
          CHECK (role IN ('super_admin','admin','staff','download_user','api_user')),
        status BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100) DEFAULT 'User';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        village VARCHAR(100),
        pincode VARCHAR(100),
        email VARCHAR(255),
        gender VARCHAR(50) DEFAULT 'male',
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`CREATE TABLE IF NOT EXISTS sms_logs (
      id SERIAL PRIMARY KEY, sent_by INTEGER REFERENCES users(id),
      mobile VARCHAR(20) NOT NULL, message TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending', api_response TEXT, created_at TIMESTAMP DEFAULT NOW()
    );`);

    await client.query(`CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id SERIAL PRIMARY KEY, sent_by INTEGER REFERENCES users(id),
      mobile VARCHAR(20) NOT NULL, message_type VARCHAR(50), message TEXT,
      media_url TEXT, status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW()
    );`);

    await client.query(`CREATE TABLE IF NOT EXISTS voice_logs (
      id SERIAL PRIMARY KEY, initiated_by INTEGER REFERENCES users(id),
      mobile VARCHAR(20) NOT NULL, call_type VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW()
    );`);

    await client.query(`CREATE TABLE IF NOT EXISTS download_logs (
      id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id),
      file_type VARCHAR(20), filters_applied JSONB, record_count INTEGER,
      ip_address VARCHAR(50), download_time TIMESTAMP DEFAULT NOW()
    );`);

    await client.query(`CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id),
      action VARCHAR(100) NOT NULL, description TEXT,
      ip_address VARCHAR(50), created_at TIMESTAMP DEFAULT NOW()
    );`);

    // Indexes
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_mobile_unique ON contacts(mobile);`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON contacts USING gin (name gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_mobile_trgm ON contacts USING gin (mobile gin_trgm_ops);`);

    // Default settings
    const defaults = [
      ['app_name','WebDatabase'],['pagination_size','20'],['allow_registration','false'],['maintenance_mode','false']
    ];
    for (const [k,v] of defaults) {
      await client.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING;`, [k, v]);
    }

    // Remove old admin user if exists
    await client.query(`DELETE FROM users WHERE username = 'admin'`);

    // Create admin user if not exists
    const existing = await client.query(`SELECT id FROM users WHERE username = 'admindb7779@gmail.com'`);
    if (existing.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin@7779', 12);
      await client.query(
        `INSERT INTO users (username, email, password, full_name, role) VALUES ($1, $2, $3, $4, $5)`,
        ['admindb7779@gmail.com', 'admindb7779@gmail.com', hashedPassword, 'Super Administrator', 'super_admin']
      );
      console.log('✅ Default admin created (username: admindb7779@gmail.com)');
    } else {
      console.log('✅ Admin user already exists');
    }

    client.release();
    console.log('✅ Database ready!\n');
  } catch (err) {
    console.error('⚠️ Migration warning (server will still start):', err.message);
  }
}

// ── Start Server ──────────────────────────────────────────────────────────────
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on 0.0.0.0:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔒 CORS origins: ${allowedOrigins.join(', ') || '(open)'}`);
    console.log(`📁 Uploads dir:  ${uploadsDir}\n`);
  });
});

module.exports = app;

