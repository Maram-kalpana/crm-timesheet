const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { exportToExcel } = require('../utils/excel');
const {
  scopeEmployeeList,
  canAccessEmployee,
  generateEmployeeCode,
  generateTempPassword,
  normalizeRole,
  isAdmin,
  isHr,
  getTeamMemberIds,
} = require('../middleware/rbac');
const { maskSensitiveEmployee, canManageRole } = require('../middleware/access');
const { sendWelcomeEmail } = require('../utils/emailService');

const router = express.Router();

const employeeQuery = `
  SELECT e.*, u.email, u.employee_id, u.role, u.is_active,
         d.name as department_name,
         CONCAT(m.first_name, ' ', m.last_name) as manager_name
  FROM employees e
  JOIN users u ON e.user_id = u.id
  LEFT JOIN departments d ON e.department_id = d.id
  LEFT JOIN employees m ON e.reporting_manager_id = m.id
`;

const mapEmployeeTypeToRole = (type) => {
  if (type === 'hr') return 'hr';
  if (type === 'team_lead') return 'team_lead';
  if (type === 'accountant') return 'accountant';
  return 'employee';
};

// --- Validation patterns (mirrors the frontend Add Employee form) ---
const PATTERNS = {
  name: /^[A-Za-z\s.'-]+$/,
  email: /^\S+@\S+\.\S+$/,
  phone: /^[6-9]\d{9}$/,
  pincode: /^\d{6}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  aadhaar: /^\d{12}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  accountNumber: /^\d{9,18}$/,
};

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

// Validates the "Add Employee" payload and returns an array of human-readable
// error messages (empty array = valid). Kept as a plain function (not
// express-validator/joi) so it slots into the existing route style without
// adding a new dependency.
function validateEmployeePayload(body) {
  const errors = [];
  const req_ = (key, label) => {
    if (isBlank(body[key])) errors.push(`${label} is required.`);
  };
  const pattern = (key, label, re, msg) => {
    if (!isBlank(body[key]) && !re.test(String(body[key]).trim())) {
      errors.push(msg || `${label} format is invalid.`);
    }
  };

  // Login credentials
  req_('email', 'Email');
  pattern('email', 'Email', PATTERNS.email, 'Enter a valid email address.');
  if (!isBlank(body.password) && String(body.password).length < 6) {
    errors.push('Password must be at least 6 characters.');
  }

  // Personal information
  req_('firstName', 'First name');
  pattern('firstName', 'First name', PATTERNS.name, 'First name must contain only letters.');
  req_('lastName', 'Last name');
  pattern('lastName', 'Last name', PATTERNS.name, 'Last name must contain only letters.');
  req_('phone', 'Phone');
  pattern('phone', 'Phone', PATTERNS.phone, 'Enter a valid 10-digit phone number.');
  req_('dateOfBirth', 'Date of birth');
  if (!isBlank(body.dateOfBirth)) {
    const dob = new Date(body.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      errors.push('Date of birth is invalid.');
    } else {
      const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 18) errors.push('Employee must be at least 18 years old.');
    }
  }
  req_('gender', 'Gender');
  req_('address', 'Address');
  req_('city', 'City');
  pattern('city', 'City', PATTERNS.name, 'City must contain only letters.');
  req_('state', 'State');
  pattern('state', 'State', PATTERNS.name, 'State must contain only letters.');
  req_('pincode', 'Pincode');
  pattern('pincode', 'Pincode', PATTERNS.pincode, 'Enter a valid 6-digit pincode.');
  req_('emergencyContactName', 'Emergency contact name');
  pattern('emergencyContactName', 'Emergency contact name', PATTERNS.name, 'Emergency contact name must contain only letters.');
  req_('emergencyContactPhone', 'Emergency contact phone');
  pattern('emergencyContactPhone', 'Emergency contact phone', PATTERNS.phone, 'Enter a valid 10-digit emergency contact phone number.');

  // Professional information
  req_('departmentId', 'Department');
  req_('designation', 'Designation');
  pattern('designation', 'Designation', PATTERNS.name, 'Designation must contain only letters.');
  req_('joiningDate', 'Joining date');
  req_('employmentType', 'Employment type');

  // Bank & government details
  req_('bankName', 'Bank name');
  pattern('bankName', 'Bank name', PATTERNS.name, 'Bank name must contain only letters.');
  req_('bankAccountNumber', 'Account number');
  pattern('bankAccountNumber', 'Account number', PATTERNS.accountNumber, 'Enter a valid account number (9-18 digits).');
  req_('bankIfsc', 'IFSC code');
  pattern('bankIfsc', 'IFSC code', PATTERNS.ifsc, 'Enter a valid IFSC code (e.g. HDFC0001234).');
  req_('bankBranch', 'Branch');
  req_('bankAccountHolder', 'Account holder name');
  pattern('bankAccountHolder', 'Account holder name', PATTERNS.name, 'Account holder name must contain only letters.');
  req_('panNumber', 'PAN');
  pattern('panNumber', 'PAN', PATTERNS.pan, 'Enter a valid PAN (e.g. ABCDE1234F).');
  req_('aadharNumber', 'Aadhaar');
  pattern('aadharNumber', 'Aadhaar', PATTERNS.aadhaar, 'Enter a valid 12-digit Aadhaar number.');

  // Salary structure
  const nonNegativeFields = [
    ['hra', 'HRA'],
    ['transportAllowance', 'Transport allowance'],
    ['medicalAllowance', 'Medical allowance'],
    ['specialAllowance', 'Special allowance'],
    ['bonus', 'Bonus'],
    ['pfDeduction', 'PF deduction'],
    ['taxDeduction', 'Tax deduction'],
    ['otherDeductions', 'Other deductions'],
  ];
  req_('basicSalary', 'Basic salary');
  if (!isBlank(body.basicSalary)) {
    const n = Number(body.basicSalary);
    if (Number.isNaN(n) || n <= 0) errors.push('Basic salary must be a number greater than 0.');
  }
  nonNegativeFields.forEach(([key, label]) => {
    req_(key, label);
    if (!isBlank(body[key])) {
      const n = Number(body[key]);
      if (Number.isNaN(n) || n < 0) errors.push(`${label} must be a number that is not negative.`);
    }
  });

  // Team lead must have at least one team member
  if (mapEmployeeTypeToRole(body.employeeType) === 'team_lead') {
    if (!Array.isArray(body.teamMemberIds) || !body.teamMemberIds.length) {
      errors.push('At least one team member is required for a Team Lead.');
    }
  }

  return errors;
}

