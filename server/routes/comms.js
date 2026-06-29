const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const COMM_ROLES = ['super_admin', 'admin', 'staff'];

// ── Helper: paginate ──────────────────────────────────────────────────────────
function paginate(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

// ── POST /api/comms/sms ───────────────────────────────────────────────────────
router.post('/sms', auth, roleGuard(COMM_ROLES), async (req, res) => {
  try {
    const { mobiles, message, type } = req.body;

    if (!mobiles || !Array.isArray(mobiles) || mobiles.length === 0) {
      return res.status(400).json({ success: false, message: '"mobiles" must be a non-empty array' });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: '"message" is required' });
    }

    const results = [];

    for (const mobile of mobiles) {
      // TODO: Replace with actual SMS API call (MSG91 / Fast2SMS)
      // Example for MSG91:
      // const response = await axios.post('https://api.msg91.com/api/v2/sendsms', {
      //   sender: process.env.SMS_SENDER_ID,
      //   route: type === 'transactional' ? '4' : '1',
      //   country: '91',
      //   sms: [{ message, to: [mobile] }]
      // }, { headers: { authkey: process.env.SMS_API_KEY } });

      console.log(`[SMS SIMULATION] To: ${mobile} | Type: ${type || 'promotional'} | Message: ${message}`);

      // Log to DB
      const logResult = await pool.query(
        `INSERT INTO sms_logs (sent_by, mobile, message, status, api_response)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [req.user.id, mobile, message, 'sent', JSON.stringify({ simulated: true, type })]
      );

      results.push({ mobile, log_id: logResult.rows[0].id, status: 'sent' });
    }

    return res.json({
      success: true,
      message: `SMS sent to ${mobiles.length} number(s)`,
      data: results,
    });
  } catch (err) {
    console.error('SMS send error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send SMS' });
  }
});

// ── POST /api/comms/whatsapp ──────────────────────────────────────────────────
router.post('/whatsapp', auth, roleGuard(COMM_ROLES), async (req, res) => {
  try {
    const { mobiles, message_type, message, media_url } = req.body;

    if (!mobiles || !Array.isArray(mobiles) || mobiles.length === 0) {
      return res.status(400).json({ success: false, message: '"mobiles" must be a non-empty array' });
    }

    const results = [];

    for (const mobile of mobiles) {
      // TODO: Replace with actual WhatsApp Business API call
      // Example (360dialog / Twilio / Meta Business API):
      // await axios.post(`${process.env.WHATSAPP_API_URL}/messages`, {
      //   messaging_product: 'whatsapp',
      //   to: mobile,
      //   type: message_type,
      //   text: message_type === 'text' ? { body: message } : undefined,
      //   image: message_type === 'image' ? { link: media_url } : undefined,
      // }, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}` } });

      console.log(`[WHATSAPP SIMULATION] To: ${mobile} | Type: ${message_type} | Message: ${message} | Media: ${media_url || 'none'}`);

      const logResult = await pool.query(
        `INSERT INTO whatsapp_logs (sent_by, mobile, message_type, message, media_url, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [req.user.id, mobile, message_type || 'text', message, media_url || null, 'sent']
      );

      results.push({ mobile, log_id: logResult.rows[0].id, status: 'sent' });
    }

    return res.json({
      success: true,
      message: `WhatsApp message sent to ${mobiles.length} number(s)`,
      data: results,
    });
  } catch (err) {
    console.error('WhatsApp send error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send WhatsApp message' });
  }
});

// ── POST /api/comms/voice ─────────────────────────────────────────────────────
router.post('/voice', auth, roleGuard(COMM_ROLES), async (req, res) => {
  try {
    const { mobiles, call_type } = req.body;

    if (!mobiles || !Array.isArray(mobiles) || mobiles.length === 0) {
      return res.status(400).json({ success: false, message: '"mobiles" must be a non-empty array' });
    }

    const results = [];

    for (const mobile of mobiles) {
      // TODO: Replace with actual Voice API call (Exotel / Twilio / Ozonetel)
      // Example (Twilio):
      // const call = await twilioClient.calls.create({
      //   url: 'http://your-twiml-url.com/voice',
      //   to: `+91${mobile}`,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      // });

      console.log(`[VOICE SIMULATION] To: ${mobile} | Call Type: ${call_type || 'automated'}`);

      const logResult = await pool.query(
        `INSERT INTO voice_logs (initiated_by, mobile, call_type, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [req.user.id, mobile, call_type || 'automated', 'sent']
      );

      results.push({ mobile, log_id: logResult.rows[0].id, status: 'initiated' });
    }

    return res.json({
      success: true,
      message: `Voice call initiated to ${mobiles.length} number(s)`,
      data: results,
    });
  } catch (err) {
    console.error('Voice call error:', err);
    return res.status(500).json({ success: false, message: 'Failed to initiate voice call' });
  }
});

// ── GET /api/comms/sms-logs ───────────────────────────────────────────────────
router.get('/sms-logs', auth, roleGuard(COMM_ROLES), async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { mobile, status, from, to } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (mobile) { conditions.push(`sl.mobile ILIKE $${idx++}`); params.push(`%${mobile}%`); }
    if (status) { conditions.push(`sl.status = $${idx++}`);     params.push(status); }
    if (from)   { conditions.push(`sl.created_at >= $${idx++}`); params.push(from); }
    if (to)     { conditions.push(`sl.created_at <= $${idx++}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM sms_logs sl ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT sl.*, u.username AS sent_by_name
       FROM sms_logs sl
       LEFT JOIN users u ON sl.sent_by = u.id
       ${where}
       ORDER BY sl.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('SMS logs error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/comms/whatsapp-logs ──────────────────────────────────────────────
router.get('/whatsapp-logs', auth, roleGuard(COMM_ROLES), async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { mobile, status } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (mobile) { conditions.push(`wl.mobile ILIKE $${idx++}`); params.push(`%${mobile}%`); }
    if (status) { conditions.push(`wl.status = $${idx++}`);     params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM whatsapp_logs wl ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT wl.*, u.username AS sent_by_name
       FROM whatsapp_logs wl
       LEFT JOIN users u ON wl.sent_by = u.id
       ${where}
       ORDER BY wl.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('WhatsApp logs error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
