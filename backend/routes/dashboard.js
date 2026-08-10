const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { getTeamMemberIds } = require('../middleware/rbac');

const router = express.Router();

router.get('/stats', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const [[{ totalEmployees }]] = await pool.query('SELECT COUNT(*) as totalEmployees FROM employees');
    const [[{ present }]] = await pool.query(
      "SELECT COUNT(*) as present FROM attendance WHERE date = ? AND status IN ('present', 'late')",
      [today]
    );
    const [[{ absent }]] = await pool.query(
      "SELECT COUNT(*) as absent FROM attendance WHERE date = ? AND status = 'absent'",
      [today]
    );
    const [[{ late }]] = await pool.query(
      "SELECT COUNT(*) as late FROM attendance WHERE date = ? AND status = 'late'",
      [today]
    );
    const [[{ pendingLeaves }]] = await pool.query(
      "SELECT COUNT(*) as pendingLeaves FROM leave_requests WHERE status = 'pending'"
    );
    const [[{ activeProjects }]] = await pool.query(
      "SELECT COUNT(*) as activeProjects FROM projects WHERE status = 'active'"
    );

    const [departmentStats] = await pool.query(`
      SELECT d.name, COUNT(e.id) as count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id
      GROUP BY d.id, d.name
    `);

    const [attendanceTrend] = await pool.query(`
      SELECT DATE(date) as date,
        SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late
      FROM attendance
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(date)
      ORDER BY date
    `);

    const [recentActivities] = await pool.query(`
      SELECT al.*, u.email, e.first_name, e.last_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN employees e ON e.user_id = u.id
      ORDER BY al.created_at DESC LIMIT 10
    `);

    const [recentJoinees] = await pool.query(`
      SELECT e.*, d.name as department_name, u.employee_id
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      ORDER BY e.joining_date DESC LIMIT 5
    `);

    const [announcements] = await pool.query(`
      SELECT * FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        stats: { totalEmployees, present, absent, late, pendingLeaves, activeProjects },
        departmentStats,
        attendanceTrend,
        recentActivities,
        recentJoinees,
        announcements,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/employee', authenticate, async (req, res, next) => {
  try {
    const empId = req.user.employeeId;
    const today = new Date().toISOString().split('T')[0];

    const [[attendance]] = await pool.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [empId, today]
    );

    const [leaveBalances] = await pool.query(`
      SELECT lb.*, lt.name as leave_type_name
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = ? AND lb.year = ?
    `, [empId, new Date().getFullYear()]);

    const [projects] = await pool.query(`
      SELECT p.* FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.employee_id = ? AND p.status = 'active'
      LIMIT 5
    `, [empId]);

    const [payslips] = await pool.query(
      'SELECT id, month, year, net_salary, status FROM payslips WHERE employee_id = ? ORDER BY year DESC, month DESC LIMIT 3',
      [empId]
    );

    const [announcements] = await pool.query(
      'SELECT * FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 5'
    );

    const [holidays] = await pool.query(
      'SELECT * FROM holidays WHERE date >= CURDATE() ORDER BY date LIMIT 5'
    );

    const [monthlyAttendance] = await pool.query(`
      SELECT date, status, working_hours FROM attendance
      WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
      ORDER BY date
    `, [empId, new Date().getMonth() + 1, new Date().getFullYear()]);

    res.json({
      success: true,
      data: {
        todayAttendance: attendance || null,
        leaveBalances,
        projects,
        payslips,
        announcements,
        holidays,
        monthlyAttendance,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/team-lead', authenticate, authorize('team_lead'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const teamLeadId = Number(req.user.employeeId);
    const teamIds = await getTeamMemberIds(teamLeadId);
    const allIds = [teamLeadId, ...teamIds];

    const [[{ teamSize }]] = await pool.query(
      `SELECT COUNT(*) as teamSize FROM employees WHERE id IN (${allIds.map(() => '?').join(',')})`,
      allIds
    );

    const [[{ present }]] = await pool.query(
      `SELECT COUNT(*) as present FROM attendance WHERE date = ? AND employee_id IN (${allIds.map(() => '?').join(',')}) AND status IN ('present','late')`,
      [today, ...allIds]
    );

    const [[{ absent }]] = await pool.query(
      `SELECT COUNT(*) as absent FROM employees e
       WHERE e.id IN (${allIds.map(() => '?').join(',')})
       AND e.id NOT IN (SELECT employee_id FROM attendance WHERE date = ? AND status IN ('present','late'))`,
      [...allIds, today]
    );

    const [[{ late }]] = await pool.query(
      `SELECT COUNT(*) as late FROM attendance WHERE date = ? AND employee_id IN (${allIds.map(() => '?').join(',')}) AND status = 'late'`,
      [today, ...allIds]
    );

    const [[{ pendingLeaves }]] = teamIds.length
      ? await pool.query(
        `SELECT COUNT(*) as pendingLeaves FROM leave_requests WHERE employee_id IN (${teamIds.map(() => '?').join(',')}) AND status = 'pending'`,
        teamIds
      )
      : [[{ pendingLeaves: 0 }]];

    const [teamMembers] = await pool.query(`
      SELECT e.id, e.first_name, e.last_name, u.employee_id, e.avatar, e.designation,
        a.status as attendance_status, a.clock_in, a.working_hours
      FROM employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = ?
      WHERE e.id IN (${allIds.map(() => '?').join(',')})
    `, [today, ...allIds]);

    res.json({
      success: true,
      data: {
        stats: { teamSize, present, absent, late, pendingLeaves },
        teamMembers,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
