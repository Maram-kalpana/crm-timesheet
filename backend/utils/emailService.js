const nodemailer = require('nodemailer');

let transporter = null;

const isEmailConfigured = () =>
  Boolean(
    (process.env.SMTP_HOST || process.env.EMAIL_HOST) &&
    (process.env.SMTP_USER || process.env.EMAIL_USER) &&
    (process.env.SMTP_PASS || process.env.EMAIL_PASSWORD)
  );

const getTransporter = () => {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;

  console.log('[Email] Initializing SMTP transporter:', { host, port, user });

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
  });
  return transporter;
};

const sendEmail = async ({ to, cc, subject, html, text, from, attachments }) => {
  try {
    if (!isEmailConfigured()) {
      console.warn('[Email] SMTP not configured. Would send to:', to, '| Subject:', subject);
      return { success: false, skipped: true, message: 'Email service not configured' };
    }
    console.log('[Email] Sending to:', to, cc ? `| CC: ${cc}` : '', '| Subject:', subject);
    const info = await getTransporter().sendMail({
      from: from || process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER,
      to,
      ...(cc ? { cc } : {}),
      subject,
      html,
      text: text || html?.replace(/<[^>]+>/g, ''),
      attachments,
    });
    console.log('[Email] Sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Send failed:', error.message);
    if (error.response) console.error('[Email] SMTP response:', error.response);
    return { success: false, error: error.message };
  }
};

const sendWelcomeEmail = async ({ to, name, employeeId, tempPassword, loginUrl }) => {
  const url = loginUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
  return sendEmail({
    to,
    subject: 'Welcome to HRMS – Your Login Credentials',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#2563EB">Welcome to HRMS</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your employee account has been created. Use the credentials below to sign in:</p>
        <table style="background:#F8FAFC;border-radius:8px;padding:16px;width:100%">
          <tr><td><strong>Employee ID</strong></td><td>${employeeId}</td></tr>
          <tr><td><strong>Email</strong></td><td>${to}</td></tr>
          <tr><td><strong>Temporary Password</strong></td><td>${tempPassword}</td></tr>
          <tr><td><strong>Login URL</strong></td><td><a href="${url}/login">${url}/login</a></td></tr>
        </table>
        <p style="color:#64748B;font-size:14px">Please change your password after first login. Contact HR if you need assistance.</p>
      </div>
    `,
  });
};

const sendDocumentNotification = async ({ to, name, documentTitle, documentType }) => {
  const url = process.env.FRONTEND_URL || 'http://localhost:5173';
  return sendEmail({
    to,
    subject: `New Document Available: ${documentTitle}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#2563EB">New Document Uploaded</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>A new document has been added to your profile:</p>
        <p><strong>${documentTitle}</strong> (${documentType.replace(/_/g, ' ')})</p>
        <p><a href="${url}/documents" style="background:#2563EB;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">View Documents</a></p>
      </div>
    `,
  });
};

const sendResignationNotification = async ({ to, name }) => {
  const url = process.env.FRONTEND_URL || 'http://localhost:5173';
  return sendEmail({
    to,
    subject: 'Resignation Update - HRMS',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#2563EB">Resignation Status Update</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your resignation request has been processed. Please check your HRMS account for details.</p>
        <p><a href="${url}/documents">View Documents</a></p>
      </div>
    `,
  });
};

const sendLeaveNotification = async ({ to, name, status, leaveType }) => {
  return sendEmail({
    to,
    subject: `Leave Request ${status} - HRMS`,
    html: `<p>Hello <strong>${name}</strong>, your ${leaveType} leave request has been <strong>${status}</strong>.</p>`,
  });
};

const sendPayslipNotification = async ({ to, name, month, year }) => {
  const url = process.env.FRONTEND_URL || 'http://localhost:5173';
  return sendEmail({
    to,
    subject: `Payslip Available - ${month}/${year}`,
    html: `<p>Hello <strong>${name}</strong>, your payslip for ${month}/${year} is ready. <a href="${url}/payroll">View Payslips</a></p>`,
  });
};

