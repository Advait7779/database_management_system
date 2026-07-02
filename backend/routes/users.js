const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { logActivity } = require('../middleware/logger');

const ADMIN_ROLES = ['super_admin', 'admin'];

// ── GET /api/users/stats ──────────────────────────────────────────────────────
// Must be BEFORE /:id to avoid matching "stats" as an id
router.get('/stats', auth, roleGuard(ADMIN_ROLES), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT role, COUNT(*) AS count, SUM(CASE WHEN status THEN 1 ELSE 0 END) AS active
       FROM users
       GROUP BY role
       ORDER BY role`
    );

    const totalResult = await pool.query(`SELECT COUNT(*) FROM users`);

    return res.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].count),
        byRole: result.rows.map((r) => ({
          role:   r.role,
          total:  parseInt(r.count),
          active: parseInt(r.active),
        })),
      },
    });
  } catch (err) {
    console.error('User stats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', auth, roleGuard(ADMIN_ROLES), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const countResult = await pool.query(`SELECT COUNT(*) FROM users`);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT id, username, email, full_name, role, status, allowed_pincode, last_login, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
router.get('/:id', auth, roleGuard(ADMIN_ROLES), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, status, allowed_pincode, last_login, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post('/', auth, roleGuard(ADMIN_ROLES), async (req, res) => {
  try {
    const { username, email, password, full_name, role, allowed_pincode } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'username, email and password are required' });
    }

    const validRoles = ['super_admin', 'admin', 'staff', 'download_user', 'api_user'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Only super_admin can create another super_admin or admin
    if (['super_admin', 'admin'].includes(role) && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super_admin can create admin/super_admin users' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (username, email, password, full_name, role, allowed_pincode)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, full_name, role, status, allowed_pincode, created_at`,
      [username, email, hashedPassword, full_name || null, role || 'staff', allowed_pincode || null]
    );

    await logActivity(req, 'CREATE_USER', `Created user "${username}" with role "${role || 'staff'}"`);

    return res.status(201).json({ success: true, message: 'User created', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }
    console.error('Create user error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
router.put('/:id', auth, roleGuard(ADMIN_ROLES), async (req, res) => {
  try {
    const { full_name, email, role, status, allowed_pincode } = req.body;
    const targetId = parseInt(req.params.id);

    const existing = await pool.query(`SELECT * FROM users WHERE id = $1`, [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Only super_admin can modify other admins/super_admins
    if (
      ['super_admin', 'admin'].includes(existing.rows[0].role) &&
      req.user.role !== 'super_admin'
    ) {
      return res.status(403).json({ success: false, message: 'Only super_admin can modify admin accounts' });
    }

    const pincodeVal = allowed_pincode !== undefined ? (allowed_pincode || null) : existing.rows[0].allowed_pincode;

    const result = await pool.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           email     = COALESCE($2, email),
           role      = COALESCE($3, role),
           status    = COALESCE($4, status),
           allowed_pincode = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, username, email, full_name, role, status, allowed_pincode, updated_at`,
      [full_name, email, role, status, pincodeVal, targetId]
    );

    await logActivity(req, 'UPDATE_USER', `Updated user id=${targetId}`);

    return res.json({ success: true, message: 'User updated', data: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete('/:id', auth, roleGuard(ADMIN_ROLES), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);

    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const existing = await pool.query(`SELECT id, username, role FROM users WHERE id = $1`, [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (existing.rows[0].role === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Cannot delete a super_admin account' });
    }

    // Nullify references in dependent tables before deleting user to prevent foreign key errors
    await pool.query(`UPDATE contacts SET created_by = NULL WHERE created_by = $1`, [targetId]);
    await pool.query(`UPDATE activity_logs SET user_id = NULL WHERE user_id = $1`, [targetId]);
    await pool.query(`UPDATE download_logs SET user_id = NULL WHERE user_id = $1`, [targetId]);
    await pool.query(`UPDATE sms_logs SET created_by = NULL WHERE created_by = $1`, [targetId]).catch(() => {});
    await pool.query(`UPDATE whatsapp_logs SET created_by = NULL WHERE created_by = $1`, [targetId]).catch(() => {});
    await pool.query(`UPDATE voice_logs SET created_by = NULL WHERE created_by = $1`, [targetId]).catch(() => {});

    await pool.query(`DELETE FROM users WHERE id = $1`, [targetId]);

    await logActivity(req, 'DELETE_USER', `Deleted user "${existing.rows[0].username}" (id=${targetId})`);

    return res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

module.exports = router;
