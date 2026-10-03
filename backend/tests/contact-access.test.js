const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');

process.env.JWT_SECRET = 'contact-access-test-secret';

const users = new Map([
  [1, { id: 1, username: 'owner', role: 'super_admin', status: true, allowed_pincode: null, allow_contact_access: false }],
  [2, { id: 2, username: 'viewer', role: 'staff', status: true, allowed_pincode: '411001', allow_contact_access: false }],
  [3, { id: 3, username: 'exporter', role: 'download_user', status: true, allowed_pincode: null, allow_contact_access: false }],
]);
const contact = { id: 7, name: 'Test Contact', mobile: '9876543210', pincode: '412308', city: 'Pune', created_at: new Date() };
const originalQuery = pool.query;

pool.query = async (sql, params = []) => {
  if (sql.includes('FROM users WHERE id = $1')) {
    const user = users.get(Number(params[0]));
    return { rows: user ? [{ ...user }] : [] };
  }
  if (sql.includes('UPDATE users SET allow_contact_access')) {
    const user = users.get(Number(params[1]));
    if (!user || user.role !== 'staff') return { rows: [] };
    user.allow_contact_access = params[0];
    return { rows: [{ id: user.id, username: user.username, allow_contact_access: user.allow_contact_access }] };
  }
  if (sql.includes('information_schema.columns')) {
    return { rows: ['id', 'name', 'mobile', 'pincode', 'city', 'created_at'].map(column_name => ({ column_name })) };
  }
  if (sql.includes('COALESCE(MAX(id), 0)')) return { rows: [{ max_id: contact.id }] };
  if (sql.includes('COUNT(*) FROM contacts')) return { rows: [{ count: '1' }] };
  if (sql.includes('FROM contacts')) {
    const pinFilter = sql.match(/\b(?:c\.)?pincode\s*=\s*\$(\d+)/);
    if (pinFilter && params[Number(pinFilter[1]) - 1] !== contact.pincode) return { rows: [] };
    const lastIdFilter = sql.match(/\bid\s*>\s*\$(\d+)/);
    if (lastIdFilter && params[Number(lastIdFilter[1]) - 1] >= contact.id) return { rows: [] };
    return { rows: [{ ...contact }] };
  }
  if (sql.includes('INSERT INTO download_logs') || sql.includes('INSERT INTO activity_logs')) return { rows: [] };
  throw new Error(`Unexpected SQL: ${sql}`);
};

const app = express();
app.use(express.json());
app.use('/api/contacts', require('../routes/contacts'));
app.use('/api/search', require('../routes/search'));
app.use('/api/download', require('../routes/download'));
app.use('/api/users', require('../routes/users'));
const server = app.listen(0);

after(() => {
  server.close();
  pool.query = originalQuery;
});

const token = id => jwt.sign({ id }, process.env.JWT_SECRET);
const request = (path, id, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
  ...options,
  headers: { Authorization: `Bearer ${token(id)}`, ...(options.headers || {}) },
});

test('super admin grant and revocation control contact responses and Excel export for an existing session', async () => {
  const masked = await (await request('/api/contacts', 2)).json();
  assert.equal(masked.data[0].pincode, '412308');
  assert.equal(masked.data[0].mobile, '98765xxxxx');
  assert.equal((await (await request('/api/contacts/7', 2)).json()).data.mobile, '98765xxxxx');
  assert.equal((await (await request('/api/search', 2)).json()).data[0].mobile, '98765xxxxx');
  assert.equal((await request('/api/download/excel', 2)).status, 403);
  assert.equal((await request('/api/download/excel?pincode=412308', 2)).status, 403);
  assert.equal((await request('/api/download/csv', 3)).status, 403);

  const unauthorizedGrant = await request('/api/users/2/contact-access', 2, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(unauthorizedGrant.status, 403);

  const grant = await request('/api/users/2/contact-access', 1, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(grant.status, 200);
  assert.equal((await (await request('/api/contacts', 2)).json()).data[0].mobile, contact.mobile);
  assert.equal((await (await request('/api/search', 2)).json()).data[0].mobile, contact.mobile);

  const download = await request('/api/download/excel', 2);
  assert.equal(download.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await download.arrayBuffer()));
  assert.equal(workbook.getWorksheet('Contacts').getCell('C2').value, contact.mobile);

  const matchingPin = await request('/api/download/excel?pincode=412308', 2);
  assert.equal(matchingPin.status, 200);
  const matchingWorkbook = new ExcelJS.Workbook();
  await matchingWorkbook.xlsx.load(Buffer.from(await matchingPin.arrayBuffer()));
  assert.equal(matchingWorkbook.getWorksheet('Contacts').getCell('C2').value, contact.mobile);

  const otherPin = await request('/api/download/excel?pincode=411001', 2);
  assert.equal(otherPin.status, 200);
  const otherWorkbook = new ExcelJS.Workbook();
  await otherWorkbook.xlsx.load(Buffer.from(await otherPin.arrayBuffer()));
  assert.equal(otherWorkbook.getWorksheet('Contacts').rowCount, 1);

  const revoke = await request('/api/users/2/contact-access', 1, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  });
  assert.equal(revoke.status, 200);
  assert.equal((await (await request('/api/contacts', 2)).json()).data[0].mobile, '98765xxxxx');
  assert.equal((await request('/api/download/excel', 2)).status, 403);
});
