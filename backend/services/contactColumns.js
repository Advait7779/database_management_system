const pool = require('../db/pool');

const STANDARD_COLUMNS = new Set([
  'id', 'name', 'gender', 'mobile', 'address', 'city', 'state', 'village', 'pincode', 'email', 'notes',
  'created_by', 'created_at', 'updated_at',
]);
const CACHE_MS = 60_000;
let cachedColumns = null;
let expiresAt = 0;
let pending = null;
let generation = 0;

function isSerialColumn(name) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ['srno', 'sno', 'slno', 'seq', 'seqno', 'serialno', 'sr'].includes(normalized)
    || normalized.includes('srno');
}

async function loadActiveColumns() {
  const colsRes = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'`
  );
  const allColumns = colsRes.rows.map(row => row.column_name);
  const dynamicColumns = allColumns.filter(column => !STANDARD_COLUMNS.has(column));
  if (dynamicColumns.length === 0) return allColumns;

  const quoteIdentifier = column => `"${column.replace(/"/g, '""')}"`;
  const checks = dynamicColumns.map((column, index) =>
    `EXISTS(SELECT 1 FROM contacts WHERE ${quoteIdentifier(column)} IS NOT NULL AND TRIM(CAST(${quoteIdentifier(column)} AS TEXT)) <> '') AS active_${index}`
  );

  try {
    const checkRes = await pool.query(`SELECT ${checks.join(', ')}`);
    const active = new Set(dynamicColumns.filter((_, index) => checkRes.rows[0][`active_${index}`]));
    return allColumns.filter(column => STANDARD_COLUMNS.has(column) || active.has(column));
  } catch (err) {
    console.error('Error checking active columns:', err);
    return allColumns;
  }
}

async function getActiveColumns({ excludeSerial = false } = {}) {
  if (!cachedColumns || Date.now() >= expiresAt) {
    if (!pending) {
      const currentGeneration = generation;
      const request = loadActiveColumns().then(columns => {
        if (generation === currentGeneration) {
          cachedColumns = columns;
          expiresAt = Date.now() + CACHE_MS;
        }
        return columns;
      });
      pending = request;
      request.finally(() => { if (pending === request) pending = null; }).catch(() => {});
    }
    const columns = await pending;
    return excludeSerial ? columns.filter(column => !isSerialColumn(column)) : columns;
  }
  return excludeSerial ? cachedColumns.filter(column => !isSerialColumn(column)) : cachedColumns;
}

function invalidateContactColumns() {
  generation++;
  cachedColumns = null;
  expiresAt = 0;
  pending = null;
}

module.exports = { getActiveColumns, invalidateContactColumns };
