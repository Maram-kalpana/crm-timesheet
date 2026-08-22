const express = require('express');
const path = require('path');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { isAdmin, isAccountant } = require('../middleware/rbac');

const router = express.Router();

const EXPENSE_SELECT = `
  SELECT ex.*,
         CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
         u.employee_id AS emp_code,
         ru.email AS reviewed_by_email
  FROM expenses ex
  JOIN employees e ON ex.employee_id = e.id
  JOIN users u ON e.user_id = u.id
  LEFT JOIN users ru ON ex.reviewed_by = ru.id
`;

const canReviewExpenses = (user) => isAdmin(user) || isAccountant(user);

const requireCompany = (req, res) => {
  if (!req.user.companyId) {
    res.status(400).json({
      success: false,
      message: 'No company is linked to this account. Register a company or contact an administrator.',
    });
    return false;
  }
  return true;
};

router.get('/', authenticate, async (req, res, next) => {
  try {
    if (!requireCompany(req, res)) return;

    const { status, employeeId, page = 1, limit = 10, from, to } = req.query;
    let where = 'WHERE ex.company_id = ?';
    const params = [req.user.companyId];

    if (!canReviewExpenses(req.user)) {
      where += ' AND ex.employee_id = ?';
      params.push(req.user.employeeId);
    } else if (employeeId) {
      where += ' AND ex.employee_id = ?';
      params.push(Number(employeeId));
    }

    if (status) {
      where += ' AND ex.status = ?';
      params.push(status);
    }
    if (from) {
      where += ' AND ex.expense_date >= ?';
      params.push(from);
    }
    if (to) {
      where += ' AND ex.expense_date <= ?';
      params.push(to);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM expenses ex ${where}`,
      params
    );

    const [rows] = await pool.query(
      `${EXPENSE_SELECT} ${where} ORDER BY ex.expense_date DESC, ex.id DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, upload.single('receipt'), async (req, res, next) => {
  try {
    if (!requireCompany(req, res)) return;
    if (!req.user.employeeId) {
      return res.status(400).json({ success: false, message: 'Employee profile is required to submit expenses.' });
    }

    const { category, amount, expenseDate, description, currency } = req.body;
    if (!category || amount == null || !expenseDate) {
      return res.status(400).json({ success: false, message: 'Category, amount, and date are required.' });
    }

    let resolvedCurrency = currency;
    if (!resolvedCurrency) {
      const [companies] = await pool.query('SELECT currency FROM companies WHERE id = ?', [req.user.companyId]);
      resolvedCurrency = companies[0]?.currency || 'INR';
    }

    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;

    const [result] = await pool.query(
      `INSERT INTO expenses
        (company_id, employee_id, category, amount, currency, expense_date, description, receipt_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.companyId,
        req.user.employeeId,
        category,
        parseFloat(amount) || 0,
        resolvedCurrency,
        expenseDate,
        description || null,
        receiptUrl,
      ]
    );

    const [rows] = await pool.query(`${EXPENSE_SELECT} WHERE ex.id = ?`, [result.insertId]);
    res.status(201).json({ success: true, message: 'Expense submitted.', data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    if (!requireCompany(req, res)) return;
    if (!canReviewExpenses(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }

    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected.' });
    }
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const [existing] = await pool.query(
      'SELECT * FROM expenses WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }
    if (existing[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Expense has already been reviewed.' });
    }

    await pool.query(
      `UPDATE expenses SET
        status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
       WHERE id = ?`,
      [status, req.user.id, status === 'rejected' ? rejectionReason : null, req.params.id]
    );

    const [rows] = await pool.query(`${EXPENSE_SELECT} WHERE ex.id = ?`, [req.params.id]);
    res.json({ success: true, message: `Expense ${status}.`, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticate, upload.single('receipt'), async (req, res, next) => {
  try {
    if (!requireCompany(req, res)) return;
    const [existing] = await pool.query(
      'SELECT * FROM expenses WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }
    const expense = existing[0];
    if (expense.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending expenses can be edited.' });
    }
    if (expense.employee_id !== req.user.employeeId && !isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }

    const { category, amount, expenseDate, description } = req.body;
    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : expense.receipt_url;

    await pool.query(
      `UPDATE expenses SET
        category = ?, amount = ?, expense_date = ?, description = ?, receipt_url = ?
       WHERE id = ?`,
      [
        category || expense.category,
        amount != null ? parseFloat(amount) : expense.amount,
        expenseDate || expense.expense_date,
        description !== undefined ? description : expense.description,
        receiptUrl,
        expense.id,
      ]
    );

    const [rows] = await pool.query(`${EXPENSE_SELECT} WHERE ex.id = ?`, [expense.id]);
    res.json({ success: true, message: 'Expense updated.', data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (!requireCompany(req, res)) return;
    const [existing] = await pool.query(
      'SELECT * FROM expenses WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }
    const expense = existing[0];
    const isOwner = expense.employee_id === req.user.employeeId;
    if (!isAdmin(req.user) && !(isOwner && expense.status === 'pending')) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }

    await pool.query('DELETE FROM expenses WHERE id = ?', [expense.id]);
    res.json({ success: true, message: 'Expense deleted.' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/receipt', authenticate, async (req, res, next) => {
  try {
    if (!requireCompany(req, res)) return;
    const [rows] = await pool.query(
      'SELECT * FROM expenses WHERE id = ? AND company_id = ?',
      [req.params.id, req.user.companyId]
    );
    if (!rows.length || !rows[0].receipt_url) {
      return res.status(404).json({ success: false, message: 'Receipt not found.' });
    }
    if (!canReviewExpenses(req.user) && rows[0].employee_id !== req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    const filename = path.basename(rows[0].receipt_url);
    res.download(path.join(process.env.UPLOAD_DIR || 'uploads', 'receipts', filename));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
