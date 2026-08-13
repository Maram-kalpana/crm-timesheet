const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotificationForUser } = require('../utils/notify');
const { sendTimesheetEmail, isEmailConfigured } = require('../utils/emailService');
const { generateTimesheetExcel } = require('../utils/excel');

const router = express.Router();

const TIMESHEET_SELECT = `
  SELECT t.*,
         e.first_name, e.last_name,
         u.employee_id AS emp_code,
         d.name AS department_name
  FROM timesheets t
  JOIN employees e ON t.employee_id = e.id
  JOIN users u ON e.user_id = u.id
  LEFT JOIN departments d ON e.department_id = d.id
`;

async function getEntries(timesheetId) {
  const [rows] = await pool.query(
    'SELECT * FROM timesheet_entries WHERE timesheet_id = ? ORDER BY sort_order, id',
    [timesheetId]
  );
  return rows;
}

function mapTimesheet(row, entries) {
  return {
    ...row,
    rows: entries.map((e) => ({
      date: e.entry_date ? formatDisplayDate(e.entry_date) : '',
      entryDate: e.entry_date,
      day: e.day_name || '',
      task: e.task_description || '',
      hrs: e.hours,
    })),
  };
}

function formatDisplayDate(dateVal) {
  if (!dateVal) return '';
  const str = typeof dateVal === 'string'
    ? dateVal.split('T')[0]
    : dateVal.toISOString().split('T')[0];
  const [y, m, d] = str.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(-2)}`;
}

router.get('/', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${TIMESHEET_SELECT} ORDER BY t.submitted_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/my', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${TIMESHEET_SELECT} WHERE t.employee_id = ? ORDER BY t.submitted_at DESC`,
      [req.user.employeeId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/export-excel', authenticate, async (req, res, next) => {
  try {
    const payload = req.body;
    if (!Array.isArray(payload.rows) || !payload.rows.length) {
      return res.status(400).json({ success: false, message: 'Timesheet rows are required.' });
    }

    const { buffer, filename } = await generateTimesheetExcel(payload);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

router.post('/send-mail', authenticate, async (req, res, next) => {
  try {
    const {
      from,
      to,
      cc,
      subject,
      body,
      employeeName,
      employeeId,
      client,
      managerName,
      rateType,
      rateValue,
      periodType,
      periodLabel,
      periodStart,
      periodEnd,
      rows,
    } = req.body;

    if (!from || !to || !body) {
      return res.status(400).json({ success: false, message: 'From, To, and Body are required.' });
    }
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ success: false, message: 'Timesheet rows are required.' });
    }

    const excelPayload = {
      employeeName,
      employeeId,
      client,
      managerName,
      rateType,
      rateValue,
      periodType,
      periodLabel,
      periodStart,
      periodEnd,
      rows,
    };

    const { buffer, filename } = await generateTimesheetExcel(excelPayload);
    const mailSubject = subject || `Timesheet - ${periodLabel || employeeName || 'Submission'}`;

    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Email service is not configured. Download the Excel file and use your mail client.',
        useMailClient: true,
        filename,
      });
    }

    const result = await sendTimesheetEmail({
      from,
      to,
      cc: cc || undefined,
      subject: mailSubject,
      body,
      attachmentBuffer: buffer,
      filename,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to send email.',
      });
    }

    res.json({ success: true, message: 'Timesheet emailed successfully.' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${TIMESHEET_SELECT} WHERE t.id = ?`, [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Timesheet not found.' });
    }

    const timesheet = rows[0];
    const isAdmin = ['admin', 'hr'].includes(req.user.role);
    if (!isAdmin && timesheet.employee_id !== req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const entries = await getEntries(timesheet.id);
    res.json({ success: true, data: mapTimesheet(timesheet, entries) });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    if (['admin', 'hr'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Admins cannot submit timesheets.' });
    }

    const empId = req.user.employeeId;
    const {
      client,
      managerName,
      rateType,
      rateValue,
      periodType,
      periodStart,
      periodEnd,
      periodLabel,
      rows,
    } = req.body;

    if (!periodType || !periodStart || !periodEnd || !Array.isArray(rows) || !rows.length) {
      return res.status(400).json({
        success: false,
        message: 'Period and at least one timesheet row are required.',
      });
    }

    const rate = parseFloat(rateValue) || 0;
    const totalHours = rows.reduce((sum, r) => sum + (parseFloat(r.hrs) || 0), 0);
    const totalWage = totalHours * rate;

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO timesheets
        (employee_id, client, manager_name, rate_type, rate_value, period_type,
         period_start, period_end, period_label, total_hours, total_wage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empId,
        client || null,
        managerName || null,
        rateType || 'Hourly',
        rate,
        periodType,
        periodStart,
        periodEnd,
        periodLabel || null,
        totalHours,
        totalWage,
      ]
    );

    const timesheetId = result.insertId;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      await connection.query(
        `INSERT INTO timesheet_entries
          (timesheet_id, entry_date, day_name, task_description, hours, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          timesheetId,
          row.entryDate || null,
          row.day || null,
          row.task || null,
          parseFloat(row.hrs) || 0,
          i,
        ]
      );
    }

    await connection.commit();

    const [admins] = await connection.query(
      "SELECT id FROM users WHERE role IN ('admin', 'hr') AND is_active = TRUE"
    );
    for (const admin of admins) {
      await createNotificationForUser(
        admin.id,
        'New Timesheet Submitted',
        'An employee submitted a timesheet for review.',
        'payroll',
        '/payroll'
      );
    }

    res.status(201).json({ success: true, message: 'Timesheet submitted.', id: timesheetId });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;