// CHANGED: was authorize('admin') only. HR can now create Team Leads from the
// frontend and needs this list to populate the "Team Members" picker.
router.get('/assignable', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const { search } = req.query;
    let where = "WHERE u.role = 'employee' AND u.is_active = TRUE";
    const params = [];
    if (search) {
      where += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR u.employee_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    const [rows] = await pool.query(`
      SELECT e.id, e.first_name, e.last_name, u.employee_id, e.designation, e.reporting_manager_id, u.role
      FROM employees e JOIN users u ON e.user_id = u.id ${where}
      ORDER BY e.first_name LIMIT 100
    `, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/team-leads', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const { search } = req.query;
    let where = "WHERE u.role = 'team_lead' AND u.is_active = TRUE";
    const params = [];
    if (search) {
      where += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR u.employee_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    const [rows] = await pool.query(`
      SELECT e.id, e.first_name, e.last_name, u.employee_id, e.designation, u.role
      FROM employees e JOIN users u ON e.user_id = u.id ${where}
      ORDER BY e.first_name LIMIT 100
    `, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    if (role === 'employee' || role === 'accountant') {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }

    const { search, department, status, page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    const scope = await scopeEmployeeList(req.user);
    let where = 'WHERE 1=1';
    const params = [...scope.params];
    if (scope.clause) where += ` ${scope.clause}`;

    if (search) {
      where += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR u.email LIKE ? OR u.employee_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (department) {
      where += ' AND e.department_id = ?';
      params.push(department);
    }
    if (status === 'active') where += ' AND u.is_active = TRUE';
    if (status === 'inactive') where += ' AND u.is_active = FALSE';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const allowedSort = ['first_name', 'last_name', 'joining_date', 'created_at'];
    const sort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM employees e JOIN users u ON e.user_id = u.id ${where}`,
      params
    );

    const [employees] = await pool.query(
      `${employeeQuery} ${where} ORDER BY e.${sort} ${order} LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const data = employees.map((emp) => maskSensitiveEmployee(emp, req.user));

    res.json({
      success: true,
      data,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult[0].total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const scope = await scopeEmployeeList(req.user);
    let where = 'WHERE 1=1';
    const params = [...scope.params];
    if (scope.clause) where += ` ${scope.clause}`;

    const [employees] = await pool.query(`${employeeQuery} ${where}`, params);
    const columns = [
      { header: 'Employee ID', key: 'employee_id', width: 15 },
      { header: 'First Name', key: 'first_name', width: 20 },
      { header: 'Last Name', key: 'last_name', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Department', key: 'department_name', width: 20 },
      { header: 'Designation', key: 'designation', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Joining Date', key: 'joining_date', width: 15 },
    ];
    const buffer = await exportToExcel(employees, columns, 'Employees');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=employees.xlsx');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const empId = Number(req.params.id);
    const allowed = await canAccessEmployee(req.user, empId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }

    const [employees] = await pool.query(`${employeeQuery} WHERE e.id = ?`, [empId]);
    if (!employees.length) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const [attendance] = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 30',
      [empId]
    );
    const [leaves] = await pool.query(
      `SELECT lr.*, lt.name as leave_type_name FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id WHERE lr.employee_id = ? ORDER BY lr.created_at DESC`,
      [empId]
    );
    const [projects] = await pool.query(`
      SELECT p.*, pm.role as member_role FROM projects p
      JOIN project_members pm ON p.id = pm.project_id WHERE pm.employee_id = ?
    `, [empId]);
    const [documents] = await pool.query('SELECT * FROM documents WHERE employee_id = ?', [empId]);
    const [salary] = await pool.query(
      'SELECT * FROM salary_structures WHERE employee_id = ? ORDER BY effective_from DESC LIMIT 1',
      [empId]
    );

    const [teamMembers] = await pool.query(
      `SELECT e.id, e.first_name, e.last_name, u.employee_id, e.designation
       FROM employees e JOIN users u ON e.user_id = u.id
       WHERE e.reporting_manager_id = ?`,
      [empId]
    );

    res.json({
      success: true,
      data: {
        ...maskSensitiveEmployee(employees[0], req.user),
        attendance: isAdmin(req.user) || isHr(req.user) || empId === req.user.employeeId ? attendance : [],
        leaves,
        projects,
        documents: isAdmin(req.user) || isHr(req.user) || empId === req.user.employeeId ? documents : [],
        salary: isAdmin(req.user) || isHr(req.user) || empId === req.user.employeeId ? salary[0] || null : null,
        teamMembers,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    // Validate the full payload up front, before starting the transaction
    // or touching the DB, and before rolling forward with defaults for
    // anything missing (mirrors the mandatory-field rules on the frontend
    // "Add Employee" form).
    const validationErrors = validateEmployeePayload(req.body);
    if (validationErrors.length) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: validationErrors[0],
        errors: validationErrors,
      });
    }

    await connection.beginTransaction();

    const {
      employeeType = 'employee',
      email, firstName, lastName, phone, password,
      departmentId, designation, joiningDate, employmentType, reportingManagerId,
      dateOfBirth, gender, address, city, state, country, pincode,
      emergencyContactName, emergencyContactPhone,
      panNumber, aadharNumber,
      bankName, bankAccountNumber, bankIfsc, bankBranch, bankAccountHolder,
      basicSalary, hra, transportAllowance, medicalAllowance, specialAllowance,
      bonus, allowances, pfDeduction, taxDeduction, otherDeductions, deductions, ctc, netSalary,
      teamMemberIds = [],
    } = req.body;

    const role = mapEmployeeTypeToRole(employeeType);
    if (!canManageRole(req.user.role, role)) {
      return res.status(403).json({ success: false, message: 'You cannot create this employee type.' });
    }

    const [existingEmail] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length) {
      return res.status(400).json({ success: false, message: 'Email already exists.' });
    }
    if (panNumber) {
      const [dupPan] = await connection.query('SELECT id FROM employees WHERE pan_number = ?', [panNumber]);
      if (dupPan.length) {
        return res.status(400).json({ success: false, message: 'PAN number already exists.' });
      }
    }
    if (aadharNumber) {
      const [dupAadhaar] = await connection.query('SELECT id FROM employees WHERE aadhar_number = ?', [aadharNumber]);
      if (dupAadhaar.length) {
        return res.status(400).json({ success: false, message: 'Aadhaar number already exists.' });
      }
    }

    const employeeCode = await generateEmployeeCode(employeeType === 'team_lead' ? 'team_lead' : role);
    const plainPassword = password && String(password).trim() ? String(password).trim() : generateTempPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    console.log('[Employee] Creating user:', { email, role, employeeCode });

    const [userResult] = await connection.query(
      'INSERT INTO users (employee_id, email, password, role) VALUES (?, ?, ?, ?)',
      [employeeCode, email, hashedPassword, role]
    );

    const [empResult] = await connection.query(`
      INSERT INTO employees (user_id, first_name, last_name, phone, department_id, designation,
        joining_date, employment_type, reporting_manager_id, date_of_birth, gender, address, city, state, country, pincode,
        pan_number, aadhar_number, bank_name, bank_account_number, bank_ifsc, bank_branch, bank_account_holder,
        emergency_contact_name, emergency_contact_phone, employment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [
      userResult.insertId, firstName, lastName, phone || null, departmentId || null, designation || null,
      joiningDate || new Date().toISOString().split('T')[0], employmentType || 'full-time', reportingManagerId || null,
      dateOfBirth || null, gender || null, address || null, city || null, state || null, country || 'India', pincode || null,
      panNumber || null, aadharNumber || null, bankName || null, bankAccountNumber || null, bankIfsc || null,
      bankBranch || null, bankAccountHolder || null, emergencyContactName || null, emergencyContactPhone || null,
    ]);

    const newEmpId = empResult.insertId;

    if (role === 'team_lead' && Array.isArray(teamMemberIds) && teamMemberIds.length) {
      const placeholders = teamMemberIds.map(() => '?').join(',');
      await connection.query(
        `UPDATE employees SET reporting_manager_id = ? WHERE id IN (${placeholders}) AND (reporting_manager_id IS NULL OR reporting_manager_id = ?)`,
        [newEmpId, ...teamMemberIds, newEmpId]
      );
    }

    // CHANGED: bonus is now part of the "has salary data" check and is persisted,
    // along with net_salary (trusted from the client's live calculation, but
    // recomputed server-side as a fallback / integrity check).
    // Salary is now always required by validateEmployeePayload, so hasSalary
    // will always be true past that check — kept as a guard in case
    // validation is ever relaxed for a specific employee type.
    const hasSalary = basicSalary || ctc || hra || transportAllowance || medicalAllowance || specialAllowance || bonus || allowances;
    if (hasSalary) {
      const basic = Number(basicSalary) || Number(ctc) * 0.4 || 0;
      const hraVal = Number(hra) || (basic ? basic * 0.4 : 0);
      const transportVal = Number(transportAllowance) || 0;
      const medicalVal = Number(medicalAllowance) || 0;
      const specialVal = Number(specialAllowance ?? allowances) || 0;
      const bonusVal = Number(bonus) || 0;
      const pfVal = Number(pfDeduction) || 0;
      const taxVal = Number(taxDeduction) || 0;
      const otherDeductionVal = Number(otherDeductions ?? deductions) || 0;

      const computedNet = basic + hraVal + transportVal + medicalVal + specialVal + bonusVal
        - pfVal - taxVal - otherDeductionVal;
      const netVal = netSalary !== undefined && netSalary !== null && netSalary !== ''
        ? Number(netSalary)
        : computedNet;

      await connection.query(`
        INSERT INTO salary_structures (employee_id, basic_salary, hra, transport_allowance, medical_allowance,
          special_allowance, bonus, pf_deduction, tax_deduction, other_deductions, net_salary, effective_from)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newEmpId, basic, hraVal, transportVal, medicalVal, specialVal, bonusVal, pfVal, taxVal, otherDeductionVal,
        netVal, joiningDate || new Date().toISOString().split('T')[0],
      ]);
    }

    const year = new Date().getFullYear();
    await connection.query(`
      INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, year)
      SELECT ?, id, days_allowed, 0, ? FROM leave_types
    `, [newEmpId, year]);

    await connection.commit();
    console.log('[Employee] Created successfully:', { id: newEmpId, employeeCode });

    const emailResult = await sendWelcomeEmail({
      to: email,
      name: `${firstName} ${lastName}`,
      employeeId: employeeCode,
      tempPassword: plainPassword,
    });

    if (emailResult.skipped) {
      console.warn('[Employee] Welcome email skipped - SMTP not configured');
    } else if (!emailResult.success) {
      console.error('[Employee] Welcome email failed:', emailResult.error);
    } else {
      console.log('[Employee] Credential email sent successfully');
    }

    res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      id: newEmpId,
      employeeCode,
      emailSent: emailResult.success,
      emailMessage: emailResult.skipped ? 'Email not configured' : (emailResult.success ? 'Credentials sent' : emailResult.error),
      tempPassword: emailResult.skipped ? plainPassword : undefined,
    });
  } catch (error) {
    await connection.rollback();
    console.error('[Employee] Create failed:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email, PAN, or Aadhaar already exists.' });
    }
    next(error);
  } finally {
    connection.release();
  }
});

