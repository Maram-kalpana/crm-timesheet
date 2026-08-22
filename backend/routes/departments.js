const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { companyFilter } = require('../utils/company');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const company = companyFilter(req.user, 'd');
    const [departments] = await pool.query(`
      SELECT d.*, COUNT(e.id) as employee_count,
        CONCAT(h.first_name, ' ', h.last_name) as head_name
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id
      LEFT JOIN employees h ON d.head_id = h.id
      WHERE 1=1${company.sql}
      GROUP BY d.id ORDER BY d.name
    `, company.params);
    res.json({ success: true, data: departments });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const { name, description, headId } = req.body;
    const [result] = await pool.query(
      'INSERT INTO departments (name, description, head_id, company_id) VALUES (?, ?, ?, ?)',
      [name, description, headId, req.user.companyId || null]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
