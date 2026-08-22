const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { canViewAllTimesheets, canSendClientBilling } = require('../middleware/rbac');
const { companyFilter } = require('../utils/company');
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

// ---------------------------------------------------------------------------
// Receipt upload config (used by POST /invoices/:id/payments)
// ---------------------------------------------------------------------------
const RECEIPTS_DIR = path.join(__dirname, '..', 'uploads', 'invoice-receipts');
fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, RECEIPTS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.pdf', '.jpg', '.jpeg', '.png'].includes(ext) ? ext : '';
      cb(null, `invoice-${req.params.id}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, or PDF receipts are allowed.'));
    }
    cb(null, true);
  },
});

// Wraps multer so a bad/oversized file returns a clean 400 instead of crashing to next(error) as a 500.
function handleReceiptUpload(req, res, next) {
  receiptUpload.single('receipt')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Failed to upload receipt.' });
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// ADDED: shared wage-calculation helpers, mirroring the frontend's
// fixed conversion (no longer dependent on hours entered so far).
// Hourly: rate is already per hour.
// Daily: rate / 8 standard hours = per-hour.
// Monthly: rate / actual calendar days in the reference month = per-day,
//          then per-day / 8 standard hours = per-hour.
// ---------------------------------------------------------------------------
const STANDARD_HOURS_PER_DAY = 8;

/** Number of calendar days in the month containing an ISO "YYYY-MM-DD" (or Date) value. */
function daysInMonthFromDateVal(dateVal) {
  if (!dateVal) return 30;
  let y;
  let m;
  if (typeof dateVal === 'string') {
    const str = dateVal.split('T')[0];
    [y, m] = str.split('-').map(Number);
  } else {
    y = dateVal.getFullYear();
    m = dateVal.getMonth() + 1;
  }
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

/**
 * Converts a rate + rateType into a fixed per-hour rate, using
 * `referenceDateVal` (typically the period's start date) to resolve
 * "days in that month" for Monthly rates.
 */
function computeEffectiveHourlyRate(rate, rateType, referenceDateVal) {
  const type = rateType || 'Hourly';
  if (type === 'Hourly') return rate;
  if (type === 'Daily') return rate / STANDARD_HOURS_PER_DAY;
  const days = daysInMonthFromDateVal(referenceDateVal);
  const perDay = days > 0 ? rate / days : 0;
  return perDay / STANDARD_HOURS_PER_DAY;
}

// ---------------------------------------------------------------------------
// Existing timesheet queries
// ---------------------------------------------------------------------------

const TIMESHEET_SELECT = `
  SELECT t.*,
         e.first_name, e.last_name,
         u.employee_id AS emp_code,
         d.name AS department_name,
         su.email AS sent_by_email,
         i.status AS invoice_status,
         i.total_amount AS invoice_total_amount,
         i.amount_received AS invoice_amount_received,
         i.client_email AS invoice_client_email
  FROM timesheets t
  JOIN employees e ON t.employee_id = e.id
  JOIN users u ON e.user_id = u.id
  LEFT JOIN departments d ON e.department_id = d.id
  LEFT JOIN users su ON t.sent_by_user_id = su.id
  LEFT JOIN invoices i ON t.invoice_id = i.id
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
    const company = companyFilter(req.user);
    const [rows] = await pool.query(`${TIMESHEET_SELECT} WHERE 1=1${company.sql} ORDER BY t.submitted_at DESC`, company.params);
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

/**
 * Accountant/Admin — send billing to client, mark timesheets as sent, and
 * create the invoice record that payments will later be recorded against.
 */
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
    const company = companyFilter(req.user);
    const [rows] = await connection.query(
      `${TIMESHEET_SELECT} WHERE t.id IN (${placeholders})${company.sql}`,
      [...timesheetIds, ...company.params]
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

    // All timesheets in one billing batch must belong to the same client + period —
    // an invoice represents one client billing event.
    const clients = new Set(rows.map((r) => r.client || ''));
    const periods = new Set(rows.map((r) => r.period_label || ''));
    if (clients.size > 1 || periods.size > 1) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'All selected timesheets must belong to the same client and period.',
      });
    }

    const timesheetPayloads = [];
    for (const row of rows) {
      const entries = await getEntries(row.id);
      const payload = toTimesheetEmailPayload(row, entries);

      const override = overrideMap.get(String(row.id));
      if (override !== undefined) {
        const hrs = parseFloat(payload.totalHrs) || 0;
        // --- CHANGED: `override` is the TOTAL pay for the period when
        // rate_type isn't Hourly (matches how rate_value is interpreted
        // everywhere else). Convert it to a fixed per-hour value the same
        // way as everywhere else — via days-in-month/8hrs — using the
        // timesheet's own period_start as the reference month, rather
        // than dividing by the hours on this particular timesheet. ---
        const effectiveOverrideRate = computeEffectiveHourlyRate(
          override,
          row.rate_type,
          row.period_start
        );
        payload.rateValue = override;
        payload.totalWage = hrs * effectiveOverrideRate;
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
    const finalSubject = subject || `Timesheet Invoice - ${client} - ${periodLabel}`;

    const result = timesheetPayloads.length === 1
      ? await sendClientTimesheetEmail({
        from,
        to: clientEmail,
        cc: cc || undefined,
        subject: finalSubject,
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
        subject: finalSubject,
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

    const [invoiceResult] = await connection.query(
      `INSERT INTO invoices
        (company_id, client, period_label, period_start, period_end, client_email, subject, total_amount, sent_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.companyId || null,
        client,
        periodLabel,
        rows[0].period_start,
        rows[0].period_end,
        clientEmail,
        finalSubject,
        totalAmount,
        req.user.id,
      ]
    );
    const invoiceId = invoiceResult.insertId;

    for (const ts of timesheetPayloads) {
      await connection.query(
        `UPDATE timesheets SET
          client_email = ?,
          sent_to_client_at = NOW(),
          sent_by_user_id = ?,
          rate_value = ?,
          total_wage = ?,
          amount_due = ?,
          status = 'reviewed',
          invoice_id = ?
         WHERE id = ?`,
        [clientEmail, req.user.id, ts.rateValue, ts.totalWage, ts.totalWage, invoiceId, ts._id]
      );
    }
    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'Timesheet billing sent to client successfully.',
      totalAmount,
      sentCount: rows.length,
      invoiceId,
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    next(error);
  }
});

// ---------------------------------------------------------------------------
// NEW: Invoice payment tracking
// IMPORTANT: these must be declared before GET /:id so "invoices" isn't
// swallowed by the :id param route.
// ---------------------------------------------------------------------------

/** List invoices (accountant/admin). Optional ?status= and ?client= filters. */
router.get('/invoices', authenticate, async (req, res, next) => {
  try {
    if (!canSendClientBilling(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const { status, client } = req.query;
    const clauses = ['(i.company_id <=> ?)'];
    const params = [req.user.companyId || null];
    if (status) {
      clauses.push('i.status = ?');
      params.push(status);
    }
    if (client) {
      clauses.push('i.client = ?');
      params.push(client);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT i.*,
              COUNT(t.id) AS employee_count,
              su.email AS sent_by_email
       FROM invoices i
       LEFT JOIN timesheets t ON t.invoice_id = i.id
       LEFT JOIN users su ON i.sent_by_user_id = su.id
       ${where}
       GROUP BY i.id
       ORDER BY i.sent_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

/** Invoice detail: header + line-item timesheets + full payment history. */
router.get('/invoices/:id', authenticate, async (req, res, next) => {
  try {
    if (!canSendClientBilling(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const [invoiceRows] = await pool.query(
      'SELECT * FROM invoices WHERE id = ? AND (company_id <=> ?)',
      [req.params.id, req.user.companyId || null]
    );
    if (!invoiceRows.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const [items] = await pool.query(`${TIMESHEET_SELECT} WHERE t.invoice_id = ?`, [req.params.id]);
    const [payments] = await pool.query(
      `SELECT p.*, u.email AS recorded_by_email, ru.email AS reversed_by_email
       FROM invoice_payments p
       LEFT JOIN users u ON p.recorded_by_user_id = u.id
       LEFT JOIN users ru ON p.reversed_by_user_id = ru.id
       WHERE p.invoice_id = ?
       ORDER BY p.recorded_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: { invoice: invoiceRows[0], items, payments } });
  } catch (error) {
    next(error);
  }
});

