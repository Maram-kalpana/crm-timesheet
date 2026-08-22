const ALLOWED_COUNTRIES = ['IN', 'UK', 'US'];
const ALLOWED_CURRENCIES = ['INR', 'GBP', 'USD'];

const mapCompany = (row) => {
  if (!row || !row.id) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    registrationNumber: row.registration_number,
    country: row.country,
    currency: row.currency,
    localeConfiguredAt: row.locale_configured_at,
  };
};

const fetchCompanyByUserId = async (db, userId) => {
  try {
    const [rows] = await db.query(
      `SELECT u.company_id AS user_company_id, c.id, c.name, c.email, c.phone, c.registration_number, c.country, c.currency, c.locale_configured_at
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = ?`,
      [userId]
    );
    if (!rows.length) return { companyId: null, company: null };
    const companyId = rows[0].id || rows[0].user_company_id || null;
    return {
      companyId,
      company: mapCompany(rows[0].id ? rows[0] : null),
    };
  } catch {
    return { companyId: null, company: null };
  }
};

const companyFilter = (user, alias = 'u') => {
  if (user?.companyId == null) {
    return { sql: ` AND ${alias}.company_id IS NULL`, params: [] };
  }
  return { sql: ` AND ${alias}.company_id = ?`, params: [user.companyId] };
};

const findOrCreateDepartment = async (db, name, companyId) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const [existing] = await db.query(
    'SELECT id FROM departments WHERE LOWER(name) = LOWER(?) AND (company_id <=> ?)',
    [trimmed, companyId || null]
  );
  if (existing.length) return existing[0].id;
  const [result] = await db.query(
    'INSERT INTO departments (name, company_id) VALUES (?, ?)',
    [trimmed, companyId || null]
  );
  return result.insertId;
};

const resolveEmployeeDepartmentId = async (db, body, companyId) => {
  if (body.department != null && String(body.department).trim() !== '') {
    return findOrCreateDepartment(db, body.department, companyId);
  }
  if (body.departmentName != null && String(body.departmentName).trim() !== '') {
    return findOrCreateDepartment(db, body.departmentName, companyId);
  }
  if (body.departmentId) return body.departmentId;
  if (body.department_id) return body.department_id;
  return null;
};

const needsLocaleSetup = (role, company) => {
  if (role !== 'admin') return false;
  if (!company) return false;
  return !company.localeConfiguredAt;
};

module.exports = {
  ALLOWED_COUNTRIES,
  ALLOWED_CURRENCIES,
  mapCompany,
  fetchCompanyByUserId,
  needsLocaleSetup,
  companyFilter,
  findOrCreateDepartment,
  resolveEmployeeDepartmentId,
};
