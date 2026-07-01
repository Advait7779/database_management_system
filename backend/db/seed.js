const pool = require('./pool');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Starting database seeding (clean/roles-only)...');
  try {
    // 1. Get or create a super_admin user
    let userRes = await pool.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
    let userId;
    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
    } else {
      const hashedPw = await bcrypt.hash('Admin@123', 10);
      const newUser = await pool.query(
        "INSERT INTO users (username, email, password, role, full_name) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        ['admin', 'admin@webdb.com', hashedPw, 'super_admin', 'Super Administrator']
      );
      userId = newUser.rows[0].id;
      console.log('✓ Default super_admin created');
    }

    // 2. Insert read-only viewer user if it doesn't exist
    const viewerCheck = await pool.query("SELECT id FROM users WHERE username = 'viewer'");
    if (viewerCheck.rows.length === 0) {
      const hashedPw = await bcrypt.hash('Viewer@123', 10);
      await pool.query(
        "INSERT INTO users (username, email, password, role, full_name, designation) VALUES ($1, $2, $3, $4, $5, $6)",
        ['viewer', 'viewer@webdb.com', hashedPw, 'staff', 'Read-Only Viewer', 'Data Viewer']
      );
      console.log('✓ Viewer user created');
    }

    // 3. Clear existing contacts and logs for a completely clean db state
    await pool.query("DELETE FROM contacts");
    await pool.query("DELETE FROM sms_logs");
    await pool.query("DELETE FROM whatsapp_logs");
    await pool.query("DELETE FROM voice_logs");
    await pool.query("DELETE FROM download_logs");
    await pool.query("DELETE FROM activity_logs");
    
    console.log('✓ Database cleared of all dummy contacts and logs successfully');
    console.log('🎉 Seeding completed successfully!');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    pool.end();
  }
}

seed();