/**
 * Record a payment received from the client for an invoice.
 * multipart/form-data: transactionId, amount, date, notes?, receipt? (pdf/jpg/png, max 10MB)
 */
router.post('/invoices/:id/payments', authenticate, handleReceiptUpload, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    if (!canSendClientBilling(req.user)) {
      connection.release();
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const invoiceId = req.params.id;
    const { transactionId, amount, date, notes } = req.body;

    if (!transactionId || !String(transactionId).trim()) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Transaction ID is required.' });
    }
    if (String(transactionId).trim().length > 100) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Transaction ID is too long.' });
    }

    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
    }

    if (!date) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Date is required.' });
    }
    const dateObj = new Date(date);
    if (Number.isNaN(dateObj.getTime()) || dateObj > new Date()) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Date is invalid or in the future.' });
    }

    // Lock the invoice row so two simultaneous "record payment" requests can't race
    // on amount_received (accountants sharing the same client are a realistic scenario).
    await connection.beginTransaction();
    const [invoiceRows] = await connection.query(
      'SELECT * FROM invoices WHERE id = ? AND (company_id <=> ?) FOR UPDATE',
      [invoiceId, req.user.companyId || null]
    );
    if (!invoiceRows.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }
    const invoice = invoiceRows[0];

    const receiptPath = req.file ? `/uploads/invoice-receipts/${req.file.filename}` : null;

    const [payResult] = await connection.query(
      `INSERT INTO invoice_payments
        (invoice_id, transaction_id, amount, payment_date, notes, receipt_path, recorded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, String(transactionId).trim(), amountNum, date, notes ? String(notes).trim() : null, receiptPath, req.user.id]
    );

    const newAmountReceived = parseFloat(invoice.amount_received) + amountNum;
    const newStatus = newAmountReceived >= parseFloat(invoice.total_amount) - 0.01
      ? 'received'
      : 'partially_received';

    await connection.query('UPDATE invoices SET amount_received = ?, status = ? WHERE id = ?', [
      newAmountReceived,
      newStatus,
      invoiceId,
    ]);

    const [tsRows] = await connection.query(`${TIMESHEET_SELECT} WHERE t.invoice_id = ?`, [invoiceId]);
    const employeeDetails = tsRows.map((row) => ({
      timesheetId: row.id,
      employeeName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      employeeCode: row.emp_code,
      department: row.department_name,
      hours: row.total_hours,
      wage: row.total_wage,
      rateType: row.rate_type,
      rateValue: row.rate_value,
    }));
    let currency = 'INR';
    if (req.user.companyId) {
      const [companies] = await connection.query('SELECT currency FROM companies WHERE id = ?', [req.user.companyId]);
      currency = companies[0]?.currency || 'INR';
    }

    if (req.user.companyId) {
      try {
        await connection.query(
          `INSERT INTO income
            (company_id, invoice_id, payment_id, client, client_email, period_label, period_start, period_end,
             invoice_subject, invoice_total, amount, currency, payment_date, transaction_id, notes, receipt_path,
             employee_details, timesheet_count, recorded_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.companyId,
            invoiceId,
            payResult.insertId,
            invoice.client,
            invoice.client_email,
            invoice.period_label,
            invoice.period_start,
            invoice.period_end,
            invoice.subject,
            invoice.total_amount,
            amountNum,
            currency,
            date,
            String(transactionId).trim(),
            notes ? String(notes).trim() : null,
            receiptPath,
            JSON.stringify(employeeDetails),
            employeeDetails.length,
            req.user.id,
          ]
        );
      } catch (incErr) {
        console.warn('[Income] Could not write income row:', incErr.message);
      }
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: 'Payment recorded.',
      status: newStatus,
      amountReceived: newAmountReceived,
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    next(error);
  }
});

