const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// ── GET /api/reports/dashboard ────────────────────────────────────────────────
router.get('/dashboard', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    let cWhere = '';
    let cTodayWhere = 'WHERE DATE(created_at) = $1';
    let cPinWhere = "WHERE pincode IS NOT NULL AND pincode <> ''";
    const cParams = [];
    const cTodayParams = [today];
    const cPinParams = [];

    if (req.user && req.user.role === 'staff' && req.user.allowed_pincode) {
      const pins = req.user.allowed_pincode.split(',').map(p => p.trim()).filter(Boolean);
      if (pins.length === 1) {
        cWhere = 'WHERE pincode = $1';
        cParams.push(pins[0]);
        cTodayWhere += ' AND pincode = $2';
        cTodayParams.push(pins[0]);
        cPinWhere += ' AND pincode = $1';
        cPinParams.push(pins[0]);
      } else if (pins.length > 1) {
        cWhere = 'WHERE pincode = ANY($1)';
        cParams.push(pins);
        cTodayWhere += ' AND pincode = ANY($2)';
        cTodayParams.push(pins);
        cPinWhere += ' AND pincode = ANY($1)';
        cPinParams.push(pins);
      }
    }

    const [
      totalContacts,
      todayContacts,
      smsSent,
      whatsappSent,
      voiceCalls,
      totalDownloads,
      activeUsers,
      totalPincodes,
      recentActivity,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS count FROM contacts ${cWhere}`, cParams),
      pool.query(`SELECT COUNT(*) AS count FROM contacts ${cTodayWhere}`, cTodayParams),
      pool.query(`SELECT COUNT(*) AS count FROM sms_logs WHERE status = 'sent'`),
      pool.query(`SELECT COUNT(*) AS count FROM whatsapp_logs WHERE status = 'sent'`),
      pool.query(`SELECT COUNT(*) AS count FROM voice_logs`),
      pool.query(`SELECT COUNT(*) AS count FROM download_logs`),
      pool.query(`SELECT COUNT(*) AS count FROM users WHERE status = true`),
      pool.query(`SELECT COUNT(DISTINCT pincode) AS count FROM contacts ${cPinWhere}`, cPinParams),
      pool.query(
        `SELECT al.action, al.description, al.created_at, u.username, u.full_name
         FROM activity_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC
         LIMIT 3`
      ),
    ]);

    return res.json({
      success: true,
      data: {
        total_contacts:   parseInt(totalContacts.rows[0].count),
        today_contacts:   parseInt(todayContacts.rows[0].count),
        sms_sent:         parseInt(smsSent.rows[0].count),
        whatsapp_sent:    parseInt(whatsappSent.rows[0].count),
        voice_calls:      parseInt(voiceCalls.rows[0].count),
        total_downloads:  parseInt(totalDownloads.rows[0].count),
        active_users:     parseInt(activeUsers.rows[0].count),
        total_pincodes:   parseInt(totalPincodes.rows[0].count),
        recent_activity:  recentActivity.rows,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/reports/contact-stats ────────────────────────────────────────────
// Aggregated contacts by state, city, and pincode for chart data
router.get('/contact-stats', auth, async (req, res) => {
  try {
    const [byState, byCity, byPincode, monthly, byGender] = await Promise.all([
      pool.query(
        `SELECT state, COUNT(*) AS count
         FROM contacts
         WHERE state IS NOT NULL AND state <> ''
         GROUP BY state
         ORDER BY count DESC
         LIMIT 20`
      ),
      pool.query(
        `SELECT city, state, COUNT(*) AS count
         FROM contacts
         WHERE city IS NOT NULL AND city <> ''
         GROUP BY city, state
         ORDER BY count DESC
         LIMIT 20`
      ),
      pool.query(
        `SELECT pincode, COUNT(*) AS count
         FROM contacts
         WHERE pincode IS NOT NULL AND pincode <> ''
         GROUP BY pincode
         ORDER BY count DESC
         LIMIT 20`
      ),
      pool.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
           COUNT(*) AS count
         FROM contacts
         WHERE created_at >= NOW() - INTERVAL '12 months'
         GROUP BY month
         ORDER BY month`
      ),
      pool.query(
        `SELECT gender, COUNT(*) AS count
         FROM contacts
         GROUP BY gender`
      ),
    ]);

    return res.json({
      success: true,
      data: {
        by_state:   byState.rows.map((r) => ({ state: r.state, count: parseInt(r.count) })),
        by_city:    byCity.rows.map((r)  => ({ city: r.city, state: r.state, count: parseInt(r.count) })),
        by_pincode: byPincode.rows.map((r) => ({ pincode: r.pincode, count: parseInt(r.count) })),
        monthly_growth: monthly.rows.map((r) => ({ month: r.month, count: parseInt(r.count) })),
        by_gender:  byGender.rows.map((r) => ({ gender: r.gender, count: parseInt(r.count) })),
      },
    });
  } catch (err) {
    console.error('Contact stats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/reports/sms-report ───────────────────────────────────────────────
router.get('/sms-report', auth, roleGuard(['super_admin', 'admin']), async (req, res) => {
  try {
    const { from, to } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (from) { conditions.push(`sl.created_at >= $${idx++}`); params.push(from); }
    if (to)   { conditions.push(`sl.created_at <= $${idx++}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countResult, summaryResult, detailResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM sms_logs sl ${where}`, params),
      pool.query(
        `SELECT status, COUNT(*) AS count
         FROM sms_logs sl ${where}
         GROUP BY status`,
        params
      ),
      pool.query(
        `SELECT sl.*, u.username AS sent_by_name
         FROM sms_logs sl
         LEFT JOIN users u ON sl.sent_by = u.id
         ${where}
         ORDER BY sl.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);

    return res.json({
      success: true,
      data: {
        summary: summaryResult.rows.reduce((acc, r) => {
          acc[r.status] = parseInt(r.count);
          return acc;
        }, {}),
        logs: detailResult.rows,
      },
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('SMS report error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/reports/activity ─────────────────────────────────────────────────
router.get('/activity', auth, roleGuard(['super_admin', 'admin']), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { user_id, action, from, to } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (user_id) { conditions.push(`al.user_id = $${idx++}`);        params.push(user_id); }
    if (action)  { conditions.push(`al.action ILIKE $${idx++}`);     params.push(`%${action}%`); }
    if (from)    { conditions.push(`al.created_at >= $${idx++}`);    params.push(from); }
    if (to)      { conditions.push(`al.created_at <= $${idx++}`);    params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM activity_logs al ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT al.*, u.username, u.full_name
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Activity log error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
