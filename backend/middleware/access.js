const { normalizeRole, canAccessEmployee, isAdmin, isHr } = require('./rbac');

const requireEmployeeAccess = async (req, res, next) => {
  try {
    const targetId = Number(req.params.id || req.params.employeeId || req.query.employeeId);
    if (!targetId || Number.isNaN(targetId)) {
      return res.status(400).json({ success: false, message: 'Valid employee ID is required.' });
    }
    const allowed = await canAccessEmployee(req.user, targetId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    req.targetEmployeeId = targetId;
    next();
  } catch (error) {
    next(error);
  }
};

const maskSensitiveEmployee = (row, user) => {
  if (!row) return row;
  const role = normalizeRole(user?.role);
  if (role === 'admin' || role === 'hr') return row;
  const masked = { ...row };
  if (masked.aadhar_number) {
    masked.aadhar_number = masked.aadhar_number.replace(/\d(?=\d{4})/g, 'X');
  }
  if (masked.pan_number) {
    masked.pan_number = `${masked.pan_number.slice(0, 2)}XXXX${masked.pan_number.slice(-2)}`;
  }
  if (masked.bank_account_number) {
    masked.bank_account_number = `XXXX${String(masked.bank_account_number).slice(-4)}`;
  }
  return masked;
};

// CHANGED: HR can now create accountant / team_lead / employee accounts.
// HR still cannot create "hr" or "admin" accounts — only admin can do that.
const canManageRole = (creatorRole, targetRole) => {
  const creator = normalizeRole(creatorRole);
  const target = normalizeRole(targetRole);
  if (creator === 'admin') return target !== 'admin';
  if (creator === 'hr') return target !== 'admin' && target !== 'hr';
  return false;
};

module.exports = {
  requireEmployeeAccess,
  maskSensitiveEmployee,
  canManageRole,
  isAdmin,
  isHr,
};