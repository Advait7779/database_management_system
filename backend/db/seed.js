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

    // 2. Insert dummy users for other roles if they don't exist
    const rolesToCreate = [
      { username: 'staff', email: 'staff@webdb.com', role: 'staff', name: 'Staff User' },
      { username: 'downloader', email: 'download@webdb.com', role: 'download_user', name: 'Download Manager' },
      { username: 'apiuser', email: 'api@webdb.com', role: 'api_user', name: 'API Integrator' },
      { username: 'adminuser', email: 'adminuser@webdb.com', role: 'admin', name: 'Admin Manager' }
    ];

    for (const r of rolesToCreate) {
      const check = await pool.query("SELECT id FROM users WHERE username = $1", [r.username]);
      if (check.rows.length === 0) {
        const hashedPw = await bcrypt.hash('User@123', 10);
        await pool.query(
          "INSERT INTO users (username, email, password, role, full_name) VALUES ($1, $2, $3, $4, $5)",
          [r.username, r.email, hashedPw, r.role, r.name]
        );
        console.log(`✓ User role created: ${r.username}`);
      }
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
