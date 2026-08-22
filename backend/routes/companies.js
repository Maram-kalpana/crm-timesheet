const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { isAdmin } = require('../middleware/rbac');
const { ALLOWED_COUNTRIES, ALLOWED_CURRENCIES, mapCompany } = require('../utils/company');

const router = express.Router();

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const companyId = Number(req.params.id);
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }

    const [rows] = await pool.query(
      `SELECT id, name, email, phone, registration_number, country, currency, locale_configured_at, created_at, updated_at
       FROM companies WHERE id = ?`,
      [companyId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }
    res.json({ success: true, data: mapCompany(rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/locale', authenticate, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    const companyId = Number(req.params.id);
    if (!req.user.companyId || req.user.companyId !== companyId) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }

    const { country, currency } = req.body;
    if (!ALLOWED_COUNTRIES.includes(country) || !ALLOWED_CURRENCIES.includes(currency)) {
      return res.status(400).json({
        success: false,
        message: 'Country must be IN, UK, or US and currency must be INR, GBP, or USD.',
      });
    }

    await pool.query(
      'UPDATE companies SET country = ?, currency = ?, locale_configured_at = NOW() WHERE id = ?',
      [country, currency, companyId]
    );

    const [rows] = await pool.query(
      `SELECT id, name, email, phone, registration_number, country, currency, locale_configured_at
       FROM companies WHERE id = ?`,
      [companyId]
    );
    res.json({ success: true, data: mapCompany(rows[0]), message: 'Company locale saved.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
