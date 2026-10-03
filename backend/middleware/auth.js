const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const auth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    // Read current permissions for every request so a revoked switch takes effect
    // immediately, including for sessions with an existing JWT.
    const result = await pool.query(
      `SELECT id, username, role, allowed_pincode, allow_contact_access, status
       FROM users WHERE id = $1`,
      [decoded.id]
    );
    if (!result.rows[0]?.status) {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    console.error('Authentication error:', err);
    return res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

module.exports = auth;
