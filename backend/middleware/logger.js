const pool = require('../db/pool');

/**
 * Log an activity to the activity_logs table.
 * @param {object} req   - Express request (for ip_address + user_id)
 * @param {string} action      - Short action label e.g. 'CREATE_CONTACT'
 * @param {string} description - Human-readable description
 */
const logActivity = async (req, action, description) => {
  try {
    const userId = req.user ? req.user.id : null;
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      null;

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, description, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [userId, action, description, ip]
    );
  } catch (err) {
    // Never let logging errors crash a request
    console.error('Activity log error:', err.message);
  }
};

module.exports = { logActivity };
