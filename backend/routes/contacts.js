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

function toTitleCase(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/(?:^|\s|-|\/)\S/g, m => m.toUpperCase());
}

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

// Helper for fuzzy column header matching during CSV/Excel import
function findValue(row, exactKeys, partialRegex) {
  for (const k of exactKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return { val: row[k], matchedKey: k };
    }
  }
  if (partialRegex) {
    for (const key of Object.keys(row)) {
      if (partialRegex.test(key) && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return { val: row[key], matchedKey: key };
      }
    }
  }
  return { val: '', matchedKey: null };
}

// Helper to query only columns that contain at least one non-empty value in the database
async function getActiveColumns(pool) {
  const colsRes = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'`
  );
  const allCols = colsRes.rows.map(r => r.column_name);

  const stdCols = new Set([
    'id', 'name', 'gender', 'mobile', 'address', 'city', 'state', 'village', 'pincode', 'email', 'notes',
    'created_by', 'created_at', 'updated_at'
  ]);

  const isSrNoCol = (name) => {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return ['srno', 'sno', 'slno', 'seq', 'seqno', 'serialno', 'sr'].includes(n) || n.includes('srno');
  };

  const dynamicCols = allCols.filter(col => !stdCols.has(col) && !isSrNoCol(col));
  if (dynamicCols.length === 0) {
    return allCols.filter(col => stdCols.has(col));
  }

  // Check if each dynamic column has any non-empty value
  const selectParts = dynamicCols.map(col => 
    `EXISTS(SELECT 1 FROM contacts WHERE "${col}" IS NOT NULL AND TRIM(CAST("${col}" AS TEXT)) <> '') as "${col}"`
  );
  const checkQuery = `SELECT ${selectParts.join(', ')}`;
  
  try {
    const checkRes = await pool.query(checkQuery);
    const row = checkRes.rows[0];
    const activeDynamicCols = dynamicCols.filter(col => row[col] === true);
    return allCols.filter(col => stdCols.has(col) || activeDynamicCols.includes(col));
  } catch (err) {
    console.error('Error checking active columns:', err);
    return allCols;
  }
}

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

    if (req.user && req.user.role === 'staff' && req.user.allowed_pincode) {
      const pins = req.user.allowed_pincode.split(',').map(p => p.trim()).filter(Boolean);
      if (pins.length === 1) {
        conditions.push(`c.pincode = $${idx++}`);
        params.push(pins[0]);
      } else if (pins.length > 1) {
        conditions.push(`c.pincode = ANY($${idx++})`);
        params.push(pins);
      }
    }

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

    const columns = await getActiveColumns(pool);

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
router.post('/', auth, roleGuard(['super_admin', 'admin']), async (req, res) => {
  try {
    let {
      name, mobile, address, city, state,
      village, pincode, email, gender, notes,
    } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ success: false, message: 'Name and mobile are required' });
    }

    if (name) name = toTitleCase(name);
    if (city) city = toTitleCase(city);
    if (state) state = toTitleCase(state);
    if (village) village = toTitleCase(village);
    if (address) address = toTitleCase(address);

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
router.put('/:id', auth, roleGuard(['super_admin', 'admin']), async (req, res) => {
  try {
    let {
      name, mobile, address, city, state,
      village, pincode, email, gender, notes,
    } = req.body;

    const existing = await pool.query(`SELECT id FROM contacts WHERE id = $1`, [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    if (name) name = toTitleCase(name);
    if (city) city = toTitleCase(city);
    if (state) state = toTitleCase(state);
    if (village) village = toTitleCase(village);
    if (address) address = toTitleCase(address);

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

// ── DELETE /api/contacts/all & DELETE /api/contacts ─────────────────────────
const deleteAllHandler = async (req, res) => {
  try {
    const countRes = await pool.query(`SELECT COUNT(*) FROM contacts`);
    const count = parseInt(countRes.rows[0].count, 10);

    // TRUNCATE is instantaneous for large tables (400k+ rows) compared to row-by-row DELETE
    await pool.query(`TRUNCATE TABLE contacts RESTART IDENTITY CASCADE`);

    await logActivity(req, 'DELETE_ALL_CONTACTS', `Deleted all ${count} contacts from database`);

    return res.json({ success: true, message: `Successfully deleted all ${count.toLocaleString()} contacts`, count });
  } catch (err) {
    console.error('Delete all contacts error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
};

router.delete('/all', auth, roleGuard(['super_admin', 'admin']), deleteAllHandler);
router.delete('/', auth, roleGuard(['super_admin', 'admin']), deleteAllHandler);

// ── DELETE /api/contacts/:id ──────────────────────────────────────────────────
router.delete('/:id', auth, roleGuard(['super_admin', 'admin']), async (req, res, next) => {
  if (req.params.id === 'all') {
    return deleteAllHandler(req, res);
  }

  const contactId = parseInt(req.params.id, 10);
  if (isNaN(contactId)) {
    return res.status(400).json({ success: false, message: 'Invalid contact ID' });
  }

  try {
    const existing = await pool.query(`SELECT id, name FROM contacts WHERE id = $1`, [contactId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await pool.query(`DELETE FROM contacts WHERE id = $1`, [contactId]);

    await logActivity(req, 'DELETE_CONTACT', `Deleted contact id=${contactId} "${existing.rows[0].name}"`);

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

        // Track headers with their actual column positions
        const headerMap = {}; // { colNumber: headerName }
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          const val = cell.value ? String(cell.value).toLowerCase().trim() : '';
          if (val) headerMap[colNumber] = val;
        });
        const headerColumns = Object.keys(headerMap).map(Number);
        const headers = headerColumns.map(c => headerMap[c]);

        console.log('Excel headers detected:', JSON.stringify(headerMap));

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const obj = {};
          // Read each column by its exact position — never miss trailing columns
          for (const colNum of headerColumns) {
            const cell = row.getCell(colNum);
            const headerName = headerMap[colNum];
            let cellVal = '';
            if (cell && cell.value != null) {
              if (cell.text !== undefined && cell.text !== null && String(cell.text).trim() !== '' && String(cell.text) !== '[object Object]') {
                cellVal = String(cell.text).trim();
              } else if (typeof cell.value === 'object') {
                if (cell.value.result != null) cellVal = String(cell.value.result).trim();
                else if (cell.value.text != null) cellVal = String(cell.value.text).trim();
                else if (Array.isArray(cell.value.richText)) cellVal = cell.value.richText.map(r => r.text || '').join('').trim();
                else cellVal = String(cell.value).trim();
              } else {
                cellVal = String(cell.value).trim();
              }
            }
            obj[headerName] = cellVal;
          }
          contacts.push(obj);
        });
      }

      if (contacts.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ success: false, message: 'File is empty or has no valid rows' });
      }

      // 1. Normalize fields & clean Postgres NULL strings
      for (const row of contacts) {
        const matchedKeysToClean = [];

        // Extract Name
        const nameMatch = findValue(row, 
          ['name', 'full_name', 'fullname', 'legal_name', 'company_name', 'company', 'business_name', 'firm_name', 'firm', 'customer_name', 'client_name', 'owner_name', 'cname', 'fname', 'first_name', 'contact_name'],
          /name|cname|fname/i
        );
        row['name'] = (nameMatch.val === '\\N') ? '' : String(nameMatch.val).trim();
        if (nameMatch.matchedKey && nameMatch.matchedKey !== 'name') {
          matchedKeysToClean.push(nameMatch.matchedKey);
        }

        // Extract Mobile
        const mobileMatch = findValue(row,
          ['mobile', 'mobile_number', 'mobile_no', 'mobileno', 'mobilenum', 'mob_num', 'mob_no', 'phone', 'phone_number', 'phone_no', 'phoneno', 'phonenum', 'number', 'contact', 'contact_no', 'contact_num', 'contactno', 'contactnum', 'mob', 'cell', 'whatsapp', 'whatsapp_no'],
          /mob|phone|contact|number|num|tel/i
        );
        row['mobile'] = (mobileMatch.val === '\\N') ? '' : String(mobileMatch.val).trim();
        if (mobileMatch.matchedKey && mobileMatch.matchedKey !== 'mobile') {
          matchedKeysToClean.push(mobileMatch.matchedKey);
        }

        if (row['mobile'] && row['mobile'].toUpperCase().includes('E')) {
          const num = Number(row['mobile']);
          if (!isNaN(num)) row['mobile'] = String(num);
        }

        // Extract Address (merge address variants and split address columns)
        const addrParts = [];
        const addrMatch = findValue(row,
          ['address', 'ladd', 'local_address', 'full_address', 'addr', 'location_address'],
          /addr|address/i
        );
        if (addrMatch.val && addrMatch.val !== '\\N' && String(addrMatch.val).trim() !== '') {
          addrParts.push(String(addrMatch.val).trim());
        }
        if (addrMatch.matchedKey && addrMatch.matchedKey !== 'address') {
          matchedKeysToClean.push(addrMatch.matchedKey);
        }

        // Check for split address columns like add1, add2, add3
        for (const key of Object.keys(row)) {
          if (/^add[1-9]$/i.test(key)) {
            if (row[key] && row[key] !== '\\N' && String(row[key]).trim() !== '') {
              addrParts.push(String(row[key]).trim());
            }
            matchedKeysToClean.push(key);
          }
        }
        row['address'] = addrParts.join(', ').trim();

        // Extract Pincode
        const pinMatch = findValue(row,
          ['pincode', 'pin', 'zip', 'zipcode', 'postal_code', 'postalcode', 'pin_code', 'pincode_no', 'pin_no', 'pincod'],
          /pin|zip/i
        );
        row['pincode'] = (pinMatch.val === '\\N') ? '' : String(pinMatch.val).trim();
        if (pinMatch.matchedKey && pinMatch.matchedKey !== 'pincode') {
          matchedKeysToClean.push(pinMatch.matchedKey);
        }

        // Extract City
        const cityMatch = findValue(row,
          ['city', 'city_name', 'district', 'dist', 'pob', 'town', 'cty', 'c_city'],
          /city|dist/i
        );
        row['city'] = (cityMatch.val === '\\N') ? '' : String(cityMatch.val).trim();
        if (cityMatch.matchedKey && cityMatch.matchedKey !== 'city') {
          matchedKeysToClean.push(cityMatch.matchedKey);
        }

        // Extract State
        const stateMatch = findValue(row,
          ['state', 'state_name', 'region', 'st', 's_state'],
          /state|region/i
        );
        row['state'] = (stateMatch.val === '\\N') ? '' : String(stateMatch.val).trim();
        if (stateMatch.matchedKey && stateMatch.matchedKey !== 'state') {
          matchedKeysToClean.push(stateMatch.matchedKey);
        }

        // Extract Village
        const villageMatch = findValue(row,
          ['village', 'location', 'area', 'town', 'village_name'],
          /village|loc|area/i
        );
        row['village'] = (villageMatch.val === '\\N') ? '' : String(villageMatch.val).trim();
        if (villageMatch.matchedKey && villageMatch.matchedKey !== 'village') {
          matchedKeysToClean.push(villageMatch.matchedKey);
        }

        // Smart fallback: If pincode, city, or state are empty, extract them from address text
        if (row['address']) {
          if (!row['pincode']) {
            const pinRegexMatch = row['address'].match(/\b([1-9][0-9]{5})\b/);
            if (pinRegexMatch) {
              row['pincode'] = pinRegexMatch[1];
            }
          }

          if (!row['state']) {
            const indianStates = [
              'Maharashtra', 'Gujarat', 'Karnataka', 'Delhi', 'Tamil Nadu', 'Uttar Pradesh',
              'Rajasthan', 'Madhya Pradesh', 'West Bengal', 'Telangana', 'Andhra Pradesh',
              'Punjab', 'Haryana', 'Kerala', 'Bihar', 'Jharkhand', 'Assam', 'Odisha',
              'Chhattisgarh', 'Uttarakhand', 'Himachal Pradesh', 'Goa'
            ];
            for (const st of indianStates) {
              if (new RegExp(`\\b${st}\\b`, 'i').test(row['address'])) {
                row['state'] = st;
                break;
              }
            }
          }

          if (!row['city']) {
            const commonCities = [
              'Pune', 'Mumbai', 'Nagpur', 'Nashik', 'Thane', 'Delhi', 'Bangalore', 'Bengaluru',
              'Hyderabad', 'Ahmedabad', 'Kolkata', 'Chennai', 'Surat', 'Jaipur', 'Lucknow',
              'Kanpur', 'Indore', 'Bhopal', 'Patna', 'Vadodara', 'Ludhiana', 'Agra',
              'Rajkot', 'Varanasi', 'Aurangabad', 'Solapur', 'Amravati', 'Kolhapur',
              'Sangli', 'Satara', 'Nanded', 'Jalgaon', 'Akola', 'Latur', 'Dhule',
              'Ahmednagar', 'Chandrapur', 'Parbhani', 'Ichalkaranji', 'Jalna', 'Bhusawal',
              'Panvel', 'Bhiwandi', 'Navi Mumbai'
            ];
            for (const ct of commonCities) {
              if (new RegExp(`\\b${ct}\\b`, 'i').test(row['address'])) {
                row['city'] = ct;
                break;
              }
            }
          }
        }

        // Extract Email
        const emailMatch = findValue(row,
          ['email', 'email_id', 'emailid', 'email_address', 'emailaddress', 'mail', 'mail_id', 'mailid'],
          /email|mail/i
        );
        row['email'] = (emailMatch.val === '\\N') ? '' : String(emailMatch.val).trim();
        if (emailMatch.matchedKey && emailMatch.matchedKey !== 'email') {
          matchedKeysToClean.push(emailMatch.matchedKey);
        }

        // Extract Gender
        const genderMatch = findValue(row,
          ['gender', 'sex'],
          /gender|sex/i
        );
        if (genderMatch.matchedKey && genderMatch.matchedKey !== 'gender') {
          matchedKeysToClean.push(genderMatch.matchedKey);
        }
        let genVal = String(genderMatch.val || '').trim().toLowerCase();
        if (genVal.startsWith('m')) {
          row['gender'] = 'male';
        } else if (genVal.startsWith('f') || genVal.startsWith('w')) {
          row['gender'] = 'female';
        } else if (genVal.startsWith('o')) {
          row['gender'] = 'other';
        } else {
          row['gender'] = 'male'; // default fallback
        }

        // Also clean up any general known synonyms and serial number columns if they exist
        const synonyms = [
          'full_name', 'fullname', 'cname', 'fname', 'first_name', 'contact_name', 'legal_name', 'company_name', 'business_name', 'firm_name', 'customer_name', 'client_name', 'owner_name',
          'phone', 'contact', 'mobile_number', 'number', 'mob', 'cell', 'contact_no', 'phone_number', 'mob_num', 'mob_no', 'whatsapp', 'whatsapp_no',
          'ladd', 'local_address', 'full_address', 'addr', 'location_address',
          'pin', 'zip', 'zipcode', 'postal_code', 'postalcode', 'pin_code', 'pincode_no', 'pin_no',
          'city_name', 'district', 'dist', 'pob',
          'state_name', 'region',
          'location', 'area', 'town', 'village_name',
          'email_address', 'mail', 'email_id', 'emailid', 'mail_id', 'mailid',
          'sex'
        ];
        for (const key of synonyms) {
          matchedKeysToClean.push(key);
        }

        for (const key of Object.keys(row)) {
          const kClean = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (['srno', 'sno', 'slno', 'seq', 'seqno', 'serialno', 'sr'].includes(kClean) || kClean.includes('srno')) {
            matchedKeysToClean.push(key);
          }
        }

        // Delete synonym & serial number keys from row object
        for (const key of matchedKeysToClean) {
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
          if (key && key !== 'undefined' && key.trim() !== '') {
            fileHeaders.add(key);
          }
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

      // Ensure all standard DB columns are always present in activeInsertCols
      const stdDbCols = ['name', 'mobile', 'address', 'city', 'state', 'village', 'pincode', 'email', 'gender', 'notes'];
      for (const stdCol of stdDbCols) {
        if (!activeInsertCols.some(c => c.dbName === stdCol) && existingCols.has(stdCol)) {
          activeInsertCols.push({ original: stdCol, dbName: stdCol });
        }
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
              if (['name', 'city', 'state', 'village', 'address'].includes(col.dbName)) {
                val = toTitleCase(val);
              }
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
