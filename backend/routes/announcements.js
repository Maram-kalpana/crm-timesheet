const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const [announcements] = await pool.query(`
      SELECT a.*, CONCAT(e.first_name, ' ', e.last_name) as created_by_name
      FROM announcements a LEFT JOIN employees e ON a.created_by = e.id
      WHERE a.is_active = TRUE ORDER BY a.created_at DESC
    `);
    res.json({ success: true, data: announcements });
  } catch (error) {
    next(error);
  }
});

router.get('/holidays', authenticate, async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const [holidays] = await pool.query(
      'SELECT * FROM holidays WHERE YEAR(date) = ? ORDER BY date',
      [year]
    );
    res.json({ success: true, data: holidays });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const { title, content, type, priority, startDate, endDate } = req.body;
    const [result] = await pool.query(
      'INSERT INTO announcements (title, content, type, priority, created_by, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, content, type || 'general', priority || 'medium', req.user.employeeId, startDate, endDate]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
