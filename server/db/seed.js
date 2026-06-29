const pool = require('./pool');
const bcrypt = require('bcryptjs');

const dummyContacts = [
  // Bangalore, Karnataka (PIN: 560001)
  { name: 'Aditya Sharma', mobile: '9876543210', alt: '9876543211', email: 'aditya@example.com', gender: 'male', address: '12, MG Road', city: 'Bangalore', state: 'Karnataka', village: 'HSR Layout', pin: '560001', notes: 'Voter card verified' },
  { name: 'Priya Patel', mobile: '9123456780', alt: null, email: 'priya@example.com', gender: 'female', address: '45, Indiranagar', city: 'Bangalore', state: 'Karnataka', village: 'Domlur', pin: '560001', notes: 'Booth volunteer' },
  { name: 'Rohan Das', mobile: '9812345678', alt: '9812345679', email: 'rohan@example.com', gender: 'male', address: '78, Koramangala', city: 'Bangalore', state: 'Karnataka', village: 'Ejipura', pin: '560001', notes: 'First-time voter' },
  { name: 'Ananya Rao', mobile: '9988776655', alt: null, email: 'ananya@example.com', gender: 'female', address: '90, Whitefield', city: 'Bangalore', state: 'Karnataka', village: 'Varthur', pin: '560066', notes: 'Verified voter' },
  
  // Mumbai, Maharashtra (PIN: 400001)
  { name: 'Vikram Mehta', mobile: '9001234567', alt: '9001234568', email: 'vikram@example.com', gender: 'male', address: '101, Nariman Point', city: 'Mumbai', state: 'Maharashtra', village: 'Colaba', pin: '400001', notes: 'Voter card verified' },
  { name: 'Neha Kulkarni', mobile: '9223344556', alt: null, email: 'neha@example.com', gender: 'female', address: '202, Bandra West', city: 'Mumbai', state: 'Maharashtra', village: 'Khar', pin: '400050', notes: 'Voter profile complete' },
  { name: 'Siddharth Shah', mobile: '9334455667', alt: null, email: 'siddharth@example.com', gender: 'male', address: '303, Andheri East', city: 'Mumbai', state: 'Maharashtra', village: 'Marol', pin: '400059', notes: 'Voter card verified' },
  
  // Delhi (PIN: 110001)
  { name: 'Rajesh Kumar', mobile: '9871234567', alt: '9871234568', email: 'rajesh@example.com', gender: 'male', address: '15, Connaught Place', city: 'New Delhi', state: 'Delhi', village: 'Janpath', pin: '110001', notes: 'Local community representative' },
  { name: 'Aarav Gupta', mobile: '9560123456', alt: null, email: 'aarav@example.com', gender: 'male', address: '88, Okhla Phase 3', city: 'New Delhi', state: 'Delhi', village: 'Okhla', pin: '110020', notes: 'First-time voter' },
  { name: 'Meera Sen', mobile: '9650123456', alt: null, email: 'meera@example.com', gender: 'female', address: '12, Dwarka Sector 10', city: 'New Delhi', state: 'Delhi', village: 'Dwarka', pin: '110075', notes: 'Verified voter' },

  // Pune, Maharashtra (PIN: 411001)
  { name: 'Amit Joshi', mobile: '9763001122', alt: '9763001123', email: 'amit@example.com', gender: 'male', address: '55, Shivaji Nagar', city: 'Pune', state: 'Maharashtra', village: 'Bhamburda', pin: '411005', notes: 'Booth volunteer' },
  { name: 'Snehal Patil', mobile: '9822003344', alt: null, email: 'snehal@example.com', gender: 'female', address: '44, Hinjewadi Phase 1', city: 'Pune', state: 'Maharashtra', village: 'Maan', pin: '411057', notes: 'Verified voter' },

  // Chennai, Tamil Nadu (PIN: 600001)
  { name: 'Karthik Subramanian', mobile: '9444012345', alt: null, email: 'karthik@example.com', gender: 'male', address: '77, T-Nagar', city: 'Chennai', state: 'Tamil Nadu', village: 'Mambalam', pin: '600017', notes: 'Voter card verified' },
  { name: 'Divya Ramakrishnan', mobile: '9444556677', alt: '9444556678', email: 'divya@example.com', gender: 'female', address: '109, Adyar', city: 'Chennai', state: 'Tamil Nadu', village: 'Gandhinagar', pin: '600020', notes: 'Voter profile complete' },

  // Hyderabad, Telangana (PIN: 500001)
  { name: 'Srinivas Rao', mobile: '9908012345', alt: null, email: 'srinivas@example.com', gender: 'male', address: '301, Gachibowli', city: 'Hyderabad', state: 'Telangana', village: 'Serilingampally', pin: '500032', notes: 'Booth representative' },
  { name: 'Kavitha Reddy', mobile: '9989012345', alt: '9989012346', email: 'kavitha@example.com', gender: 'female', address: '502, Jubilee Hills', city: 'Hyderabad', state: 'Telangana', village: 'Yousufguda', pin: '500033', notes: 'Voter profile complete' },
];

