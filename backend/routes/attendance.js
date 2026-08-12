const express = require('express');
const dayjs = require('dayjs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { normalizeRole, canAccessEmployee, isAdmin, isHr, isTeamLead, getTeamMemberIds } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { exportToExcel } = require('../utils/excel');

const router = express.Router();

router.post('/clock-in', authenticate, upload.single('selfie'), async (req, res, next) => {
  try {
    if (normalizeRole(req.user.role) === 'admin') {
      return res.status(403).json({ success: false, message: 'Admins cannot clock in or out.' });
    }
    const empId = req.user.employeeId;
    if (!empId) {
      return res.status(400).json({ success: false, message: 'Employee profile not found.' });
    }

    const today = dayjs().format('YYYY-MM-DD');
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const { location } = req.body;
    const selfieUrl = req.file ? `/uploads/selfies/${req.file.filename}` : null;

    const [existing] = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [empId, today]
    );

    if (existing.length && existing[0].clock_in) {
      return res.status(400).json({ success: false, message: 'Already clocked in today.' });
    }

    const clockInTime = dayjs(now);
    const status = clockInTime.hour() > 9 || (clockInTime.hour() === 9 && clockInTime.minute() > 15) ? 'late' : 'present';

    if (existing.length) {
      await pool.query(
        'UPDATE attendance SET clock_in = ?, status = ?, location = ?, selfie_url = ? WHERE id = ?',
        [now, status, location, selfieUrl, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO attendance (employee_id, date, clock_in, status, location, selfie_url) VALUES (?, ?, ?, ?, ?, ?)',
        [empId, today, now, status, location, selfieUrl]
      );
    }

    res.json({ success: true, message: 'Clocked in successfully.', status, clockIn: now });
  } catch (error) {
    next(error);
  }
});

router.post('/clock-out', authenticate, upload.single('selfie'), async (req, res, next) => {
  try {
    if (normalizeRole(req.user.role) === 'admin') {
      return res.status(403).json({ success: false, message: 'Admins cannot clock in or out.' });
    }
    const empId = req.user.employeeId;
    const today = dayjs().format('YYYY-MM-DD');
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const { location } = req.body;
    const selfieUrl = req.file ? `/uploads/selfies/${req.file.filename}` : null;

    const [existing] = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [empId, today]
    );

    if (!existing.length || !existing[0].clock_in) {
      return res.status(400).json({ success: false, message: 'Please clock in first.' });
    }
    if (existing[0].clock_out) {
      return res.status(400).json({ success: false, message: 'Already clocked out today.' });
    }

    const clockIn = dayjs(existing[0].clock_in);
    const clockOut = dayjs(now);
    const workingHours = clockOut.diff(clockIn, 'minute') / 60;

    await pool.query(
      'UPDATE attendance SET clock_out = ?, working_hours = ?, clock_out_location = ?, clock_out_selfie_url = ? WHERE id = ?',
      [now, workingHours.toFixed(2), location, selfieUrl, existing[0].id]
    );

    res.json({
      success: true,
      message: 'Clocked out successfully.',
      clockOut: now,
      workingHours: workingHours.toFixed(2),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/today', authenticate, async (req, res, next) => {
  try {
    const empId = req.user.employeeId;
    const today = dayjs().format('YYYY-MM-DD');
    const [attendance] = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [empId, today]
    );
    res.json({ success: true, data: attendance[0] || null });
  } catch (error) {
    next(error);
  }
});

router.get('/history', authenticate, async (req, res, next) => {
  try {
    let empId = req.user.employeeId;
    if (req.query.employeeId) {
      const targetId = Number(req.query.employeeId);
      const allowed = await canAccessEmployee(req.user, targetId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
      }
      empId = targetId;
    }
    const { month, year, page = 1, limit = 31 } = req.query;
    const m = month || dayjs().month() + 1;
    const y = year || dayjs().year();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ?';
    const params = [empId, m, y];

    const [records] = await pool.query(
      `SELECT * FROM attendance ${where} ORDER BY date DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM attendance ${where}`,
      params
    );

    res.json({ success: true, data: records, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    next(error);
  }
});

router.get('/calendar/:employeeId/:year/:month', authenticate, async (req, res, next) => {
  try {
    const { employeeId, year, month } = req.params;
    const allowed = await canAccessEmployee(req.user, Number(employeeId));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    const [records] = await pool.query(
      'SELECT date, status, clock_in, clock_out, working_hours FROM attendance WHERE employee_id = ? AND YEAR(date) = ? AND MONTH(date) = ?',
      [employeeId, year, month]
    );
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

router.get('/all', authenticate, authorize('admin', 'hr', 'manager', 'team_lead'), async (req, res, next) => {
  try {
    const { date, status, department, search, month, year, page = 1, limit = 100 } = req.query;
    const m = month ? parseInt(month, 10) : dayjs().month() + 1;
    const y = year ? parseInt(year, 10) : dayjs().year();

    let where = 'WHERE MONTH(a.date) = ? AND YEAR(a.date) = ?';
    const params = [m, y];

    const role = normalizeRole(req.user.role);
    if (role === 'team_lead') {
      const teamIds = await getTeamMemberIds(Number(req.user.employeeId));
      const ids = [Number(req.user.employeeId), ...teamIds];
      if (ids.length) {
        where += ` AND a.employee_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    } else if (role === 'hr') {
      where += " AND u.role != 'admin'";
    }

    if (date) {
      where += ' AND a.date = ?';
      params.push(date);
    }
    if (status) { where += ' AND a.status = ?'; params.push(status); }
    if (department) { where += ' AND e.department_id = ?'; params.push(department); }
    if (search) {
      where += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR u.employee_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [records] = await pool.query(`
      SELECT a.*, e.first_name, e.last_name, e.avatar, u.employee_id, d.name as department_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      ${where}
      ORDER BY a.date DESC, a.clock_in DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), offset]);

    const [[{ total }]] = await pool.query(`
      SELECT COUNT(*) as total FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      ${where}
    `, params);

    res.json({ success: true, data: records, pagination: { total, page: parseInt(page, 10), limit: parseInt(limit, 10), month: m, year: y } });
  } catch (error) {
    next(error);
  }
});

router.get('/export', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const m = month || dayjs().month() + 1;
    const y = year || dayjs().year();

    const [records] = await pool.query(`
      SELECT u.employee_id, e.first_name, e.last_name, a.date, a.clock_in, a.clock_out,
             a.status, a.working_hours, d.name as department
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE MONTH(a.date) = ? AND YEAR(a.date) = ? AND u.role != 'admin'
      ORDER BY a.date, e.first_name
    `, [m, y]);

    const columns = [
      { header: 'Employee ID', key: 'employee_id' },
      { header: 'Name', key: 'first_name' },
      { header: 'Date', key: 'date' },
      { header: 'Clock In', key: 'clock_in' },
      { header: 'Clock Out', key: 'clock_out' },
      { header: 'Status', key: 'status' },
      { header: 'Hours', key: 'working_hours' },
      { header: 'Department', key: 'department' },
    ];
    const buffer = await exportToExcel(records, columns, 'Attendance');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;