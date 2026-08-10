const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { isAdmin, isHr, canAccessEmployee } = require('../middleware/rbac');
const upload = require('../middleware/upload');
const { sendDocumentNotification } = require('../utils/emailService');
const { notifyEmployeeByEmpId } = require('../utils/notify');

const router = express.Router();

const docSelect = `
  SELECT d.*, CONCAT(e.first_name, ' ', e.last_name) as uploaded_by_name
  FROM documents d LEFT JOIN employees e ON d.uploaded_by = e.id
`;

router.get('/my', authenticate, async (req, res, next) => {
  try {
    const empId = req.user.employeeId;
    const { type } = req.query;
    let where = 'WHERE d.employee_id = ?';
    const params = [empId];
    if (type) { where += ' AND d.type = ?'; params.push(type); }

    const [documents] = await pool.query(`${docSelect} ${where} ORDER BY d.created_at DESC`, params);
    res.json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type, employeeId } = req.query;
    const role = req.user.role;

    if (role === 'employee') {
      return res.status(403).json({ success: false, message: 'Use /documents/my for your documents.' });
    }

    let targetEmpId = employeeId ? Number(employeeId) : null;

    if (targetEmpId) {
      const allowed = await canAccessEmployee(req.user, targetEmpId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    } else if (!isAdmin(req.user) && !isHr(req.user)) {
      return res.status(400).json({ success: false, message: 'employeeId is required.' });
    }

    let where = targetEmpId ? 'WHERE d.employee_id = ?' : 'WHERE 1=1';
    const params = targetEmpId ? [targetEmpId] : [];
    if (type) { where += ' AND d.type = ?'; params.push(type); }

    const [documents] = await pool.query(`${docSelect} ${where} ORDER BY d.created_at DESC`, params);
    res.json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize('admin', 'hr'), upload.single('document'), async (req, res, next) => {
  try {
    const { employeeId, type, title } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'employeeId is required.' });
    }

    const targetEmpId = Number(employeeId);
    const [empRows] = await pool.query(
      `SELECT e.id, e.first_name, e.last_name, u.email, u.id as user_id
       FROM employees e JOIN users u ON e.user_id = u.id WHERE e.id = ?`,
      [targetEmpId]
    );
    if (!empRows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const fileUrl = `/uploads/documents/${req.file.filename}`;
    const docType = type || 'other';
    const docTitle = title || req.file.originalname;

    const [result] = await pool.query(
      'INSERT INTO documents (employee_id, type, title, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [targetEmpId, docType, docTitle, fileUrl, req.user.employeeId]
    );

    console.log('[Documents] Saved:', { id: result.insertId, employeeId: targetEmpId, fileUrl });

    await notifyEmployeeByEmpId(
      targetEmpId,
      'New Document Available',
      `${docTitle} has been uploaded to your profile.`,
      'info',
      '/documents'
    );

    const emailResult = await sendDocumentNotification({
      to: empRows[0].email,
      name: `${empRows[0].first_name} ${empRows[0].last_name}`,
      documentTitle: docTitle,
      documentType: docType,
    });

    res.status(201).json({
      success: true,
      id: result.insertId,
      fileUrl,
      emailSent: emailResult.success,
      emailMessage: emailResult.skipped ? 'Email not configured' : (emailResult.success ? 'Notification sent' : emailResult.error),
    });
  } catch (error) {
    console.error('[Documents] Upload error:', error.message);
    next(error);
  }
});

router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const [docs] = await pool.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }
    const doc = docs[0];
    if (doc.employee_id) {
      const allowed = await canAccessEmployee(req.user, doc.employee_id);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    } else if (!isAdmin(req.user) && !isHr(req.user)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const filePath = path.join(uploadDir, doc.file_url.replace(/^\/uploads\//, ''));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server.' });
    }
    res.download(filePath, doc.title || path.basename(filePath));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const [docs] = await pool.query('SELECT file_url FROM documents WHERE id = ?', [req.params.id]);
    if (docs.length) {
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      const filePath = path.join(uploadDir, docs[0].file_url.replace(/^\/uploads\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Document deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
