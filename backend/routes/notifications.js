const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { unreadOnly, page = 1, limit = 20 } = req.query;
    let where = 'WHERE user_id = ?';
    const params = [req.user.id];
    if (unreadOnly === 'true') { where += ' AND is_read = FALSE'; }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [notifications] = await pool.query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ unreadCount }]] = await pool.query(
      'SELECT COUNT(*) as unreadCount FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );

    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
});

const createNotification = async (userId, title, message, type = 'info', link = null) => {
  await pool.query(
    'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
    [userId, title, message, type, link]
  );
};

module.exports = router;
module.exports.createNotification = createNotification;
