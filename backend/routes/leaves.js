const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { normalizeRole, canAccessEmployee, isAdmin, isHr, isTeamLead, getTeamMemberIds } = require('../middleware/rbac');
const { sendLeaveNotification } = require('../utils/emailService');
const { notifyEmployeeByEmpId } = require('../utils/notify');
const { createNotification } = require('./notifications');
const dayjs = require('dayjs');

const router = express.Router();

const notifyLeaveEmployee = async (leaveId, status) => {
  try {
    const [rows] = await pool.query(`
      SELECT lr.employee_id, lt.name as leave_type_name, e.first_name, e.last_name, u.email
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE lr.id = ?
    `, [leaveId]);
    if (!rows.length) return;
    const row = rows[0];
    await notifyEmployeeByEmpId(
      row.employee_id,
      `Leave ${status}`,
      `Your ${row.leave_type_name} leave request has been ${status}.`,
      status === 'approved' ? 'success' : 'warning',
      '/leave'
    );
    await sendLeaveNotification({
      to: row.email,
      name: `${row.first_name} ${row.last_name}`,
      status,
      leaveType: row.leave_type_name,
    });
  } catch (err) {
    console.error('[Leave] Notification failed:', err.message);
  }
};

router.get('/types', authenticate, async (req, res, next) => {
  try {
    const [types] = await pool.query('SELECT * FROM leave_types');
    res.json({ success: true, data: types });
  } catch (error) {
    next(error);
  }
});