async function seed() {
  console.log('🌱 Starting database seeding with gender profiles...');
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
        console.log(`✓ Dummy user created: ${r.username} (Password: User@123)`);
      }
    }

    // 3. Clear existing contacts to avoid bloat
    await pool.query("DELETE FROM contacts");
    console.log('✓ Existing contacts cleared');

    // 4. Insert dummy contacts
    for (const c of dummyContacts) {
      await pool.query(
        `INSERT INTO contacts (name, mobile, alternate_mobile, email, gender, address, city, state, village, pincode, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [c.name, c.mobile, c.alt, c.email, c.gender, c.address, c.city, c.state, c.village, c.pin, c.notes, userId]
      );
    }
    console.log(`✓ Inserted ${dummyContacts.length} dummy contacts successfully`);

    // 5. Seed some logs to show stats
    await pool.query("DELETE FROM sms_logs");
    await pool.query("DELETE FROM download_logs");
    await pool.query("DELETE FROM activity_logs");

    // Insert SMS Logs
    await pool.query("INSERT INTO sms_logs (sent_by, mobile, message, status) VALUES ($1, $2, $3, $4)", [userId, '9876543210', 'Welcome to our service', 'sent']);
    await pool.query("INSERT INTO sms_logs (sent_by, mobile, message, status) VALUES ($1, $2, $3, $4)", [userId, '9123456780', 'Your OTP is 4821', 'sent']);
    await pool.query("INSERT INTO sms_logs (sent_by, mobile, message, status) VALUES ($1, $2, $3, $4)", [userId, '9001234567', 'Bulk promotional campaign', 'sent']);

    // Insert Download Logs
    await pool.query("INSERT INTO download_logs (user_id, file_type, filters_applied, record_count, ip_address) VALUES ($1, $2, $3, $4, $5)", [userId, 'excel', JSON.stringify({ pincode: '560001' }), 3, '127.0.0.1']);
    await pool.query("INSERT INTO download_logs (user_id, file_type, filters_applied, record_count, ip_address) VALUES ($1, $2, $3, $4, $5)", [userId, 'csv', null, 16, '127.0.0.1']);

    // Insert Activity Logs
    await pool.query("INSERT INTO activity_logs (user_id, action, description, ip_address) VALUES ($1, $2, $3, $4)", [userId, 'login', 'User logged in successfully', '127.0.0.1']);
    await pool.query("INSERT INTO activity_logs (user_id, action, description, ip_address) VALUES ($1, $2, $3, $4)", [userId, 'add_contact', 'Added contact Rajesh Kumar', '127.0.0.1']);
    await pool.query("INSERT INTO activity_logs (user_id, action, description, ip_address) VALUES ($1, $2, $3, $4)", [userId, 'download', 'Exported 3 contacts matching PIN 560001', '127.0.0.1']);

    console.log('✓ Mock activity, sms, and download logs seeded');
    console.log('🎉 Seeding completed successfully!');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    pool.end();
  }
}

seed();
