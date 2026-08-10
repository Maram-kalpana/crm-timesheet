const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { normalizeRole, isAdmin, isHr, isTeamLead, getTeamMemberIds } = require('../middleware/rbac');
const { createNotification } = require('./notifications');

const router = express.Router();

const canAccessProject = async (user, projectId) => {
  const role = normalizeRole(user.role);
  if (role === 'admin' || role === 'hr') return true;

  const [membership] = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = ? AND employee_id = ?',
    [projectId, user.employeeId]
  );
  if (membership.length) return true;

  if (role === 'team_lead') {
    const [project] = await pool.query('SELECT manager_id FROM projects WHERE id = ?', [projectId]);
    if (project.length && Number(project[0].manager_id) === Number(user.employeeId)) return true;
    const teamIds = await getTeamMemberIds(Number(user.employeeId));
    if (teamIds.length) {
      const [teamOnProject] = await pool.query(
        `SELECT 1 FROM project_members WHERE project_id = ? AND employee_id IN (${teamIds.map(() => '?').join(',')})`,
        [projectId, ...teamIds]
      );
      if (teamOnProject.length) return true;
    }
  }

  return false;
};

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND p.status = ?'; params.push(status); }
    if (search) { where += ' AND p.name LIKE ?'; params.push(`%${search}%`); }

    const role = normalizeRole(req.user.role);
    const needsMemberJoin = role === 'employee' || role === 'team_lead';
    const joinClause = needsMemberJoin ? 'LEFT JOIN project_members pm ON p.id = pm.project_id' : '';

    if (role === 'employee') {
      where += ' AND (pm.employee_id = ? OR p.manager_id = ?)';
      params.push(req.user.employeeId, req.user.employeeId);
    } else if (role === 'team_lead') {
      const teamIds = await getTeamMemberIds(Number(req.user.employeeId));
      const ids = [Number(req.user.employeeId), ...teamIds];
      where += ` AND (p.manager_id = ? OR pm.employee_id IN (${ids.map(() => '?').join(',')}))`;
      params.push(req.user.employeeId, ...ids);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
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

    const data = projects.map((p) => ({
      ...p,
      tech_stack: typeof p.tech_stack === 'string' ? JSON.parse(p.tech_stack) : (p.tech_stack || []),
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const allowed = await canAccessProject(req.user, projectId);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }

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

    const project = {
      ...projects[0],
      tech_stack: typeof projects[0].tech_stack === 'string' ? JSON.parse(projects[0].tech_stack) : (projects[0].tech_stack || []),
    };

    res.json({ success: true, data: { ...project, members, tasks, comments, updates } });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, authorize('admin', 'hr', 'manager'), async (req, res, next) => {
  try {
    const { name, description, status, priority, startDate, endDate, teamLeadId, memberIds, techStack } = req.body;

    if (!teamLeadId) {
      return res.status(400).json({ success: false, message: 'Team lead is required.' });
    }

    const [result] = await pool.query(
      'INSERT INTO projects (name, description, status, priority, start_date, end_date, manager_id, tech_stack, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, description, status || 'planning', priority || 'medium', startDate, endDate, teamLeadId, JSON.stringify(techStack || []), req.user.employeeId]
    );

    const memberOnlyIds = (memberIds || []).filter((id) => String(id) !== String(teamLeadId));
const allMemberIds = Array.from(new Set([teamLeadId, ...memberOnlyIds]));
const values = allMemberIds.map((id) => [result.insertId, id]);
await pool.query('INSERT INTO project_members (project_id, employee_id) VALUES ?', [values]);

    // Notify team lead + all members about the new assignment
    const allAssignedIds = Array.from(new Set([teamLeadId, ...memberOnlyIds]));
    const [employeeUsers] = await pool.query(
      `SELECT id, user_id FROM employees WHERE id IN (${allAssignedIds.map(() => '?').join(',')})`,
      allAssignedIds
    );

    for (const emp of employeeUsers) {
      const isLead = String(emp.id) === String(teamLeadId);
      await createNotification(
        emp.user_id,
        isLead ? 'Assigned as Team Lead' : 'Added to New Project',
        isLead
          ? `You've been assigned as Team Lead for "${name}" (${startDate} to ${endDate}).`
          : `You've been added to the project "${name}" (${startDate} to ${endDate}).`,
        'project',
        '/projects'
      );
    }

    res.status(201).json({ success: true, message: 'Project created.', id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, authorize('admin', 'hr', 'manager'), async (req, res, next) => {
  try {
    const { name, description, status, priority, startDate, endDate, completionPercentage, teamLeadId, techStack } = req.body;
    await pool.query(
      'UPDATE projects SET name=?, description=?, status=?, priority=?, start_date=?, end_date=?, completion_percentage=?, manager_id=?, tech_stack=? WHERE id=?',
      [name, description, status, priority, startDate, endDate, completionPercentage, teamLeadId, JSON.stringify(techStack || []), req.params.id]
    );
    res.json({ success: true, message: 'Project updated.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/tasks', authenticate, async (req, res, next) => {
  try {
    const allowed = await canAccessProject(req.user, Number(req.params.id));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
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
    const [task] = await pool.query('SELECT project_id FROM project_tasks WHERE id = ?', [req.params.taskId]);
    if (!task.length) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    const allowed = await canAccessProject(req.user, task[0].project_id);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
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
    const allowed = await canAccessProject(req.user, Number(req.params.id));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
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
    const allowed = await canAccessProject(req.user, Number(req.params.id));
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    const { updateText, hoursSpent, updateDate, gitRepo, credentials, status } = req.body;

    if (!updateText) {
      return res.status(400).json({ success: false, message: 'Work done is required.' });
    }

    const finalDate = updateDate || new Date().toISOString().split('T')[0];

    const [result] = await pool.query(
      'INSERT INTO project_updates (project_id, employee_id, update_text, git_repo, credentials, status, hours_spent, update_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, req.user.employeeId, updateText, gitRepo || null, credentials || null, status || null, hoursSpent || 0, finalDate]
    );

    // Notify admins/HR and the project's team lead about this update
    const [projectRows] = await pool.query('SELECT name, manager_id FROM projects WHERE id = ?', [req.params.id]);
    const projectName = projectRows[0]?.name || 'a project';
    const managerId = projectRows[0]?.manager_id;

    const recipientQuery = managerId
      ? `SELECT DISTINCT u.id as user_id FROM users u LEFT JOIN employees e ON e.user_id = u.id WHERE u.role IN ('admin','hr') OR e.id = ?`
      : `SELECT DISTINCT u.id as user_id FROM users u WHERE u.role IN ('admin','hr')`;
    const [recipients] = await pool.query(recipientQuery, managerId ? [managerId] : []);

    const [authorRows] = await pool.query(
      "SELECT CONCAT(first_name, ' ', last_name) as name FROM employees WHERE id = ?",
      [req.user.employeeId]
    );
    const authorName = authorRows[0]?.name || 'An employee';
    const summary = updateText.length > 100 ? `${updateText.slice(0, 100)}…` : updateText;

    for (const r of recipients) {
      if (r.user_id === req.user.id) continue; // don't notify the author about their own update
      await createNotification(
        r.user_id,
        `New Update on ${projectName}`,
        `${authorName} logged an update on ${finalDate}: ${summary}`,
        'project',
        '/projects'
      );
    }

    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;