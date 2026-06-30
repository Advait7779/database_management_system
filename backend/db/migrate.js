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
      ALTER TABLE contacts DROP COLUMN IF EXISTS alternate_mobile;
    `);
    console.log('✓ contacts alternate_mobile column dropped (if existed)');

    // ── Merge ladd column into address and drop it (if exists) ──────────────────
    const laddColCheck = await client.query(`
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name='contacts' AND column_name='ladd'
    `);
    if (laddColCheck.rows.length > 0) {
      console.log('Merging dynamic "ladd" column data into standard "address"...');
      await client.query(`
        UPDATE contacts 
        SET address = COALESCE(NULLIF(TRIM(address), ''), NULLIF(TRIM(ladd), ''))
        WHERE ladd IS NOT NULL AND ladd <> '';
      `);
      await client.query(`ALTER TABLE contacts DROP COLUMN ladd;`);
      console.log('✓ "ladd" column data merged and column dropped successfully');
    }

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

    // Delete duplicate contacts based on mobile, keeping the one with the lowest id (first created)
    console.log('Clearing duplicate contact numbers...');
    const delRes = await client.query(`
      DELETE FROM contacts a
      USING contacts b
      WHERE a.id > b.id AND a.mobile = b.mobile;
    `);
    console.log(`✓ cleared duplicates (removed ${delRes.rowCount || 0} rows)`);

    // Create unique index on mobile to enforce uniqueness in PostgreSQL
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_mobile_unique ON contacts(mobile);`);
    console.log('✓ unique mobile index ready');

    // Enable pg_trgm extension for trigram search (used to index ILIKE queries)
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // GIN Trigram indexes for fast ILIKE '%term%' pattern matching
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm    ON contacts USING gin (name gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_mobile_trgm  ON contacts USING gin (mobile gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm   ON contacts USING gin (email gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_city_trgm    ON contacts USING gin (city gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_state_trgm   ON contacts USING gin (state gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_village_trgm ON contacts USING gin (village gin_trgm_ops);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_pincode_trgm ON contacts USING gin (pincode gin_trgm_ops);`);

    // Standard B-tree indexes for exact matching/sorting
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