/** Mark an invoice as not received (dispute, non-payment, chargeback, or correcting a mistaken entry). */
router.put('/invoices/:id/not-received', authenticate, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    if (!canSendClientBilling(req.user)) {
      connection.release();
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const invoiceId = req.params.id;
    const { reason } = req.body;

    await connection.beginTransaction();
    const [invoiceRows] = await connection.query(
      'SELECT * FROM invoices WHERE id = ? AND (company_id <=> ?) FOR UPDATE',
      [invoiceId, req.user.companyId || null]
    );
    if (!invoiceRows.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    // Soft-reverse: keep the payment rows for audit history, just flag them.
    await connection.query(
      `UPDATE invoice_payments SET reversed_at = NOW(), reversed_by_user_id = ?, reversed_reason = ?
       WHERE invoice_id = ? AND reversed_at IS NULL`,
      [req.user.id, reason ? String(reason).trim() : null, invoiceId]
    );

    try {
      await connection.query(
        'UPDATE income SET reversed_at = NOW() WHERE invoice_id = ? AND reversed_at IS NULL',
        [invoiceId]
      );
    } catch (incErr) {
      console.warn('[Income] Could not reverse income row:', incErr.message);
    }

    await connection.query(`UPDATE invoices SET amount_received = 0, status = 'not_received' WHERE id = ?`, [
      invoiceId,
    ]);

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Invoice marked as not received.' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    next(error);
  }
});

// ---------------------------------------------------------------------------

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const company = companyFilter(req.user);
    const [rows] = await pool.query(
      `${TIMESHEET_SELECT} WHERE t.id = ?${company.sql}`,
      [req.params.id, ...company.params]
    );
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
    // --- CHANGED: fixed conversion (days in the period's month / 8 hrs),
    // matching the frontend — no longer dependent on totalHours. We still
    // persist the raw `rate` (not effectiveRate) into rate_value below —
    // that's "what was agreed", not a derived number. `periodStart` is
    // used as the reference date for "days in that month". ---
    const effectiveRate = computeEffectiveHourlyRate(rate, rateType, periodStart);
    const totalWage = totalHours * effectiveRate;

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