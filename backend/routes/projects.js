const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND p.status = ?'; params.push(status); }
    if (search) { where += ' AND p.name LIKE ?'; params.push(`%${search}%`); }

    if (req.user.role === 'employee') {
      where += ' AND pm.employee_id = ?';
      params.push(req.user.employeeId);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const joinClause = req.user.role === 'employee'
      ? 'JOIN project_members pm ON p.id = pm.project_id'
      : '';

    const [projects] = await pool.query(`
      SELECT DISTINCT p.*, CONCAT(e.first_name, ' ', e.last_name) as manager_name,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'done') as completed_tasks
      FROM projects p
      ${joinClause}
      LEFT JOIN employees e ON p.manager_id = e.id
      ${where}
      ORDER BY p.updated_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const [projects] = await pool.query(`
      SELECT p.*, CONCAT(e.first_name, ' ', e.last_name) as manager_name
      FROM projects p LEFT JOIN employees e ON p.manager_id = e.id WHERE p.id = ?
    `, [req.params.id]);

    if (!projects.length) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const [members] = await pool.query(`
      SELECT pm.*, e.first_name, e.last_name, e.avatar, u.employee_id, e.designation
      FROM project_members pm JOIN employees e ON pm.employee_id = e.id
      JOIN users u ON e.user_id = u.id WHERE pm.project_id = ?
    `, [req.params.id]);

    const [tasks] = await pool.query(`
      SELECT t.*, CONCAT(e.first_name, ' ', e.last_name) as assigned_to_name
      FROM project_tasks t LEFT JOIN employees e ON t.assigned_to = e.id
      WHERE t.project_id = ? ORDER BY FIELD(t.status, 'todo', 'in-progress', 'review', 'done')
    `, [req.params.id]);

    const [comments] = await pool.query(`
      SELECT c.*, CONCAT(e.first_name, ' ', e.last_name) as author_name, e.avatar
      FROM project_comments c JOIN employees e ON c.employee_id = e.id
      WHERE c.project_id = ? ORDER BY c.created_at DESC LIMIT 20
    `, [req.params.id]);

    const [updates] = await pool.query(`
      SELECT u.*, CONCAT(e.first_name, ' ', e.last_name) as author_name
      FROM project_updates u JOIN employees e ON u.employee_id = e.id
      WHERE u.project_id = ? ORDER BY u.update_date DESC LIMIT 20
    `, [req.params.id]);

    res.json({ success: true, data: { ...projects[0], members, tasks, comments, updates } });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize('admin', 'hr', 'manager'), async (req, res, next) => {
  try {
    const { name, description, status, priority, startDate, endDate, managerId, memberIds } = req.body;
    const [result] = await pool.query(
      'INSERT INTO projects (name, description, status, priority, start_date, end_date, manager_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, description, status || 'planning', priority || 'medium', startDate, endDate, managerId, req.user.employeeId]
    );

    if (memberIds && memberIds.length) {
      const values = memberIds.map((id) => [result.insertId, id]);
      await pool.query('INSERT INTO project_members (project_id, employee_id) VALUES ?', [values]);
    }

    res.status(201).json({ success: true, message: 'Project created.', id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, authorize('admin', 'hr', 'manager'), async (req, res, next) => {
  try {
    const { name, description, status, priority, startDate, endDate, completionPercentage, managerId } = req.body;
    await pool.query(
      'UPDATE projects SET name=?, description=?, status=?, priority=?, start_date=?, end_date=?, completion_percentage=?, manager_id=? WHERE id=?',
      [name, description, status, priority, startDate, endDate, completionPercentage, managerId, req.params.id]
    );
    res.json({ success: true, message: 'Project updated.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/tasks', authenticate, async (req, res, next) => {
  try {
    const { title, description, status, priority, assignedTo, dueDate } = req.body;
    const [result] = await pool.query(
      'INSERT INTO project_tasks (project_id, title, description, status, priority, assigned_to, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, title, description, status || 'todo', priority || 'medium', assignedTo, dueDate, req.user.employeeId]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.put('/tasks/:taskId', authenticate, async (req, res, next) => {
  try {
    const { title, description, status, priority, assignedTo, dueDate, completionPercentage } = req.body;
    await pool.query(
      'UPDATE project_tasks SET title=?, description=?, status=?, priority=?, assigned_to=?, due_date=?, completion_percentage=? WHERE id=?',
      [title, description, status, priority, assignedTo, dueDate, completionPercentage, req.params.taskId]
    );
    res.json({ success: true, message: 'Task updated.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { comment, taskId } = req.body;
    const [result] = await pool.query(
      'INSERT INTO project_comments (project_id, task_id, employee_id, comment) VALUES (?, ?, ?, ?)',
      [req.params.id, taskId || null, req.user.employeeId, comment]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/updates', authenticate, async (req, res, next) => {
  try {
    const { updateText, hoursSpent, updateDate } = req.body;
    const [result] = await pool.query(
      'INSERT INTO project_updates (project_id, employee_id, update_text, hours_spent, update_date) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, req.user.employeeId, updateText, hoursSpent || 0, updateDate || new Date().toISOString().split('T')[0]]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
