const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/rbac');

const router = express.Router();

const INCOME_SELECT = `
  SELECT inc.*,
         rec.email AS recorded_by_email,
         CONCAT(e.first_name, ' ', e.last_name) AS recorded_by_name
  FROM income inc
  LEFT JOIN users rec ON inc.recorded_by_user_id = rec.id
  LEFT JOIN employees e ON e.user_id = rec.id
`;

router.get('/', authenticate, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ success: false, message: 'No company is linked to this account.' });
    }

    const { page = 1, limit = 10, from, to, search } = req.query;
    let where = 'WHERE inc.company_id = ? AND inc.reversed_at IS NULL';
    const params = [req.user.companyId];

    if (from) {
      where += ' AND inc.payment_date >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND inc.payment_date <= ?';
      params.push(to);
    }
    if (search) {
      where += ' AND (inc.client LIKE ? OR inc.transaction_id LIKE ? OR inc.client_email LIKE ? OR inc.period_label LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM income inc ${where}`,
      params
    );
    const [[{ totalAmount }]] = await pool.query(
      `SELECT COALESCE(SUM(inc.amount), 0) as totalAmount FROM income inc ${where}`,
      params
    );

    const [rows] = await pool.query(
      `${INCOME_SELECT} ${where} ORDER BY inc.payment_date DESC, inc.id DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const data = rows.map((row) => {
      let details = row.employee_details;
      if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch { details = []; }
      }
      return { ...row, employee_details: details || [] };
    });

    res.json({
      success: true,
      data,
      totals: { amount: totalAmount },
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
