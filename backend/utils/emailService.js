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

const sendTimesheetEmail = async ({ from, to, cc, subject, body, attachmentBuffer, filename }) => {
  const htmlBody = (body || '').replace(/\n/g, '<br>');
  return sendEmail({
    from,
    to,
    cc,
    subject: subject || 'Timesheet Submission',
    html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px">${htmlBody}</div>`,
    text: body,
    attachments: attachmentBuffer ? [{
      filename: filename || 'timesheet.xlsx',
      content: attachmentBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }] : [],
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
  isEmailConfigured,
};
