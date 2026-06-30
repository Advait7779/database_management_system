const pool = require('../db/pool');

async function run() {
  try {
    console.log('Adding gender column to contacts table...');
    await pool.query(`
      ALTER TABLE contacts 
      ADD COLUMN IF NOT EXISTS gender VARCHAR(10) DEFAULT 'male' 
      CHECK (gender IN ('male', 'female', 'other'))
    `);
    console.log('✓ Gender column added successfully.');
  } catch (err) {
    console.error('Error adding gender column:', err);
  } finally {
    pool.end();
  }
}

run();