const sendTimesheetEmail = async ({ from, to, cc, subject, body, attachmentBuffer, filename, htmlOverride }) => {
  const htmlBody = htmlOverride || (body || '').replace(/\n/g, '<br>');
  return sendEmail({
    from,
    to,
    cc,
    subject: subject || 'Timesheet Submission',
    html: htmlOverride ? htmlBody : `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">${htmlBody}</div>`,
    text: body,
    attachments: attachmentBuffer ? [{
      filename: filename || 'timesheet.xlsx',
      content: attachmentBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }] : [],
  });
};

const SHORT_DAY_TO_FULL = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tues: 'Tuesday',
  Wed: 'Wednesday',
  Thurs: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
};

const formatDayDisplay = (day) => {
  if (!day) return '';
  return SHORT_DAY_TO_FULL[day] || day;
};

const formatCommentDisplay = (value) => {
  if (!value) return '';
  const map = {
    halfday: 'halfday',
    fullday: 'Fullday',
    leave: 'Leave',
    'mandatory holiday': 'Mandatory Holiday',
  };
  return map[String(value).toLowerCase()] || value;
};

/** Client-facing timesheet email — matches reference layout (no wages/task columns). */
const buildClientTimesheetHtml = (data) => {
  const rows = data.rows || [];
  const totalHrs = rows.reduce((sum, r) => sum + (parseFloat(r.hrs) || 0), 0);
  const cellStyle = 'border:1px solid #000;padding:8px 12px;font-size:14px;';
  const headerCell = `${cellStyle}font-weight:600;background:#fff;`;
  const metaRows = [
    ['Employee Name', data.employeeName || ''],
    ['Employee ID', data.employeeId || ''],
    ['Client', data.client || ''],
    ['Manager', data.managerName || ''],
    ['Period Type', data.periodType || ''],
    ['Period', data.periodLabel || ''],
  ];

  let metaTable = '<table style="border-collapse:collapse;width:100%;max-width:640px;margin-bottom:16px;">';
  metaRows.forEach(([label, value]) => {
    metaTable += `<tr><td style="${headerCell}width:180px;">${label}</td><td style="${cellStyle}">${value}</td></tr>`;
  });
  metaTable += '</table>';

  let dataTable = '<table style="border-collapse:collapse;width:100%;max-width:640px;">';
  dataTable += `<tr>
    <td style="${cellStyle}font-weight:700;background:#2563EB;color:#fff;text-align:center;">Date</td>
    <td style="${cellStyle}font-weight:700;background:#2563EB;color:#fff;text-align:center;">Day</td>
    <td style="${cellStyle}font-weight:700;background:#2563EB;color:#fff;text-align:center;">Number of Hrs</td>
    <td style="${cellStyle}font-weight:700;background:#2563EB;color:#fff;text-align:center;">Comments</td>
  </tr>`;

  rows.forEach((row) => {
    dataTable += `<tr>
      <td style="${cellStyle}text-align:center;">${row.date || ''}</td>
      <td style="${cellStyle}text-align:center;">${formatDayDisplay(row.day)}</td>
      <td style="${cellStyle}text-align:center;">${parseFloat(row.hrs) || 0}</td>
      <td style="${cellStyle}text-align:center;">${formatCommentDisplay(row.comments)}</td>
    </tr>`;
  });

  dataTable += `<tr>
    <td style="${cellStyle}font-weight:700;" colspan="2">Total</td>
    <td style="${cellStyle}font-weight:700;text-align:center;">${totalHrs}</td>
    <td style="${cellStyle}"></td>
  </tr>`;
  dataTable += '</table>';

  let billingBlock = '';
  if (data.rateValue != null && data.totalWage != null) {
    billingBlock = `
      <table style="border-collapse:collapse;width:100%;max-width:640px;margin-top:16px;">
        <tr><td style="${headerCell}">Rate (${data.rateType || 'Hourly'})</td><td style="${cellStyle}">${data.rateValue}</td></tr>
        <tr><td style="${headerCell}">Total Hours</td><td style="${cellStyle}">${totalHrs}</td></tr>
        <tr><td style="${headerCell}font-weight:700;">Amount Due</td><td style="${cellStyle}font-weight:700;">${Number(data.totalWage).toFixed(2)}</td></tr>
      </table>`;
  }

  return `<div style="font-family:Calibri,Arial,sans-serif;padding:16px;color:#000;">${metaTable}${dataTable}${billingBlock}</div>`;
};

