const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { sendResignationNotification } = require('../utils/emailService');
const { notifyEmployeeByEmpId, createNotificationForUser } = require('../utils/notify');
const { generateExperienceLetterPDF, generateRelievingLetterPDF } = require('../utils/pdf');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, e.first_name, e.last_name, u.employee_id, e.designation, d.name as department_name
      FROM resignations r
      JOIN employees e ON r.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE (u.company_id <=> ?)
      ORDER BY r.created_at DESC
    `, [req.user.companyId || null]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/my', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM resignations WHERE employee_id = ? ORDER BY created_at DESC',
      [req.user.employeeId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const empId = req.user.employeeId;
    const { reason, lastWorkingDate } = req.body;
    if (!reason || !lastWorkingDate) {
      return res.status(400).json({ success: false, message: 'Reason and last working date are required.' });
    }

    const [existing] = await pool.query(
      "SELECT id FROM resignations WHERE employee_id = ? AND status IN ('pending', 'approved')",
      [empId]
    );
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'You already have an active resignation request.' });
    }

    const [result] = await pool.query(
      'INSERT INTO resignations (employee_id, reason, last_working_date) VALUES (?, ?, ?)',
      [empId, reason, lastWorkingDate]
    );

    const [admins] = await pool.query("SELECT id FROM users WHERE role IN ('admin', 'hr') AND is_active = TRUE");
    for (const admin of admins) {
      await createNotificationForUser(
        admin.id,
        'New Resignation Request',
        'An employee submitted a resignation request.',
        'info',
        '/resignations'
      );
    }

    res.status(201).json({ success: true, message: 'Resignation submitted.', id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/approve', authenticate, authorize('admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT r.*, e.first_name, e.last_name, u.email FROM resignations r JOIN employees e ON r.employee_id = e.id JOIN users u ON e.user_id = u.id WHERE r.id = ? AND r.status = 'pending'",
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pending resignation not found.' });
    }

    const resignation = rows[0];
    await connection.query(
      "UPDATE resignations SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?",
      [req.user.employeeId, req.params.id]
    );
    await connection.query(
      "UPDATE employees SET employment_status = 'RESIGNED' WHERE id = ?",
      [resignation.employee_id]
    );

    await connection.commit();

    await notifyEmployeeByEmpId(
      resignation.employee_id,
      'Resignation Approved',
      'Your resignation request has been approved.',
      'success',
      '/resignations'
    );
    await sendResignationNotification({
      to: resignation.email,
      name: `${resignation.first_name} ${resignation.last_name}`,
    });

    res.json({ success: true, message: 'Resignation approved.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.put('/:id/complete', authenticate, authorize('admin'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(`
      SELECT r.*, e.*, u.email, u.employee_id as emp_code
      FROM resignations r
      JOIN employees e ON r.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE r.id = ? AND r.status = 'approved'
    `, [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Approved resignation not found.' });
    }

    const resignation = rows[0];
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const docDir = path.join(uploadDir, 'documents');
    if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });

    const expFilename = `experience_${resignation.employee_id}_${Date.now()}.pdf`;
    const relFilename = `relieving_${resignation.employee_id}_${Date.now()}.pdf`;
    const expPath = path.join(docDir, expFilename);
    const relPath = path.join(docDir, relFilename);

    const employeeForPdf = {
      ...resignation,
      employee_id: resignation.emp_code,
    };

    await generateExperienceLetterPDF(employeeForPdf, resignation, expPath);
    await generateRelievingLetterPDF(employeeForPdf, resignation, relPath);

    const expUrl = `/uploads/documents/${expFilename}`;
    const relUrl = `/uploads/documents/${relFilename}`;

    await connection.query(
      "UPDATE resignations SET status = 'completed', experience_letter_url = ?, relieving_letter_url = ? WHERE id = ?",
      [expUrl, relUrl, req.params.id]
    );
    await connection.query(
      "UPDATE employees SET employment_status = 'INACTIVE' WHERE id = ?",
      [resignation.employee_id]
    );
    await connection.query('UPDATE users SET is_active = FALSE WHERE id = ?', [resignation.user_id]);

    await connection.query(
      'INSERT INTO documents (employee_id, type, title, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [resignation.employee_id, 'experience_letter', 'Experience Letter', expUrl, req.user.employeeId]
    );
    await connection.query(
      'INSERT INTO documents (employee_id, type, title, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [resignation.employee_id, 'relieving_letter', 'Relieving Letter', relUrl, req.user.employeeId]
    );

    await connection.commit();

    await notifyEmployeeByEmpId(
      resignation.employee_id,
      'Resignation Completed',
      'Your resignation has been processed. Experience and relieving letters are available in Documents.',
      'info',
      '/documents'
    );
    await sendResignationNotification({
      to: resignation.email,
      name: `${resignation.first_name} ${resignation.last_name}`,
    });

    res.json({ success: true, message: 'Resignation completed. Employee account disabled and letters generated.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.put('/:id/reject', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, e.first_name, e.last_name, u.email
      FROM resignations r JOIN employees e ON r.employee_id = e.id JOIN users u ON e.user_id = u.id
      WHERE r.id = ? AND r.status = 'pending'
    `, [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pending resignation not found.' });
    }

    await pool.query(
      "UPDATE resignations SET status = 'rejected', approved_by = ?, approved_at = NOW() WHERE id = ?",
      [req.user.employeeId, req.params.id]
    );

    const resignation = rows[0];
    await notifyEmployeeByEmpId(
      resignation.employee_id,
      'Resignation Rejected',
      'Your resignation request has been rejected.',
      'warning',
      '/resignations'
    );
    await sendResignationNotification({
      to: resignation.email,
      name: `${resignation.first_name} ${resignation.last_name}`,
    });

    res.json({ success: true, message: 'Resignation rejected.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
