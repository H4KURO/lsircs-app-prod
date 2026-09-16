const ExcelJS = require('exceljs');

const MANAGEMENT_TYPE_MAP = {
  'PCS Plan A': 'PCS A',
  'PCS Plan B': 'PCS B',
  'PCS Rental - Japanese Statement': 'PM',
};

function extractPropertyName(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const idx = s.indexOf(' - ');
  return idx > 0 ? s.slice(0, idx).trim() : s;
}

async function parseWorkbook(base64) {
  const buf = Buffer.from(base64, 'base64');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const rows = [];
  ws.eachRow((row, rowNumber) => {
    rows.push({ rowNumber, values: row.values.slice(1) }); // values[0] is undefined in ExcelJS
  });
  return rows;
}

function findHeaderRow(rows, firstColKeyword) {
  for (const r of rows) {
    if (r.values[0] && String(r.values[0]).trim().toLowerCase().includes(firstColKeyword.toLowerCase())) {
      return r.rowNumber;
    }
  }
  return null;
}

async function parsePropertyDirectory(base64) {
  const rows = await parseWorkbook(base64);
  const headerRow = findHeaderRow(rows, 'Property');
  if (!headerRow) return [];
  const dataRows = rows.filter(r => r.rowNumber > headerRow && r.values[0]);
  return dataRows.map(r => {
    const rawOwner = r.values[1] ? String(r.values[1]) : '';
    const ownerName = rawOwner.split(' - Phone:')[0].trim();
    const phoneMatch = rawOwner.match(/Phone:\s*([^,]+)/g);
    const ownerPhone = phoneMatch ? phoneMatch.map(p => p.replace('Phone:', '').trim()).join(', ') : null;
    return {
      propertyRaw: String(r.values[0]).trim(),
      propertyName: extractPropertyName(r.values[0]),
      ownerName,
      ownerPhone,
    };
  });
}

async function parsePropertyGroupDirectory(base64) {
  const rows = await parseWorkbook(base64);
  const headerRow = findHeaderRow(rows, 'Property Name');
  if (!headerRow) return {};
  const dataRows = rows.filter(r => r.rowNumber > headerRow && r.values[0] && r.values[1]);
  const map = {};
  for (const r of dataRows) {
    const propName = extractPropertyName(r.values[0]);
    const groupRaw = String(r.values[1]).trim();
    if (propName && groupRaw) {
      map[propName] = MANAGEMENT_TYPE_MAP[groupRaw] || groupRaw;
    }
  }
  return map;
}

async function parseTenantDirectory(base64) {
  const rows = await parseWorkbook(base64);
  const headerRow = findHeaderRow(rows, 'Property');
  if (!headerRow) return {};
  const dataRows = rows.filter(r => r.rowNumber > headerRow && r.values[0] && String(r.values[0]).includes(' - '));
  const byProperty = {};
  for (const r of dataRows) {
    const propName = extractPropertyName(r.values[0]);
    if (!propName || propName === 'Total') continue;
    if (!byProperty[propName]) {
      const moveIn = r.values[3];
      const leaseTo = r.values[4];
      byProperty[propName] = {
        tenantStatus: r.values[2] ? String(r.values[2]).trim() : null,
        leaseStart: moveIn instanceof Date ? moveIn.toISOString().split('T')[0] : (moveIn ? String(moveIn) : null),
        leaseEnd: leaseTo instanceof Date ? leaseTo.toISOString().split('T')[0] : (leaseTo ? String(leaseTo) : null),
        monthlyRent: typeof r.values[5] === 'number' ? r.values[5] : null,
      };
    }
  }
  return byProperty;
}

async function parseOwnerDirectory(base64) {
  const rows = await parseWorkbook(base64);
  const headerRow = findHeaderRow(rows, 'Name');
  if (!headerRow) return {};
  const dataRows = rows.filter(r => r.rowNumber > headerRow && r.values[0]);
  const map = {};
  for (const r of dataRows) {
    const ownerName = String(r.values[0]).trim();
    const propertiesOwned = r.values[1] ? String(r.values[1]) : '';
    const props = propertiesOwned.split(',').map(p => p.trim()).filter(Boolean);
    for (const propEntry of props) {
      const propName = extractPropertyName(propEntry);
      if (propName) map[propName] = ownerName;
    }
  }
  return map;
}

async function mergeAppfolioData({ propertyFile, propertyGroupFile, tenantFile, ownerFile }) {
  const [propertyRows, groupMap, tenantMap, ownerMap] = await Promise.all([
    propertyFile ? parsePropertyDirectory(propertyFile) : [],
    propertyGroupFile ? parsePropertyGroupDirectory(propertyGroupFile) : {},
    tenantFile ? parseTenantDirectory(tenantFile) : {},
    ownerFile ? parseOwnerDirectory(ownerFile) : {},
  ]);

  return propertyRows.map(p => {
    const tenant = tenantMap[p.propertyName] || {};
    return {
      propertyName: p.propertyName,
      managementType: groupMap[p.propertyName] || null,
      ownerName: p.ownerName,
      ownerPhone: p.ownerPhone,
      tenantStatus: tenant.tenantStatus || null,
      leaseStart: tenant.leaseStart || null,
      leaseEnd: tenant.leaseEnd || null,
      monthlyRent: tenant.monthlyRent || null,
      appfolioPropertyString: p.propertyRaw,
    };
  });
}

module.exports = { mergeAppfolioData };