const sendClientTimesheetEmail = async ({ to, cc, subject, timesheetData, from }) => {
  const html = buildClientTimesheetHtml(timesheetData);
  return sendEmail({
    from,
    to,
    cc,
    subject: subject || `Timesheet - ${timesheetData.periodLabel || timesheetData.employeeName || 'Submission'}`,
    html,
    text: `Timesheet for ${timesheetData.employeeName || 'employee'} — Period: ${timesheetData.periodLabel || ''}`,
  });
};

const sendCombinedClientBillingEmail = async ({ to, cc, subject, client, periodLabel, timesheets, totalAmount, from }) => {
  const cellStyle = 'border:1px solid #000;padding:8px 12px;font-size:14px;';
  const headerCell = `${cellStyle}font-weight:600;background:#fff;`;

  let summary = `<table style="border-collapse:collapse;width:100%;max-width:720px;margin-bottom:20px;">
    <tr><td style="${headerCell}width:180px;">Client</td><td style="${cellStyle}">${client || ''}</td></tr>
    <tr><td style="${headerCell}">Period</td><td style="${cellStyle}">${periodLabel || ''}</td></tr>
    <tr><td style="${headerCell}font-weight:700;">Total Amount Due</td><td style="${cellStyle}font-weight:700;">${Number(totalAmount).toFixed(2)}</td></tr>
  </table>`;

  let employeeTable = `<table style="border-collapse:collapse;width:100%;max-width:720px;margin-bottom:24px;">
    <tr>
      <td style="${cellStyle}font-weight:700;background:#2563EB;color:#fff;">Employee</td>
      <td style="${cellStyle}font-weight:700;background:#2563EB;color:#fff;">Employee ID</td>
      <td style="${cellStyle}font-weight:700;background:#2563EB;color:#fff;">Hours</td>
      <td style="${cellStyle}font-weight:700;background:#2563EB;color:#fff;">Rate</td>
      <td style="${cellStyle}font-weight:700;background:#2563EB;color:#fff;">Amount</td>
    </tr>`;

  timesheets.forEach((ts) => {
    employeeTable += `<tr>
      <td style="${cellStyle}">${ts.employeeName || ''}</td>
      <td style="${cellStyle}">${ts.employeeId || ''}</td>
      <td style="${cellStyle}text-align:center;">${ts.totalHours ?? ts.totalHrs ?? 0}</td>
      <td style="${cellStyle}text-align:center;">${ts.rateValue ?? 0}</td>
      <td style="${cellStyle}text-align:center;">${Number(ts.totalWage || ts.amountDue || 0).toFixed(2)}</td>
    </tr>`;
  });
  employeeTable += '</table>';

  const detailSections = timesheets.map((ts) => buildClientTimesheetHtml({
    ...ts,
    rateValue: undefined,
    totalWage: undefined,
  })).join('<hr style="margin:24px 0;border:none;border-top:1px solid #ddd;"/>');

  const html = `<div style="font-family:Calibri,Arial,sans-serif;padding:16px;color:#000;">
    <h2 style="margin:0 0 16px;font-size:18px;">Timesheet Billing Summary</h2>
    ${summary}${employeeTable}${detailSections}
  </div>`;

  return sendEmail({
    from,
    to,
    cc,
    subject: subject || `Timesheet Invoice - ${client || 'Client'} - ${periodLabel || ''}`,
    html,
    text: `Billing summary for ${client}. Total amount due: ${Number(totalAmount).toFixed(2)}`,
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendDocumentNotification,
  sendResignationNotification,
  sendLeaveNotification,
  sendPayslipNotification,
  sendTimesheetEmail,
  sendClientTimesheetEmail,
  sendCombinedClientBillingEmail,
  buildClientTimesheetHtml,
  isEmailConfigured,
};
