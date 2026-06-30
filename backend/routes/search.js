const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// ── Helper: build dynamic WHERE clause ───────────────────────────────────────
function buildContactsWhere(filters) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.gender && ['male', 'female', 'other'].includes(filters.gender)) {
    conditions.push(`gender = $${idx}`);
    params.push(filters.gender);
    idx++;
  }

  if (filters.q) {
    conditions.push(`(name ILIKE $${idx} OR mobile ILIKE $${idx} OR city ILIKE $${idx} OR state ILIKE $${idx} OR village ILIKE $${idx} OR pincode ILIKE $${idx} OR address ILIKE $${idx})`);
    params.push(`%${filters.q}%`);
    idx++;
  } else {
    const add = (col, val, partial = true) => {
      if (val) {
        if (partial) {
          conditions.push(`${col} ILIKE $${idx}`);
          params.push(`%${val}%`);
        } else {
          conditions.push(`${col} = $${idx}`);
          params.push(val);
        }
        idx++;
      }
    };

    add('name',    filters.name);
    add('mobile',  filters.mobile);
    add('address', filters.address);
    add('city',    filters.city);
    add('state',   filters.state);
    add('village', filters.village);
    add('pincode', filters.pincode, false); // exact match for pincode
    add('email',   filters.email);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params, idx };
}

// ── GET /api/search ───────────────────────────────────────────────────────────
// Smart search by any combination of fields, paginated
router.get('/', auth, async (req, res) => {
  try {
    const { q, name, mobile, address, city, state, village, pincode, email, gender } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { where, params, idx } = buildContactsWhere({
      q, name, mobile, address, city, state, village, pincode, email, gender,
    });

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM contacts ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limit, offset];

    const result = await pool.query(
      `SELECT * FROM contacts ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      dataParams
    );

    const colsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'`
    );
    const columns = colsResult.rows.map(r => r.column_name);

    return res.json({
      success: true,
      data: result.rows,
      columns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/search/pincode/:pin ──────────────────────────────────────────────
// All contacts for a specific pincode + summary
router.get('/pincode/:pin', auth, async (req, res) => {
  try {
    const { pin } = req.params;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;

    const [contactsResult, summaryResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM contacts WHERE pincode = $1 ORDER BY name LIMIT $2 OFFSET $3`,
        [pin, limit, offset]
      ),
      pool.query(
        `SELECT city, state, COUNT(*) AS count
         FROM contacts
         WHERE pincode = $1
         GROUP BY city, state
         ORDER BY count DESC`,
        [pin]
      ),
      pool.query(`SELECT COUNT(*) FROM contacts WHERE pincode = $1`, [pin]),
    ]);

    const total = parseInt(countResult.rows[0].count);

    const colsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'`
    );
    const columns = colsResult.rows.map(r => r.column_name);

    return res.json({
      success: true,
      data: {
        contacts: contactsResult.rows,
        columns,
        summary: {
          pincode: pin,
          total_contacts: total,
          cities: summaryResult.rows.map((r) => ({
            city: r.city,
            state: r.state,
            count: parseInt(r.count),
          })),
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error('Pincode search error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/search/pincode-stats ─────────────────────────────────────────────
// All pincodes with their contact counts (for summary/map views)
router.get('/pincode-stats', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         pincode,
         COUNT(*)           AS total_contacts,
         COUNT(DISTINCT city)  AS city_count,
         COUNT(DISTINCT state) AS state_count,
         ARRAY_AGG(DISTINCT city  ORDER BY city)  FILTER (WHERE city  IS NOT NULL) AS cities,
         ARRAY_AGG(DISTINCT state ORDER BY state) FILTER (WHERE state IS NOT NULL) AS states
       FROM contacts
       WHERE pincode IS NOT NULL AND pincode <> ''
       GROUP BY pincode
       ORDER BY total_contacts DESC`
    );

    return res.json({
      success: true,
      data: result.rows.map((r) => ({
        pincode:        r.pincode,
        total_contacts: parseInt(r.total_contacts),
        city_count:     parseInt(r.city_count),
        state_count:    parseInt(r.state_count),
        cities:         r.cities || [],
        states:         r.states || [],
      })),
    });
  } catch (err) {
    console.error('Pincode stats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/search/suggestions ───────────────────────────────────────────────
// Auto-suggest as user types (top 5 matching names or mobiles)
router.get('/suggestions', auth, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const result = await pool.query(
      `SELECT id, name, mobile, city, state, pincode
       FROM contacts
       WHERE name ILIKE $1 OR mobile ILIKE $1
       ORDER BY name
       LIMIT 5`,
      [`%${q}%`]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Suggestions error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
