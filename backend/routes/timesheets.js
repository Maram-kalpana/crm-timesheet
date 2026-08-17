const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { canViewAllTimesheets, canSendClientBilling } = require('../middleware/rbac');
const { createNotificationForUser } = require('../utils/notify');
const {
  sendTimesheetEmail,
  sendClientTimesheetEmail,
  sendCombinedClientBillingEmail,
  buildClientTimesheetHtml,
  isEmailConfigured,
} = require('../utils/emailService');
const { generateClientTimesheetExcel } = require('../utils/excel');

const router = express.Router();

const TIMESHEET_SELECT = `
  SELECT t.*,
         e.first_name, e.last_name,
         u.employee_id AS emp_code,
         d.name AS department_name,
         su.email AS sent_by_email
  FROM timesheets t
  JOIN employees e ON t.employee_id = e.id
  JOIN users u ON e.user_id = u.id
  LEFT JOIN departments d ON e.department_id = d.id
  LEFT JOIN users su ON t.sent_by_user_id = su.id
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
      comments: e.comments || '',
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

function toTimesheetEmailPayload(row, entries) {
  const mapped = mapTimesheet(row, entries);
  return {
    employeeName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    employeeId: row.emp_code || '',
    client: row.client || '',
    managerName: row.manager_name || '',
    rateType: row.rate_type,
    rateValue: row.rate_value,
    periodType: row.period_type,
    periodLabel: row.period_label || '',
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalHrs: row.total_hours,
    totalWage: row.total_wage,
    rows: mapped.rows,
  };
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    if (!canViewAllTimesheets(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
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

    const { buffer, filename } = await generateClientTimesheetExcel(payload);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

/** Employee send-mail — client reference format only (no wages in email body). */
router.post('/send-mail', authenticate, async (req, res, next) => {
  try {
    const {
      from,
      to,
      cc,
      subject,
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

    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'From and To are required.' });
    }
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ success: false, message: 'Timesheet rows are required.' });
    }

    const emailPayload = {
      employeeName,
      employeeId,
      client,
      managerName,
      periodType,
      periodLabel,
      rows: rows.map((r) => ({
        date: r.date,
        day: r.day,
        hrs: r.hrs,
        comments: r.comments || '',
      })),
    };

    const mailSubject = subject || `Timesheet - ${periodLabel || employeeName || 'Submission'}`;

    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Email service is not configured. Download the Excel file and use your mail client.',
        useMailClient: true,
      });
    }

    const result = await sendClientTimesheetEmail({
      from,
      to,
      cc: cc || undefined,
      subject: mailSubject,
      timesheetData: emailPayload,
      includeBilling: false,
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

/** Accountant/Admin — send billing to client and mark timesheets as sent. */
router.post('/send-to-client', authenticate, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    if (!canSendClientBilling(req.user)) {
      connection.release();
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const { timesheetIds, clientEmail, cc, subject, rateOverrides } = req.body;
    if (!Array.isArray(timesheetIds) || !timesheetIds.length) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Select at least one timesheet.' });
    }
    if (!clientEmail) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Client email is required.' });
    }

    // Map of timesheetId -> overridden rate, sent by the accountant from
    // the "Send to Client" modal. Falls back to the stored rate_value
    // per timesheet when no override (or an invalid one) is provided.
    const overrideMap = new Map();
    if (Array.isArray(rateOverrides)) {
      rateOverrides.forEach((o) => {
        if (o && o.timesheetId != null) {
          const rate = parseFloat(o.rateValue);
          if (!Number.isNaN(rate) && rate >= 0) {
            overrideMap.set(String(o.timesheetId), rate);
          }
        }
      });
    }

    const placeholders = timesheetIds.map(() => '?').join(',');
    const [rows] = await connection.query(
      `${TIMESHEET_SELECT} WHERE t.id IN (${placeholders})`,
      timesheetIds
    );

    if (!rows.length) {
      connection.release();
      return res.status(404).json({ success: false, message: 'Timesheets not found.' });
    }

    const alreadySent = rows.filter((r) => r.sent_to_client_at);
    if (alreadySent.length) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Timesheet(s) already sent to client: ${alreadySent.map((r) => r.id).join(', ')}`,
      });
    }

    const timesheetPayloads = [];
    for (const row of rows) {
      const entries = await getEntries(row.id);
      const payload = toTimesheetEmailPayload(row, entries);

      const override = overrideMap.get(String(row.id));
      if (override !== undefined) {
        const hrs = parseFloat(payload.totalHrs) || 0;
        payload.rateValue = override;
        payload.totalWage = hrs * override;
      }

      timesheetPayloads.push({ ...payload, _id: row.id });
    }

    const client = rows[0].client || '';
    const periodLabel = rows[0].period_label || '';
    const totalAmount = timesheetPayloads.reduce((sum, ts) => sum + (parseFloat(ts.totalWage) || 0), 0);

    if (!isEmailConfigured()) {
      connection.release();
      return res.status(503).json({
        success: false,
        message: 'Email service is not configured.',
      });
    }

    const [userRows] = await connection.query('SELECT email FROM users WHERE id = ?', [req.user.id]);
    const from = userRows[0]?.email || process.env.SMTP_FROM || process.env.EMAIL_FROM;

    const result = timesheetPayloads.length === 1
      ? await sendClientTimesheetEmail({
        from,
        to: clientEmail,
        cc: cc || undefined,
        subject: subject || `Timesheet - ${periodLabel || client}`,
        timesheetData: {
          ...timesheetPayloads[0],
          rateValue: timesheetPayloads[0].rateValue,
          totalWage: timesheetPayloads[0].totalWage,
        },
        includeBilling: true,
      })
      : await sendCombinedClientBillingEmail({
        from,
        to: clientEmail,
        cc: cc || undefined,
        subject: subject || `Timesheet Invoice - ${client} - ${periodLabel}`,
        client,
        periodLabel,
        timesheets: timesheetPayloads.map((ts) => ({
          employeeName: ts.employeeName,
          employeeId: ts.employeeId,
          totalHours: ts.totalHrs,
          rateValue: ts.rateValue,
          totalWage: ts.totalWage,
          ...ts,
        })),
        totalAmount,
      });

    if (!result.success) {
      connection.release();
      return res.status(500).json({ success: false, message: result.error || 'Failed to send email.' });
    }

    await connection.beginTransaction();
    for (const ts of timesheetPayloads) {
      await connection.query(
        `UPDATE timesheets SET
          client_email = ?,
          sent_to_client_at = NOW(),
          sent_by_user_id = ?,
          rate_value = ?,
          total_wage = ?,
          amount_due = ?,
          status = 'reviewed'
         WHERE id = ?`,
        [clientEmail, req.user.id, ts.rateValue, ts.totalWage, ts.totalWage, ts._id]
      );
    }
    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'Timesheet billing sent to client successfully.',
      totalAmount,
      sentCount: rows.length,
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
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
    const canViewAll = canViewAllTimesheets(req.user);
    if (!canViewAll && timesheet.employee_id !== req.user.employeeId) {
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
    const role = req.user.role;
    if (['admin', 'hr', 'accountant'].includes(role)) {
      connection.release();
      return res.status(403).json({ success: false, message: 'Your role cannot submit timesheets.' });
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
      connection.release();
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
          (timesheet_id, entry_date, day_name, task_description, hours, comments, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          timesheetId,
          row.entryDate || null,
          row.day || null,
          row.task || null,
          parseFloat(row.hrs) || 0,
          row.comments || null,
          i,
        ]
      );
    }

    await connection.commit();

    const [notifyUsers] = await connection.query(
      "SELECT id FROM users WHERE role IN ('admin', 'hr', 'accountant') AND is_active = TRUE"
    );
    for (const notifyUser of notifyUsers) {
      await createNotificationForUser(
        notifyUser.id,
        'New Timesheet Submitted',
        'An employee submitted a timesheet for review.',
        'payroll',
        '/payroll'
      );
    }

    connection.release();
    res.status(201).json({ success: true, message: 'Timesheet submitted.', id: timesheetId });
  } catch (error) {
    await connection.rollback();
    connection.release();
    next(error);
  }
});

module.exports = router;