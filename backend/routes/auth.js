const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { logActivity } = require('../middleware/logger');

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    // Accept login by username OR email
    const result = await pool.query(
      `SELECT * FROM users WHERE (username = $1 OR email = $1) AND status = true`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last_login
    await pool.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, allowed_pincode: user.allowed_pincode },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Log activity (req.user not set yet so we fake it)
    req.user = { id: user.id };
    await logActivity(req, 'LOGIN', `User "${user.username}" logged in`);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          phone: user.phone,
          designation: user.designation,
          allowed_pincode: user.allowed_pincode,
          last_login: user.last_login,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', auth, async (req, res) => {
  try {
    await logActivity(req, 'LOGOUT', `User "${req.user.username}" logged out`);
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, status, last_login, created_at, phone, designation, allowed_pincode
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PUT /api/auth/me/profile ──────────────────────────────────────────────────
router.put('/me/profile', auth, async (req, res) => {
  try {
    const { full_name, email, phone, designation } = req.body;
    
    // Check if email already exists for another user
    const checkEmail = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, req.user.id]
    );
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email address is already in use' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET full_name = $1, email = $2, phone = $3, designation = $4, updated_at = NOW() 
       WHERE id = $5 
       RETURNING id, username, email, full_name, role, phone, designation, last_login, created_at`,
      [full_name, email, phone, designation, req.user.id]
    );

    await logActivity(req, 'edit_profile', `Updated personal profile details`);

    return res.json({ success: true, message: 'Profile updated successfully', data: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PUT /api/auth/me/password ─────────────────────────────────────────────────
router.put('/me/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }

    const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, req.user.id]);

    await logActivity(req, 'change_password', `Updated account password`);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/auth/me/sessions ────────────────────────────────────────────────
router.get('/me/sessions', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT action, description, ip_address, created_at 
       FROM activity_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [req.user.id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get sessions error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
