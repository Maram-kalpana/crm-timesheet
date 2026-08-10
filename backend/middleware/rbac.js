const pool = require('../config/db');

const normalizeRole = (role) => {
  if (role === 'manager') return 'team_lead';
  return role;
};

const isAdmin = (user) => normalizeRole(user?.role) === 'admin';
const isHr = (user) => normalizeRole(user?.role) === 'hr';
const isTeamLead = (user) => normalizeRole(user?.role) === 'team_lead';
const isEmployee = (user) => normalizeRole(user?.role) === 'employee';

const getTeamMemberIds = async (teamLeadEmpId) => {
  const [rows] = await pool.query(
    'SELECT id FROM employees WHERE reporting_manager_id = ?',
    [teamLeadEmpId]
  );
  return rows.map((r) => r.id);
};

const canAccessEmployee = async (user, targetEmployeeId) => {
  const role = normalizeRole(user.role);
  const requesterEmpId = Number(user.employeeId);

  if (role === 'admin') return true;
  if (role === 'hr') return true;
  if (role === 'team_lead') {
    if (targetEmployeeId === requesterEmpId) return true;
    const teamIds = await getTeamMemberIds(requesterEmpId);
    return teamIds.includes(Number(targetEmployeeId));
  }
  if (role === 'employee') {
    return targetEmployeeId === requesterEmpId;
  }
  return false;
};

const scopeEmployeeList = async (user) => {
  const role = normalizeRole(user.role);
  if (role === 'admin' || role === 'hr') {
    return { clause: '', params: [] };
  }
  if (role === 'team_lead') {
    const teamIds = await getTeamMemberIds(Number(user.employeeId));
    const ids = [Number(user.employeeId), ...teamIds];
    if (!ids.length) return { clause: 'AND e.id = ?', params: [user.employeeId] };
    return { clause: `AND e.id IN (${ids.map(() => '?').join(',')})`, params: ids };
  }
  return { clause: 'AND e.id = ?', params: [user.employeeId] };
};

const generateEmployeeCode = async (employeeType) => {
  const prefix = employeeType === 'hr' ? 'HR' : employeeType === 'team_lead' ? 'TL' : employeeType === 'admin' ? 'ADM' : 'EMP';
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
  getTeamMemberIds,
  canAccessEmployee,
  scopeEmployeeList,
  generateEmployeeCode,
  generateTempPassword,
};