router.put('/:id/team', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const teamLeadId = Number(req.params.id);
    const { teamMemberIds = [] } = req.body;

    const [tl] = await pool.query(
      `SELECT e.id FROM employees e JOIN users u ON e.user_id = u.id WHERE e.id = ? AND u.role = 'team_lead'`,
      [teamLeadId]
    );
    if (!tl.length) {
      return res.status(404).json({ success: false, message: 'Team lead not found.' });
    }

    await pool.query('UPDATE employees SET reporting_manager_id = NULL WHERE reporting_manager_id = ?', [teamLeadId]);

    if (teamMemberIds.length) {
      const placeholders = teamMemberIds.map(() => '?').join(',');
      await pool.query(
        `UPDATE employees SET reporting_manager_id = ? WHERE id IN (${placeholders})`,
        [teamLeadId, ...teamMemberIds]
      );
    }

    res.json({ success: true, message: 'Team members assigned successfully.' });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const empId = Number(req.params.id);
    const allowed = await canAccessEmployee(req.user, empId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const role = normalizeRole(req.user.role);
    const isSelf = empId === Number(req.user.employeeId);
    const isManager = role === 'admin' || role === 'hr';

    if (!isSelf && !isManager) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }

    const fields = req.body;
    const adminFields = [
      'first_name', 'last_name', 'phone', 'department_id', 'designation', 'joining_date',
      'employment_type', 'reporting_manager_id', 'date_of_birth', 'gender', 'address',
      'city', 'state', 'country', 'pincode', 'bank_name', 'bank_account_number', 'bank_ifsc',
      'bank_branch', 'bank_account_holder', 'pan_number', 'aadhar_number',
      'emergency_contact_name', 'emergency_contact_phone', 'employment_status',
    ];
    const selfFields = [
      'first_name', 'last_name', 'phone', 'date_of_birth', 'gender', 'address',
      'city', 'state', 'country', 'pincode', 'emergency_contact_name', 'emergency_contact_phone',
    ];

    const allowedFields = isManager ? adminFields : selfFields;
    const updates = [];
    const values = [];
    allowedFields.forEach((key) => {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key] === '' ? null : fields[key]);
      }
    });

    if (updates.length) {
      values.push(empId);
      await pool.query(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    if (fields.role || fields.is_active !== undefined) {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, message: 'Only admin can change role or account status.' });
      }
      const [emp] = await pool.query('SELECT user_id FROM employees WHERE id = ?', [empId]);
      if (emp.length) {
        const userUpdates = [];
        const userValues = [];
        if (fields.role) {
          if (fields.role === 'admin') {
            return res.status(403).json({ success: false, message: 'Cannot assign admin role via employee update.' });
          }
          userUpdates.push('role = ?');
          userValues.push(fields.role);
        }
        if (fields.is_active !== undefined) {
          userUpdates.push('is_active = ?');
          userValues.push(fields.is_active);
          if (!fields.is_active) {
            await pool.query("UPDATE employees SET employment_status = 'INACTIVE' WHERE id = ?", [empId]);
          } else {
            await pool.query("UPDATE employees SET employment_status = 'ACTIVE' WHERE id = ?", [empId]);
          }
        }
        userValues.push(emp[0].user_id);
        await pool.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
      }
    }

    res.json({ success: true, message: 'Employee updated successfully.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reset-password', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const empId = Number(req.params.id);
    const [rows] = await pool.query(
      'SELECT u.id, u.email, e.first_name, e.last_name, u.employee_id FROM employees e JOIN users u ON e.user_id = u.id WHERE e.id = ?',
      [empId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, rows[0].id]);

    const emailResult = await sendWelcomeEmail({
      to: rows[0].email,
      name: `${rows[0].first_name} ${rows[0].last_name}`,
      employeeId: rows[0].employee_id,
      tempPassword,
    });

    res.json({
      success: true,
      message: 'Password reset successfully.',
      emailSent: emailResult.success,
      tempPassword: emailResult.skipped ? tempPassword : undefined,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/avatar', authenticate, upload.single('avatar'), async (req, res, next) => {
  try {
    const empId = Number(req.params.id);
    const allowed = await canAccessEmployee(req.user, empId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await pool.query('UPDATE employees SET avatar = ? WHERE id = ?', [avatarUrl, empId]);
    res.json({ success: true, avatar: avatarUrl });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const [emp] = await pool.query('SELECT user_id FROM employees WHERE id = ?', [req.params.id]);
    if (!emp.length) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [emp[0].user_id]);
    await pool.query("UPDATE employees SET employment_status = 'INACTIVE' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Employee deactivated successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;