const pool = require('../config/db');

const createNotificationForUser = async (userId, title, message, type = 'info', link = null) => {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)',
      [userId, title, message, type, link]
    );
  } catch (err) {
    console.error('[Notification] Failed to create:', err.message);
  }
};

const notifyEmployeeByEmpId = async (employeeId, title, message, type = 'info', link = '/documents') => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id FROM employees WHERE id = ?',
      [employeeId]
    );
    if (rows.length) {
      await createNotificationForUser(rows[0].user_id, title, message, type, link);
    }
  } catch (err) {
    console.error('[Notification] notifyEmployeeByEmpId failed:', err.message);
  }
};

module.exports = { createNotificationForUser, notifyEmployeeByEmpId };
