const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const empId = req.query.employeeId || req.user.employeeId;
    const { type } = req.query;

    let where = 'WHERE d.employee_id = ?';
    const params = [empId];
    if (type) { where += ' AND d.type = ?'; params.push(type); }

    if (req.user.role === 'employee' && empId != req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [documents] = await pool.query(`
      SELECT d.*, CONCAT(e.first_name, ' ', e.last_name) as uploaded_by_name
      FROM documents d LEFT JOIN employees e ON d.uploaded_by = e.id
      ${where} ORDER BY d.created_at DESC
    `, params);

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

    const fileUrl = `/uploads/documents/${req.file.filename}`;
    const [result] = await pool.query(
      'INSERT INTO documents (employee_id, type, title, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [employeeId, type, title, fileUrl, req.user.employeeId]
    );

    res.status(201).json({ success: true, id: result.insertId, fileUrl });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Document deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
