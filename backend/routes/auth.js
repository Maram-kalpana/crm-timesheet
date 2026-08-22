const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { normalizeRole, generateEmployeeCode } = require('../middleware/rbac');
const { sendEmail } = require('../utils/emailService');
const { fetchCompanyByUserId, needsLocaleSetup } = require('../utils/company');

const router = express.Router();

router.get('/setup-status', async (req, res, next) => {
  try {
    const [[{ count }]] = await pool.query('SELECT COUNT(*) as count FROM users');
    res.json({ success: true, needsSetup: count === 0 });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM users');
    if (count > 0) {
      return res.status(403).json({ success: false, message: 'Admin account already exists. Please login.' });
    }

    const { firstName, lastName, email, password, employeeId, phone, companyName } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }

    const adminCode = employeeId || await generateEmployeeCode('admin');

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [leaveTypes] = await connection.query('SELECT id FROM leave_types');
    if (!leaveTypes.length) {
      await connection.query(`
        INSERT INTO leave_types (name, days_allowed, description, is_paid) VALUES
        ('Casual Leave', 12, 'Casual leave', TRUE),
        ('Sick Leave', 10, 'Medical leave', TRUE),
        ('Earned Leave', 15, 'Annual leave', TRUE)
      `);
    }

    let companyId = null;
    try {
      const [companyResult] = await connection.query(
        `INSERT INTO companies (name, email, phone, registration_number)
         VALUES (?, ?, ?, ?)`,
        [
          companyName || 'Company',
          email,
          phone || '0000000000',
          `SETUP-${Date.now()}`,
        ]
      );
      companyId = companyResult.insertId;
    } catch (companyErr) {
      if (companyErr.code !== 'ER_NO_SUCH_TABLE') throw companyErr;
    }

    const [deptResult] = await connection.query(
      'INSERT INTO departments (name, description, company_id) VALUES (?, ?, ?)',
      [companyName || 'Administration', 'Default department', companyId]
    );
    const departmentId = deptResult.insertId;

    const [userResult] = await connection.query(
      companyId
        ? 'INSERT INTO users (employee_id, email, password, role, company_id) VALUES (?, ?, ?, ?, ?)'
        : 'INSERT INTO users (employee_id, email, password, role) VALUES (?, ?, ?, ?)',
      companyId
        ? [adminCode, email, hashedPassword, 'admin', companyId]
        : [adminCode, email, hashedPassword, 'admin']
    );

    const [empResult] = await connection.query(`
      INSERT INTO employees (user_id, first_name, last_name, phone, department_id, designation, joining_date, employment_type, employment_status)
      VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'full-time', 'ACTIVE')
    `, [userResult.insertId, firstName, lastName, phone || null, departmentId, 'System Administrator']);

    const year = new Date().getFullYear();
    await connection.query(`
      INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, year)
      SELECT ?, id, days_allowed, 0, ? FROM leave_types WHERE id IN (1, 2, 3)
    `, [empResult.insertId, year]);

    await connection.commit();

    const token = jwt.sign(
      { id: userResult.insertId, email, role: 'admin', employeeId: empResult.insertId, companyId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { company } = await fetchCompanyByUserId(connection, userResult.insertId);

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully.',
      token,
      needsLocaleSetup: needsLocaleSetup('admin', company),
      user: {
        id: userResult.insertId,
        email,
        role: 'admin',
        employeeId: adminCode,
        empId: empResult.insertId,
        firstName,
        lastName,
        avatar: null,
        departmentId,
        designation: 'System Administrator',
        companyId,
        company,
      },
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email or Employee ID already exists.' });
    }
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/register-admin', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      name,
      companyName,
      companyEmail,
      phone,
      registrationNumber,
      password,
      confirmPassword,
    } = req.body;

    if (!name || !companyName || !companyEmail || !phone || !registrationNumber || !password) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const [dupEmail] = await connection.query(
      'SELECT id FROM companies WHERE email = ? UNION SELECT id FROM users WHERE email = ?',
      [companyEmail, companyEmail]
    );
    if (dupEmail.length) {
      return res.status(400).json({ success: false, message: 'Company email is already registered.' });
    }
    const [dupReg] = await connection.query(
      'SELECT id FROM companies WHERE registration_number = ?',
      [registrationNumber]
    );
    if (dupReg.length) {
      return res.status(400).json({ success: false, message: 'Registration number is already registered.' });
    }

    const nameParts = String(name).trim().split(/\s+/);
    const firstName = nameParts[0] || 'Admin';
    const lastName = nameParts.slice(1).join(' ') || 'User';
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminCode = await generateEmployeeCode('admin');

    const [companyResult] = await connection.query(
      `INSERT INTO companies (name, email, phone, registration_number)
       VALUES (?, ?, ?, ?)`,
      [companyName, companyEmail, phone, registrationNumber]
    );
    const companyId = companyResult.insertId;

    const [deptResult] = await connection.query(
      'INSERT INTO departments (name, description, company_id) VALUES (?, ?, ?)',
      [companyName, 'Default department', companyId]
    );
    const departmentId = deptResult.insertId;

    const [leaveTypes] = await connection.query('SELECT id FROM leave_types');
    if (!leaveTypes.length) {
      await connection.query(`
        INSERT INTO leave_types (name, days_allowed, description, is_paid) VALUES
        ('Casual Leave', 12, 'Casual leave', TRUE),
        ('Sick Leave', 10, 'Medical leave', TRUE),
        ('Earned Leave', 15, 'Annual leave', TRUE)
      `);
    }

    const [userResult] = await connection.query(
      'INSERT INTO users (employee_id, email, password, role, company_id) VALUES (?, ?, ?, ?, ?)',
      [adminCode, companyEmail, hashedPassword, 'admin', companyId]
    );

    const [empResult] = await connection.query(`
      INSERT INTO employees (user_id, first_name, last_name, phone, department_id, designation, joining_date, employment_type, employment_status)
      VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'full-time', 'ACTIVE')
    `, [userResult.insertId, firstName, lastName, phone, departmentId, 'System Administrator']);

    const year = new Date().getFullYear();
    await connection.query(`
      INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, year)
      SELECT ?, id, days_allowed, 0, ? FROM leave_types
    `, [empResult.insertId, year]);

    await connection.commit();

    const { company } = await fetchCompanyByUserId(connection, userResult.insertId);
    const token = jwt.sign(
      { id: userResult.insertId, email: companyEmail, role: 'admin', employeeId: empResult.insertId, companyId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Company registered successfully.',
      token,
      needsLocaleSetup: true,
      user: {
        id: userResult.insertId,
        email: companyEmail,
        role: 'admin',
        employeeId: adminCode,
        empId: empResult.insertId,
        firstName,
        lastName,
        avatar: null,
        departmentId,
        designation: 'System Administrator',
        companyId,
        company,
      },
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email or registration number already exists.' });
    }
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const [users] = await pool.query(
      `SELECT u.*, e.id as emp_id, e.first_name, e.last_name, e.avatar, e.department_id, e.designation, e.employment_status
       FROM users u LEFT JOIN employees e ON u.id = e.user_id WHERE u.email = ? AND u.is_active = TRUE`,
      [email]
    );

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];
    if (user.employment_status && !['ACTIVE', null].includes(user.employment_status) && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Account is inactive. Contact HR.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const normalizedRole = normalizeRole(user.role);
    const { companyId, company } = await fetchCompanyByUserId(pool, user.id);
    const localeSetupNeeded = needsLocaleSetup(normalizedRole, company);
    const expiresIn = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: normalizedRole, employeeId: user.emp_id, companyId },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    res.json({
      success: true,
      token,
      needsLocaleSetup: localeSetupNeeded,
      user: {
        id: user.id,
        email: user.email,
        role: normalizedRole,
        employeeId: user.employee_id,
        empId: user.emp_id,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
        departmentId: user.department_id,
        designation: user.designation,
        companyId,
        company,
        needsLocaleSetup: localeSetupNeeded,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.email, u.role, u.employee_id, e.id as emp_id, e.first_name, e.last_name,
              e.avatar, e.department_id, e.designation, e.phone, d.name as department_name
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];
    const role = normalizeRole(user.role);
    const { companyId, company } = await fetchCompanyByUserId(pool, user.id);
    const localeSetupNeeded = needsLocaleSetup(role, company);
    res.json({
      success: true,
      needsLocaleSetup: localeSetupNeeded,
      user: {
        id: user.id,
        email: user.email,
        role,
        employeeId: user.employee_id,
        empId: user.emp_id,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
        departmentId: user.department_id,
        departmentName: user.department_name,
        designation: user.designation,
        phone: user.phone,
        companyId,
        company,
        needsLocaleSetup: localeSetupNeeded,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    const [users] = await pool.query('SELECT id, email FROM users WHERE email = ?', [email]);
    if (!users.length) {
      return res.json({ success: true, message: 'If email exists, reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000);

    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [resetToken, expiry, users[0].id]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await sendEmail({
      to: email,
      subject: 'Password Reset - HRMS',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    });

    res.json({ success: true, message: 'If email exists, reset link has been sent.' });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const [users] = await pool.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );

    if (!users.length) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [hashedPassword, users[0].id]
    );

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
