const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { logActivity } = require('../middleware/logger');

// ── Multer setup for CSV/Excel uploads ───────────────────────────────────────
const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
});

// ── GET /api/contacts ─────────────────────────────────────────────────────────
// Paginated list with optional search
router.get('/', auth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const q = req.query.q || '';
    const gender = req.query.gender || '';

    const conditions = [];
    const params = [];
    let idx = 1;

    if (q) {
      conditions.push(`(c.name ILIKE $${idx} OR c.mobile ILIKE $${idx} OR c.city ILIKE $${idx} OR c.state ILIKE $${idx} OR c.pincode ILIKE $${idx} OR c.village ILIKE $${idx} OR c.email ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    if (gender && ['male', 'female', 'other'].includes(gender)) {
      conditions.push(`c.gender = $${idx}`);
      params.push(gender);
      idx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM contacts c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, limit, offset];
    const limitIdx  = idx;
    const offsetIdx = idx + 1;

    const result = await pool.query(
      `SELECT c.*, u.username AS created_by_name
       FROM contacts c
       LEFT JOIN users u ON c.created_by = u.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
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
    console.error('List contacts error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── GET /api/contacts/:id ─────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username AS created_by_name
       FROM contacts c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Get contact error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /api/contacts ────────────────────────────────────────────────────────
router.post('/', auth, roleGuard(['super_admin', 'admin', 'staff']), async (req, res) => {
  try {
    const {
      name, mobile, address, city, state,
      village, pincode, email, gender, notes,
    } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ success: false, message: 'Name and mobile are required' });
    }

    const result = await pool.query(
      `INSERT INTO contacts
         (name, mobile, address, city, state, village, pincode, email, gender, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [name, mobile, address, city, state, village, pincode, email, gender || 'male', notes, req.user.id]
    );

    await logActivity(req, 'CREATE_CONTACT', `Created contact "${name}" (${mobile})`);

    return res.status(201).json({ success: true, message: 'Contact created', data: result.rows[0] });
  } catch (err) {
    console.error('Create contact error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PUT /api/contacts/:id ─────────────────────────────────────────────────────
router.put('/:id', auth, roleGuard(['super_admin', 'admin', 'staff']), async (req, res) => {
  try {
    const {
      name, mobile, address, city, state,
      village, pincode, email, gender, notes,
    } = req.body;

    const existing = await pool.query(`SELECT id FROM contacts WHERE id = $1`, [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    const result = await pool.query(
      `UPDATE contacts SET
         name=$1, mobile=$2, address=$3, city=$4,
         state=$5, village=$6, pincode=$7, email=$8, gender=$9,
         notes=$10, updated_at=NOW()
       WHERE id=$11
       RETURNING *`,
      [name, mobile, address, city, state, village, pincode, email, gender || 'male', notes, req.params.id]
    );

    await logActivity(req, 'UPDATE_CONTACT', `Updated contact id=${req.params.id} "${name}"`);

    return res.json({ success: true, message: 'Contact updated', data: result.rows[0] });
  } catch (err) {
    console.error('Update contact error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── DELETE /api/contacts/:id ──────────────────────────────────────────────────
router.delete('/:id', auth, roleGuard(['super_admin', 'admin']), async (req, res) => {
  try {
    const existing = await pool.query(`SELECT id, name FROM contacts WHERE id = $1`, [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await pool.query(`DELETE FROM contacts WHERE id = $1`, [req.params.id]);

    await logActivity(req, 'DELETE_CONTACT', `Deleted contact id=${req.params.id} "${existing.rows[0].name}"`);

    return res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    console.error('Delete contact error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── POST /api/contacts/import ─────────────────────────────────────────────────
router.post(
  '/import',
  auth,
  roleGuard(['super_admin', 'admin']),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filePath = req.file.path;

    try {
      const contacts = [];

      if (ext === '.csv') {
        // Parse CSV
        await new Promise((resolve, reject) => {
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
              // Normalise column names (lowercase, trim)
              const normalised = {};
              for (const key of Object.keys(row)) {
                normalised[key.toLowerCase().trim()] = row[key];
              }
              contacts.push(normalised);
            })
            .on('end', resolve)
            .on('error', reject);
        });
      } else {
        // Excel — use exceljs
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];
        const headers = [];
        worksheet.getRow(1).eachCell((cell) => {
          headers.push(cell.value ? String(cell.value).toLowerCase().trim() : '');
        });
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const obj = {};
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            obj[headers[colNumber - 1]] = cell.value || '';
          });
          contacts.push(obj);
        });
      }

      if (contacts.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ success: false, message: 'File is empty or has no valid rows' });
      }

      // 1. Normalize fields & clean Postgres NULL strings
      for (const row of contacts) {
        // Extract names
        const nameVal = row['name'] || row['full_name'] || row['fullname'] || row['cname'] || row['fname'] || row['first_name'] || row['contact_name'] || '';
        row['name'] = (nameVal === '\\N') ? '' : String(nameVal).trim();

        // Extract mobile
        const mobileVal = row['mobile'] || row['phone'] || row['contact'] || row['mobile_number'] || row['number'] || row['mob'] || row['cell'] || row['contact_no'] || row['phone_number'] || '';
        row['mobile'] = (mobileVal === '\\N') ? '' : String(mobileVal).trim();

        if (row['mobile'] && row['mobile'].toUpperCase().includes('E')) {
          const num = Number(row['mobile']);
          if (!isNaN(num)) row['mobile'] = String(num);
        }

        // Extract address
        const addrParts = [];
        const baseAddr = row['address'] || row['ladd'] || row['local_address'] || row['full_address'] || row['addr'] || '';
        if (baseAddr && baseAddr !== '\\N' && String(baseAddr).trim() !== '') addrParts.push(String(baseAddr).trim());
        if (row['add1'] && row['add1'] !== '\\N' && String(row['add1']).trim() !== '') addrParts.push(String(row['add1']).trim());
        if (row['add2'] && row['add2'] !== '\\N' && String(row['add2']).trim() !== '') addrParts.push(String(row['add2']).trim());
        if (row['add3'] && row['add3'] !== '\\N' && String(row['add3']).trim() !== '') addrParts.push(String(row['add3']).trim());
        row['address'] = addrParts.join(', ').trim();

        // Extract pincode
        const pinVal = row['pincode'] || row['pin'] || row['zip'] || row['zipcode'] || row['postal_code'] || '';
        row['pincode'] = (pinVal === '\\N') ? '' : String(pinVal).trim();

        // Extract city
        const cityVal = row['city'] || row['city_name'] || row['district'] || '';
        row['city'] = (cityVal === '\\N') ? '' : String(cityVal).trim();

        // Extract state
        const stateVal = row['state'] || row['state_name'] || row['region'] || '';
        row['state'] = (stateVal === '\\N') ? '' : String(stateVal).trim();

        // Extract village
        const villageVal = row['village'] || row['location'] || row['area'] || row['town'] || '';
        row['village'] = (villageVal === '\\N') ? '' : String(villageVal).trim();

        // Extract email
        const emailVal = row['email'] || row['email_address'] || row['mail'] || '';
        row['email'] = (emailVal === '\\N') ? '' : String(emailVal).trim();

        // Delete all synonyms from the row object to prevent creating duplicate dynamic columns
        const synonyms = [
          'full_name', 'fullname', 'cname', 'fname', 'first_name', 'contact_name',
          'phone', 'contact', 'mobile_number', 'number', 'mob', 'cell', 'contact_no', 'phone_number',
          'ladd', 'local_address', 'full_address', 'addr', 'add1', 'add2', 'add3',
          'pin', 'zip', 'zipcode', 'postal_code',
          'city_name', 'district',
          'state_name', 'region',
          'location', 'area', 'town',
          'email_address', 'mail'
        ];
        for (const key of synonyms) {
          delete row[key];
        }
      }

      // 2. Query existing columns in the database contacts table
      const existingColsRes = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'`
      );
      const existingCols = new Set(existingColsRes.rows.map(r => r.column_name.toLowerCase()));

      // 3. Scan unique headers from file and dynamically add missing columns
      const fileHeaders = new Set();
      for (const row of contacts) {
        for (const key of Object.keys(row)) {
          if (key) fileHeaders.add(key);
        }
      }

      for (const header of fileHeaders) {
        // Sanitize header to lowercase letters, digits, and underscores
        let sanitized = header.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        if (/^[0-9]/.test(sanitized)) {
          sanitized = '_' + sanitized;
        }
        const colName = sanitized.slice(0, 60);

        if (colName && !existingCols.has(colName)) {
          console.log(`Adding dynamic column: ${colName}`);
          await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "${colName}" TEXT`);
          existingCols.add(colName);
        }
      }

      // 4. Create active database columns list mapping original file keys
      const activeInsertCols = [];
      for (const header of fileHeaders) {
        let sanitized = header.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        if (/^[0-9]/.test(sanitized)) {
          sanitized = '_' + sanitized;
        }
        const colName = sanitized.slice(0, 60);

        if (existingCols.has(colName) && colName !== 'id' && colName !== 'created_at' && colName !== 'updated_at' && colName !== 'created_by') {
          activeInsertCols.push({ original: header, dbName: colName });
        }
      }

      // Ensure that 'name' and 'mobile' exist in the dynamic inserts mapping
      if (!activeInsertCols.some(c => c.dbName === 'name') && existingCols.has('name')) {
        activeInsertCols.push({ original: 'name', dbName: 'name' });
      }
      if (!activeInsertCols.some(c => c.dbName === 'mobile') && existingCols.has('mobile')) {
        activeInsertCols.push({ original: 'mobile', dbName: 'mobile' });
      }

      // 5. Bulk insert chunk loop
      let inserted = 0;
      let skipped = 0;
      const chunkSize = 500;

      for (let i = 0; i < contacts.length; i += chunkSize) {
        const chunk = contacts.slice(i, i + chunkSize);
        const valueRows = [];
        const params = [];
        let paramIdx = 1;

        for (const row of chunk) {
          if (!row['name'] || !row['mobile']) { skipped++; continue; }

          const rowValues = [];
          for (const col of activeInsertCols) {
            let val = row[col.original];
            if (val === undefined || val === null || String(val).trim() === '\\N' || String(val).trim() === '') {
              val = null;
            } else {
              val = String(val).trim();
            }
            rowValues.push(`$${paramIdx++}`);
            params.push(val);
          }
          // Append created_by parameter
          rowValues.push(`$${paramIdx++}`);
          params.push(req.user.id);

          valueRows.push(`(${rowValues.join(', ')})`);
          inserted++;
        }

        if (valueRows.length > 0) {
          const colNames = activeInsertCols.map(c => `"${c.dbName}"`).concat('created_by');
          const query = `
            INSERT INTO contacts (${colNames.join(', ')})
            VALUES ${valueRows.join(', ')}
            ON CONFLICT (mobile) DO NOTHING
          `;
          await pool.query(query, params);
        }
      }

      fs.unlinkSync(filePath);

      await logActivity(
        req,
        'IMPORT_CONTACTS',
        `Imported ${inserted} contacts (${skipped} skipped) from "${req.file.originalname}"`
      );

      return res.json({
        success: true,
        message: `Import complete: ${inserted} inserted, ${skipped} skipped`,
        data: { inserted, skipped, total: contacts.length },
      });
    } catch (err) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      console.error('Import error:', err);
      return res.status(500).json({ success: false, message: `Import failed: ${err.message}` });
    }
  }
);

module.exports = router;
