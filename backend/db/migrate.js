require('dotenv').config();
const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting database migration...');

    // ── Create Tables ──────────────────────────────────────────────────────────

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
    console.log('✓ users table ready');

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100) DEFAULT 'User';
    `);
    console.log('✓ users table columns updated');

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    console.log('✓ settings table ready');

    const defaultSettings = [
      { key: 'app_name', value: 'WebDatabase' },
      { key: 'pagination_size', value: '20' },
      { key: 'allow_registration', value: 'false' },
      { key: 'maintenance_mode', value: 'false' },
      { key: 'smtp_host', value: 'smtp.mailtrap.io' },
      { key: 'smtp_port', value: '2525' }
    ];
    for (const s of defaultSettings) {
      await client.query(`
        INSERT INTO settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO NOTHING;
      `, [s.key, s.value]);
    }
    console.log('✓ default settings seeded');

    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        alternate_mobile VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        village VARCHAR(100),
        pincode VARCHAR(10),
        email VARCHAR(255),
        gender VARCHAR(10) DEFAULT 'male' CHECK (gender IN ('male','female','other')),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ contacts table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_logs (
        id SERIAL PRIMARY KEY,
        sent_by INTEGER REFERENCES users(id),
        mobile VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        api_response TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ sms_logs table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id SERIAL PRIMARY KEY,
        sent_by INTEGER REFERENCES users(id),
        mobile VARCHAR(20) NOT NULL,
        message_type VARCHAR(50),
        message TEXT,
        media_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ whatsapp_logs table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_logs (
        id SERIAL PRIMARY KEY,
        initiated_by INTEGER REFERENCES users(id),
        mobile VARCHAR(20) NOT NULL,
        call_type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ voice_logs table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS download_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        file_type VARCHAR(20),
        filters_applied JSONB,
        record_count INTEGER,
        ip_address VARCHAR(50),
        download_time TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ download_logs table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        description TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ activity_logs table ready');

    // ── Indexes ────────────────────────────────────────────────────────────────

    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_pincode  ON contacts(pincode);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_city     ON contacts(city);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_state    ON contacts(state);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_village  ON contacts(village);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_mobile   ON contacts(mobile);`);
    console.log('✓ indexes ready');

    // ── Default Super-Admin ────────────────────────────────────────────────────

    const existing = await client.query(
      `SELECT id FROM users WHERE username = 'admin'`
    );

    if (existing.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin@123', 12);
      await client.query(
        `INSERT INTO users (username, email, password, full_name, role)
         VALUES ($1, $2, $3, $4, $5)`,
        ['admin', 'admin@webdb.com', hashedPassword, 'Super Administrator', 'super_admin']
      );
      console.log('✓ Default super_admin created  (username: admin / password: Admin@123)');
    } else {
      console.log('✓ Default super_admin already exists, skipping');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
