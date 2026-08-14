const pool = require('../config/db');

const normalizeRole = (role) => {
  if (role === 'manager') return 'team_lead';
  return role;
};

const isAdmin = (user) => normalizeRole(user?.role) === 'admin';
const isHr = (user) => normalizeRole(user?.role) === 'hr';
const isTeamLead = (user) => normalizeRole(user?.role) === 'team_lead';
const isEmployee = (user) => normalizeRole(user?.role) === 'employee';
const isAccountant = (user) => normalizeRole(user?.role) === 'accountant';
const canViewAllTimesheets = (user) => {
  const role = normalizeRole(user?.role);
  return role === 'admin' || role === 'hr' || role === 'accountant';
};
const canSendClientBilling = (user) => {
  const role = normalizeRole(user?.role);
  return role === 'admin' || role === 'accountant';
};

const getTeamMemberIds = async (teamLeadEmpId) => {
  const [directReports] = await pool.query(
    'SELECT id FROM employees WHERE reporting_manager_id = ?',
    [teamLeadEmpId]
  );
  const [projectMembers] = await pool.query(`
    SELECT DISTINCT pm.employee_id AS id
    FROM project_members pm
    JOIN projects p ON pm.project_id = p.id
    WHERE p.manager_id = ? AND pm.employee_id != ?
  `, [teamLeadEmpId, teamLeadEmpId]);

  const ids = new Set([
    ...directReports.map((r) => r.id),
    ...projectMembers.map((r) => r.id),
  ]);
  return Array.from(ids);
};

const getEmployeeUserRole = async (employeeId) => {
  const [rows] = await pool.query(
    'SELECT u.role FROM employees e JOIN users u ON e.user_id = u.id WHERE e.id = ?',
    [employeeId]
  );
  return rows.length ? normalizeRole(rows[0].role) : null;
};

const canAccessEmployee = async (user, targetEmployeeId) => {
  const role = normalizeRole(user.role);
  const requesterEmpId = Number(user.employeeId);

  if (role === 'admin') return true;
  if (role === 'hr') {
    const targetRole = await getEmployeeUserRole(targetEmployeeId);
    return targetRole !== 'admin';
  }
  if (role === 'team_lead') {
    if (targetEmployeeId === requesterEmpId) return true;
    const teamIds = await getTeamMemberIds(requesterEmpId);
    return teamIds.includes(Number(targetEmployeeId));
  }
  if (role === 'employee') {
    return targetEmployeeId === requesterEmpId;
  }
  if (role === 'accountant') {
    return targetEmployeeId === requesterEmpId;
  }
  return false;
};

const scopeEmployeeList = async (user) => {
  const role = normalizeRole(user.role);
  const requesterEmpId = Number(user.employeeId);

  if (role === 'admin') {
    // Admin is not an employee — exclude admin accounts from the employees list
    return { clause: "AND u.role != 'admin'", params: [] };
  }
  if (role === 'hr') {
    // HR list excludes admin and the HR user's own record
    return { clause: "AND u.role != 'admin' AND e.id != ?", params: [requesterEmpId] };
  }
  if (role === 'team_lead') {
    const teamIds = await getTeamMemberIds(requesterEmpId);
    if (!teamIds.length) return { clause: 'AND 1=0', params: [] };
    return { clause: `AND e.id IN (${teamIds.map(() => '?').join(',')})`, params: teamIds };
  }
  if (role === 'accountant') {
    return { clause: 'AND 1=0', params: [] };
  }
  return { clause: 'AND e.id = ?', params: [user.employeeId] };
};

const generateEmployeeCode = async (employeeType) => {
  const prefixMap = {
    hr: 'HR',
    team_lead: 'TL',
    admin: 'ADM',
    accountant: 'ACC',
  };
  const prefix = prefixMap[employeeType] || 'EMP';
  const [rows] = await pool.query(
    'SELECT employee_id FROM users WHERE employee_id LIKE ? ORDER BY employee_id DESC LIMIT 1',
    [`${prefix}%`]
  );
  let next = 1;
  if (rows.length) {
    const num = parseInt(String(rows[0].employee_id).replace(/\D/g, ''), 10);
    if (!Number.isNaN(num)) next = num + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
};

const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
  let pwd = '';
  for (let i = 0; i < 12; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  return pwd;
};

module.exports = {
  normalizeRole,
  isAdmin,
  isHr,
  isTeamLead,
  isEmployee,
  isAccountant,
  canViewAllTimesheets,
  canSendClientBilling,
  getTeamMemberIds,
  getEmployeeUserRole,
  canAccessEmployee,
  scopeEmployeeList,
  generateEmployeeCode,
  generateTempPassword,
};
