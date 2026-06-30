const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { logActivity } = require('../middleware/logger');

const DOWNLOAD_ROLES = ['super_admin', 'admin', 'download_user'];

// ── Helper: build filter WHERE clause ────────────────────────────────────────
function buildFilterWhere(filters) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.gender && ['male', 'female', 'other'].includes(filters.gender)) {
    conditions.push(`gender = $${idx++}`);
    params.push(filters.gender);
  }

  if (filters.q) {
    conditions.push(`(name ILIKE $${idx} OR mobile ILIKE $${idx} OR city ILIKE $${idx} OR state ILIKE $${idx} OR village ILIKE $${idx} OR pincode ILIKE $${idx} OR address ILIKE $${idx})`);
    params.push(`%${filters.q}%`);
    idx++;
  } else {
    const add = (col, val, partial = true) => {
      if (val) {
        if (partial) {
          conditions.push(`${col} ILIKE $${idx++}`);
          params.push(`%${val}%`);
        } else {
          conditions.push(`${col} = $${idx++}`);
          params.push(val);
        }
      }
    };

    add('name',    filters.name);
    add('mobile',  filters.mobile);
    add('address', filters.address);
    add('city',    filters.city);
    add('state',   filters.state);
    add('village', filters.village);
    add('pincode', filters.pincode, false); // exact match
    add('email',   filters.email);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// ── Helper: mask mobile numbers to xxxxx ──────────────────────────────────────
const maskMobile = (mobile) => {
  if (!mobile) return '';
  const str = String(mobile).trim();
  if (str.length <= 5) return str;
  return str.slice(0, -5) + 'xxxxx';
};

// ── Helper: log download ──────────────────────────────────────────────────────
async function logDownload(req, fileType, filters, recordCount) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    null;

  await pool.query(
    `INSERT INTO download_logs (user_id, file_type, filters_applied, record_count, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [req.user.id, fileType, JSON.stringify(filters), recordCount, ip]
  );

  await logActivity(req, 'DOWNLOAD', `Downloaded ${recordCount} contacts as ${fileType.toUpperCase()}`);
}

// ── GET /api/download/excel ───────────────────────────────────────────────────
router.get('/excel', auth, roleGuard(DOWNLOAD_ROLES), async (req, res) => {
  try {
    const { where, params } = buildFilterWhere(req.query);
    const result = await pool.query(
      `SELECT id, name, mobile, alternate_mobile, address, city, state, village,
              pincode, email, notes, created_at
       FROM contacts ${where}
       ORDER BY name`,
      params
    );

    const contacts = result.rows;
    await logDownload(req, 'xlsx', req.query, contacts.length);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WebDB System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Contacts');

    // Column definitions with auto widths
    sheet.columns = [
      { header: 'ID',               key: 'id',               width: 8  },
      { header: 'Name',             key: 'name',             width: 28 },
      { header: 'Mobile',           key: 'mobile',           width: 16 },
      { header: 'Address',          key: 'address',          width: 35 },
      { header: 'City',             key: 'city',             width: 18 },
      { header: 'State',            key: 'state',            width: 18 },
      { header: 'Village',          key: 'village',          width: 18 },
      { header: 'Pincode',          key: 'pincode',          width: 12 },
      { header: 'Email',            key: 'email',            width: 28 },
    ];

    // Style header row — bold, blue background, white font
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }, // Tailwind blue-800
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
      };
    });
    headerRow.height = 22;

    // Add data rows
    contacts.forEach((c, i) => {
      const row = sheet.addRow({
        id:               c.id,
        name:             c.name,
        mobile:           maskMobile(c.mobile),
        address:          c.address         || '',
        city:             c.city            || '',
        state:            c.state           || '',
        village:          c.village         || '',
        pincode:          c.pincode         || '',
        email:            c.email           || '',
      });

      // Alternating row colour
      if (i % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F9FF' }, // very light blue
          };
        });
      }
    });

    // Auto-filter on header row
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: sheet.columns.length },
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="contacts_${Date.now()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel download error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate Excel file' });
  }
});

// ── GET /api/download/csv ─────────────────────────────────────────────────────
router.get('/csv', auth, roleGuard(DOWNLOAD_ROLES), async (req, res) => {
  try {
    const { where, params } = buildFilterWhere(req.query);
    const result = await pool.query(
      `SELECT id, name, mobile, alternate_mobile, address, city, state, village,
              pincode, email, notes, created_at
       FROM contacts ${where}
       ORDER BY name`,
      params
    );

    const contacts = result.rows;
    await logDownload(req, 'csv', req.query, contacts.length);

    const headers = [
      'ID', 'Name', 'Mobile', 'Address',
      'City', 'State', 'Village', 'Pincode', 'Email',
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = contacts.map((c) => [
      c.id,
      c.name,
      maskMobile(c.mobile),
      c.address          || '',
      c.city             || '',
      c.state            || '',
      c.village          || '',
      c.pincode          || '',
      c.email            || '',
    ].map(escapeCSV).join(','));

    const csv = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="contacts_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error('CSV download error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate CSV file' });
  }
});

// ── GET /api/download/logs ────────────────────────────────────────────────────
// Admins see all; regular download_users see only their own
router.get('/logs', auth, roleGuard(DOWNLOAD_ROLES), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);

    const whereClause = isAdmin ? '' : `WHERE dl.user_id = $3`;
    const countParams = isAdmin ? [] : [req.user.id];
    const countWhere  = isAdmin ? '' : `WHERE dl.user_id = $1`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM download_logs dl ${countWhere}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = isAdmin ? [limit, offset] : [limit, offset, req.user.id];

    const result = await pool.query(
      `SELECT dl.*, u.username, u.full_name
       FROM download_logs dl
       LEFT JOIN users u ON dl.user_id = u.id
       ${whereClause}
       ORDER BY dl.download_time DESC
       LIMIT $1 OFFSET $2`,
      dataParams
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Download logs error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