router.get('/balances', authenticate, async (req, res, next) => {
  try {
    let empId = req.user.employeeId;
    if (req.query.employeeId) {
      const targetId = Number(req.query.employeeId);
      const allowed = await canAccessEmployee(req.user, targetId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
      empId = targetId;
    }
    const year = req.query.year || new Date().getFullYear();
    const [balances] = await pool.query(`
      SELECT lb.*, lt.name as leave_type_name, lt.is_paid
      FROM leave_balances lb JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = ? AND lb.year = ?
    `, [empId, year]);
    res.json({ success: true, data: balances });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, employeeId, page = 1, limit = 10 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    const role = normalizeRole(req.user.role);

    if (role === 'employee') {
      where += ' AND lr.employee_id = ?';
      params.push(req.user.employeeId);
    } else if (role === 'hr') {
      where += ' AND lr.employee_id = ?';
      params.push(req.user.employeeId);
    } else if (role === 'team_lead') {
      const teamIds = await getTeamMemberIds(Number(req.user.employeeId));
      const ids = [Number(req.user.employeeId), ...teamIds];
      where += ` AND lr.employee_id IN (${ids.map(() => '?').join(',')})`;
      params.push(...ids);
    } else if (employeeId) {
      const allowed = await canAccessEmployee(req.user, Number(employeeId));
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
      where += ' AND lr.employee_id = ?';
      params.push(employeeId);
    }
    if (status) { where += ' AND lr.status = ?'; params.push(status); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [requests] = await pool.query(`
      SELECT lr.*, lt.name as leave_type_name, e.first_name, e.last_name, e.avatar,
             u.employee_id, d.name as department_name,
             CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN employees a ON lr.approved_by = a.id
      ${where}
      ORDER BY lr.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM leave_requests lr ${where}`,
      params
    );

    res.json({ success: true, data: requests, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    let empId = req.user.employeeId;
    if (req.query.employeeId) {
      const targetId = Number(req.query.employeeId);
      const allowed = await canAccessEmployee(req.user, targetId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
      empId = targetId;
    }
    const year = new Date().getFullYear();

    const [stats] = await pool.query(`
      SELECT lt.name, lb.total_days, lb.used_days, (lb.total_days - lb.used_days) as remaining,
        (SELECT COUNT(*) FROM leave_requests lr WHERE lr.employee_id = ? AND lr.leave_type_id = lt.id AND lr.status = 'approved' AND YEAR(lr.start_date) = ?) as approved_count
      FROM leave_balances lb JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = ? AND lb.year = ?
    `, [empId, year, empId, year]);

    const [calendar] = await pool.query(`
      SELECT start_date, end_date, status, lt.name as leave_type
      FROM leave_requests lr JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.employee_id = ? AND lr.status IN ('approved', 'pending') AND YEAR(start_date) = ?
    `, [empId, year]);

    res.json({ success: true, data: { stats, calendar } });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const [requests] = await pool.query(`
      SELECT lr.*, lt.name as leave_type_name, e.first_name, e.last_name, u.employee_id
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE lr.id = ?
    `, [req.params.id]);

    if (!requests.length) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const allowed = await canAccessEmployee(req.user, requests[0].employee_id);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const [history] = await pool.query(`
      SELECT lsh.*, CONCAT(e.first_name, ' ', e.last_name) as changed_by_name
      FROM leave_status_history lsh
      LEFT JOIN employees e ON lsh.changed_by = e.id
      WHERE lsh.leave_request_id = ? ORDER BY lsh.created_at
    `, [req.params.id]);

    res.json({ success: true, data: { ...requests[0], history } });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const empId = req.user.employeeId;
    const { leaveTypeId, startDate, endDate, reason } = req.body;

    const days = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
    if (days <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid date range.' });
    }

    const [balance] = await connection.query(
      'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
      [empId, leaveTypeId, new Date().getFullYear()]
    );

    if (balance.length && (balance[0].total_days - balance[0].used_days) < days) {
      return res.status(400).json({ success: false, message: 'Insufficient leave balance.' });
    }

    const [result] = await connection.query(
      'INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [empId, leaveTypeId, startDate, endDate, days, reason]
    );

    await connection.query(
      'INSERT INTO leave_status_history (leave_request_id, status, changed_by) VALUES (?, ?, ?)',
      [result.insertId, 'pending', empId]
    );

    await connection.commit();

    const requesterRole = normalizeRole(req.user.role);
    if (requesterRole === 'hr') {
      const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE");
      for (const admin of admins) {
        await createNotification(
          admin.id,
          'HR Leave Request',
          'An HR team member has submitted a leave request pending your approval.',
          'leave',
          '/leave'
        );
      }
    }

    res.status(201).json({ success: true, message: 'Leave request submitted.', id: result.insertId });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.put('/:id/approve', authenticate, authorize('admin', 'hr', 'manager', 'team_lead'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [requests] = await connection.query('SELECT * FROM leave_requests WHERE id = ? AND status = ?', [req.params.id, 'pending']);
    if (!requests.length) {
      return res.status(404).json({ success: false, message: 'Pending leave request not found.' });
    }

    const leave = requests[0];
    const role = normalizeRole(req.user.role);
    if (role === 'hr') {
      return res.status(403).json({ success: false, message: 'HR leave requests must be approved by admin.' });
    }
    if (role === 'team_lead') {
      const teamIds = await getTeamMemberIds(Number(req.user.employeeId));
      if (!teamIds.includes(Number(leave.employee_id))) {
        return res.status(403).json({ success: false, message: 'You can only approve leaves for your team.' });
      }
    }
    await connection.query(
      'UPDATE leave_requests SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
      ['approved', req.user.employeeId, req.params.id]
    );

    await connection.query(
      'UPDATE leave_balances SET used_days = used_days + ? WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
      [leave.days, leave.employee_id, leave.leave_type_id, new Date().getFullYear()]
    );

    await connection.query(
      'INSERT INTO leave_status_history (leave_request_id, status, changed_by, comment) VALUES (?, ?, ?, ?)',
      [req.params.id, 'approved', req.user.employeeId, req.body.comment || 'Approved']
    );

    await connection.commit();
    await notifyLeaveEmployee(req.params.id, 'approved');
    res.json({ success: true, message: 'Leave approved.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.put('/:id/reject', authenticate, authorize('admin', 'hr', 'manager', 'team_lead'), async (req, res, next) => {
  try {
    const [requests] = await pool.query('SELECT * FROM leave_requests WHERE id = ? AND status = ?', [req.params.id, 'pending']);
    if (!requests.length) {
      return res.status(404).json({ success: false, message: 'Pending leave request not found.' });
    }

    const role = normalizeRole(req.user.role);
    if (role === 'hr') {
      return res.status(403).json({ success: false, message: 'HR leave requests must be rejected by admin.' });
    }
    if (role === 'team_lead') {
      const teamIds = await getTeamMemberIds(Number(req.user.employeeId));
      if (!teamIds.includes(Number(requests[0].employee_id))) {
        return res.status(403).json({ success: false, message: 'You can only reject leaves for your team.' });
      }
    }

    const { reason } = req.body;
    await pool.query(
      'UPDATE leave_requests SET status = ?, approved_by = ?, approved_at = NOW(), rejection_reason = ? WHERE id = ? AND status = ?',
      ['rejected', req.user.employeeId, reason, req.params.id, 'pending']
    );
    await pool.query(
      'INSERT INTO leave_status_history (leave_request_id, status, changed_by, comment) VALUES (?, ?, ?, ?)',
      [req.params.id, 'rejected', req.user.employeeId, reason]
    );
    await notifyLeaveEmployee(req.params.id, 'rejected');
    res.json({ success: true, message: 'Leave rejected.' });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const [requests] = await pool.query(
      'SELECT * FROM leave_requests WHERE id = ? AND employee_id = ? AND status = ?',
      [req.params.id, req.user.employeeId, 'pending']
    );
    if (!requests.length) {
      return res.status(404).json({ success: false, message: 'Leave request not found or cannot be cancelled.' });
    }
    await pool.query('UPDATE leave_requests SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    await pool.query(
      'INSERT INTO leave_status_history (leave_request_id, status, changed_by) VALUES (?, ?, ?)',
      [req.params.id, 'cancelled', req.user.employeeId]
    );
    res.json({ success: true, message: 'Leave request cancelled.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
