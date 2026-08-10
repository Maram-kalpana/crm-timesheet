const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { normalizeRole, canAccessEmployee, isAdmin, isHr } = require('../middleware/rbac');
const { generatePayslipPDF } = require('../utils/pdf');
const { sendPayslipNotification } = require('../utils/emailService');
const { notifyEmployeeByEmpId } = require('../utils/notify');

const router = express.Router();

router.get('/summary', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    const [payslips] = await pool.query(`
      SELECT p.*, e.first_name, e.last_name, u.employee_id, d.name as department_name
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE p.month = ? AND p.year = ?
    `, [m, y]);

    const summary = {
      totalEmployees: payslips.length,
      totalGross: payslips.reduce((s, p) => s + Number(p.gross_salary), 0),
      totalNet: payslips.reduce((s, p) => s + Number(p.net_salary), 0),
      totalDeductions: payslips.reduce((s, p) => s + Number(p.pf_deduction) + Number(p.tax_deduction) + Number(p.other_deductions), 0),
    };

    res.json({ success: true, data: { payslips, summary, month: m, year: y } });
  } catch (error) {
    next(error);
  }
});

router.get('/my', authenticate, async (req, res, next) => {
  try {
    const [payslips] = await pool.query(
      'SELECT * FROM payslips WHERE employee_id = ? ORDER BY year DESC, month DESC',
      [req.user.employeeId]
    );
    res.json({ success: true, data: payslips });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const [payslips] = await pool.query(`
      SELECT p.*, e.first_name, e.last_name, e.designation, u.employee_id, d.name as department_name
      FROM payslips p
      JOIN employees e ON p.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!payslips.length) {
      return res.status(404).json({ success: false, message: 'Payslip not found.' });
    }

    const role = normalizeRole(req.user.role);
    if ((role === 'employee' || role === 'team_lead') && payslips[0].employee_id !== req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (role === 'hr' && payslips[0].employee_id !== req.user.employeeId) {
      // HR can view all payslips
    }

    res.json({ success: true, data: payslips[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/generate', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    const [employees] = await pool.query(`
      SELECT e.id, ss.* FROM employees e
      JOIN salary_structures ss ON e.id = ss.employee_id
      JOIN users u ON e.user_id = u.id
      WHERE u.is_active = TRUE AND (ss.effective_to IS NULL OR ss.effective_to >= ?)
      AND ss.effective_from <= ?
    `, [`${y}-${String(m).padStart(2, '0')}-01`, `${y}-${String(m).padStart(2, '0')}-01`]);

    let generated = 0;
    for (const emp of employees) {
      const gross = Number(emp.basic_salary) + Number(emp.hra) + Number(emp.transport_allowance) + Number(emp.medical_allowance) + Number(emp.special_allowance);
      const deductions = Number(emp.pf_deduction) + Number(emp.tax_deduction) + Number(emp.other_deductions);
      const net = gross - deductions;

      await pool.query(`
        INSERT INTO payslips (employee_id, month, year, basic_salary, hra, transport_allowance, medical_allowance,
          special_allowance, gross_salary, pf_deduction, tax_deduction, other_deductions, net_salary, status, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated', NOW())
        ON DUPLICATE KEY UPDATE gross_salary=VALUES(gross_salary), net_salary=VALUES(net_salary), status='generated', generated_at=NOW()
      `, [emp.id, m, y, emp.basic_salary, emp.hra, emp.transport_allowance, emp.medical_allowance, emp.special_allowance, gross, emp.pf_deduction, emp.tax_deduction, emp.other_deductions, net]);
      generated++;

      const [empInfo] = await pool.query(`
        SELECT e.first_name, e.last_name, u.email FROM employees e JOIN users u ON e.user_id = u.id WHERE e.id = ?
      `, [emp.id]);
      if (empInfo.length) {
        await notifyEmployeeByEmpId(emp.id, 'Payslip Available', `Your payslip for ${m}/${y} is ready.`, 'info', '/payroll');
        await sendPayslipNotification({
          to: empInfo[0].email,
          name: `${empInfo[0].first_name} ${empInfo[0].last_name}`,
          month: m,
          year: y,
        });
      }
    }

    res.json({ success: true, message: `Generated ${generated} payslips.` });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const [payslips] = await pool.query('SELECT * FROM payslips WHERE id = ?', [req.params.id]);
    if (!payslips.length) {
      return res.status(404).json({ success: false, message: 'Payslip not found.' });
    }

    const payslip = payslips[0];
    const role = normalizeRole(req.user.role);
    if ((role === 'employee' || role === 'team_lead') && payslip.employee_id !== req.user.employeeId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const [employees] = await pool.query(`
      SELECT e.*, u.employee_id FROM employees e JOIN users u ON e.user_id = u.id WHERE e.id = ?
    `, [payslip.employee_id]);

    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const pdfDir = path.join(uploadDir, 'payslips');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

    const filename = `payslip_${payslip.employee_id}_${payslip.month}_${payslip.year}.pdf`;
    const outputPath = path.join(pdfDir, filename);

    await generatePayslipPDF(payslip, employees[0], outputPath);
    res.download(outputPath, filename);
  } catch (error) {
    next(error);
  }
});

router.put('/salary/:employeeId', authenticate, authorize('admin', 'hr'), async (req, res, next) => {
  try {
    const {
      basicSalary, hra, transportAllowance, medicalAllowance, specialAllowance,
      allowances, pfDeduction, taxDeduction, otherDeductions, deductions, effectiveFrom,
    } = req.body;
    const effective = effectiveFrom || new Date().toISOString().split('T')[0];
    await pool.query(`
      INSERT INTO salary_structures (employee_id, basic_salary, hra, transport_allowance, medical_allowance,
        special_allowance, pf_deduction, tax_deduction, other_deductions, effective_from)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.params.employeeId,
      Number(basicSalary) || 0,
      Number(hra) || 0,
      Number(transportAllowance) || 0,
      Number(medicalAllowance) || 0,
      Number(specialAllowance ?? allowances) || 0,
      Number(pfDeduction) || 0,
      Number(taxDeduction) || 0,
      Number(otherDeductions ?? deductions) || 0,
      effective,
    ]);
    res.json({ success: true, message: 'Salary structure updated.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
