const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { exportToExcel } = require('../utils/excel');

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

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, department, status, page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

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

    res.json({
      success: true,
      data: employees,
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
    const [employees] = await pool.query(employeeQuery);
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
    const [employees] = await pool.query(`${employeeQuery} WHERE e.id = ?`, [req.params.id]);
    if (!employees.length) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const empId = req.params.id;
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

    res.json({
      success: true,
      data: {
        ...employees[0],
        attendance,
        leaves,
        projects,
        documents,
        salary: salary[0] || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      employeeId, email, password, role, firstName, lastName, phone,
      departmentId, designation, joiningDate, employmentType, reportingManagerId,
      dateOfBirth, gender, address, city, state, country, pincode,
    } = req.body;

    const hashedPassword = await bcrypt.hash(password || 'Welcome@123', 10);
    const [userResult] = await connection.query(
      'INSERT INTO users (employee_id, email, password, role) VALUES (?, ?, ?, ?)',
      [employeeId, email, hashedPassword, role || 'employee']
    );

    const [empResult] = await connection.query(`
      INSERT INTO employees (user_id, first_name, last_name, phone, department_id, designation,
        joining_date, employment_type, reporting_manager_id, date_of_birth, gender, address, city, state, country, pincode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userResult.insertId, firstName, lastName, phone, departmentId, designation,
      joiningDate, employmentType || 'full-time', reportingManagerId || null,
      dateOfBirth, gender, address, city, state, country || 'India', pincode,
    ]);

    const year = new Date().getFullYear();
    await connection.query(`
      INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, year)
      SELECT ?, id, days_allowed, 0, ? FROM leave_types WHERE id IN (1,2,3)
    `, [empResult.insertId, year]);

    await connection.commit();
    res.status(201).json({ success: true, message: 'Employee created successfully.', id: empResult.insertId });
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

router.put('/:id', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const fields = req.body;
    const allowed = [
      'first_name', 'last_name', 'phone', 'department_id', 'designation', 'joining_date',
      'employment_type', 'reporting_manager_id', 'date_of_birth', 'gender', 'address',
      'city', 'state', 'country', 'pincode', 'bank_name', 'bank_account_number', 'bank_ifsc',
      'pan_number', 'aadhar_number', 'emergency_contact_name', 'emergency_contact_phone',
    ];

    const updates = [];
    const values = [];
    allowed.forEach((key) => {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    });

    if (updates.length) {
      values.push(req.params.id);
      await pool.query(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    if (fields.role || fields.is_active !== undefined) {
      const [emp] = await pool.query('SELECT user_id FROM employees WHERE id = ?', [req.params.id]);
      if (emp.length) {
        const userUpdates = [];
        const userValues = [];
        if (fields.role) { userUpdates.push('role = ?'); userValues.push(fields.role); }
        if (fields.is_active !== undefined) { userUpdates.push('is_active = ?'); userValues.push(fields.is_active); }
        userValues.push(emp[0].user_id);
        await pool.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
      }
    }

    res.json({ success: true, message: 'Employee updated successfully.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/avatar', authenticate, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await pool.query('UPDATE employees SET avatar = ? WHERE id = ?', [avatarUrl, req.params.id]);
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
    res.json({ success: true, message: 'Employee deactivated successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
