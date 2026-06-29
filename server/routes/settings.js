const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { logActivity } = require('../middleware/logger');

// Role middleware helper
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
  }
  next();
};

// ── GET /api/settings ─────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settingsMap = {};
    result.rows.forEach(row => {
      settingsMap[row.key] = row.value;
    });
    return res.json({ success: true, data: settingsMap });
  } catch (err) {
    console.error('Fetch settings error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PUT /api/settings ─────────────────────────────────────────────────────────
router.put('/', auth, requireAdmin, async (req, res) => {
  try {
    const settings = req.body; // e.g. { app_name: 'WebDatabase', pagination_size: '50' }
    
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value`,
        [key, String(value)]
      );
    }

    await logActivity(req, 'update_settings', `Updated global system settings`);

    return res.json({ success: true, message: 'System settings updated successfully' });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
