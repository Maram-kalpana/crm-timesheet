const bcrypt = require('bcrypt');
const pool = require('../config/db');
require('dotenv').config();

async function seed() {
  const connection = await pool.getConnection();
  try {
    console.log('Seeding database...');

    await connection.query(`
      INSERT IGNORE INTO departments (id, name, description) VALUES
      (1, 'Engineering', 'Software Development Team'),
      (2, 'Human Resources', 'HR and People Operations'),
      (3, 'Design', 'UI/UX and Product Design'),
      (4, 'Marketing', 'Marketing and Growth'),
      (5, 'Finance', 'Finance and Accounting')
    `);

    await connection.query(`
      INSERT IGNORE INTO leave_types (id, name, days_allowed, description, is_paid) VALUES
      (1, 'Casual Leave', 12, 'Casual leave for personal matters', TRUE),
      (2, 'Sick Leave', 10, 'Medical leave', TRUE),
      (3, 'Earned Leave', 15, 'Annual earned leave', TRUE),
      (4, 'Unpaid Leave', 0, 'Leave without pay', FALSE)
    `);

    const hashedPassword = await bcrypt.hash('Admin@123', 10);

    await connection.query(`
      INSERT IGNORE INTO users (id, employee_id, email, password, role) VALUES
      (1, 'EMP001', 'admin@company.com', ?, 'admin'),
      (2, 'EMP002', 'hr@company.com', ?, 'hr'),
      (3, 'EMP003', 'john.doe@company.com', ?, 'employee'),
      (4, 'EMP004', 'jane.smith@company.com', ?, 'employee'),
      (5, 'EMP005', 'mike.wilson@company.com', ?, 'manager')
    `, [hashedPassword, hashedPassword, hashedPassword, hashedPassword, hashedPassword]);

    await connection.query(`
      INSERT IGNORE INTO employees (id, user_id, first_name, last_name, phone, department_id, designation, joining_date, employment_type) VALUES
      (1, 1, 'Admin', 'User', '9876543210', 2, 'System Administrator', '2020-01-01', 'full-time'),
      (2, 2, 'Sarah', 'Johnson', '9876543211', 2, 'HR Manager', '2020-03-15', 'full-time'),
      (3, 3, 'John', 'Doe', '9876543212', 1, 'Senior Developer', '2021-06-01', 'full-time'),
      (4, 4, 'Jane', 'Smith', '9876543213', 3, 'UI/UX Designer', '2022-01-10', 'full-time'),
      (5, 5, 'Mike', 'Wilson', '9876543214', 1, 'Engineering Manager', '2019-08-20', 'full-time')
    `);

    const today = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();

    for (let empId = 1; empId <= 5; empId++) {
      for (let ltId = 1; ltId <= 3; ltId++) {
        await connection.query(`
          INSERT IGNORE INTO leave_balances (employee_id, leave_type_id, total_days, used_days, year)
          SELECT ?, ?, days_allowed, 0, ? FROM leave_types WHERE id = ?
        `, [empId, ltId, year, ltId]);
      }
    }

    await connection.query(`
      INSERT IGNORE INTO salary_structures (employee_id, basic_salary, hra, transport_allowance, medical_allowance, special_allowance, pf_deduction, tax_deduction, effective_from) VALUES
      (1, 80000, 32000, 5000, 3000, 10000, 9600, 15000, '2020-01-01'),
      (2, 70000, 28000, 5000, 3000, 8000, 8400, 12000, '2020-03-15'),
      (3, 90000, 36000, 5000, 3000, 15000, 10800, 18000, '2021-06-01'),
      (4, 65000, 26000, 5000, 3000, 7000, 7800, 10000, '2022-01-10'),
      (5, 120000, 48000, 8000, 5000, 20000, 14400, 25000, '2019-08-20')
    `);

    await connection.query(`
      INSERT IGNORE INTO projects (id, name, description, status, priority, start_date, end_date, completion_percentage, manager_id, created_by) VALUES
      (1, 'HRMS Platform', 'Build internal HR management system', 'active', 'high', '2025-01-01', '2025-12-31', 65, 5, 1),
      (2, 'Mobile App Redesign', 'Redesign mobile application UI', 'active', 'medium', '2025-03-01', '2025-08-31', 40, 5, 1),
      (3, 'API Gateway', 'Microservices API gateway implementation', 'planning', 'high', '2025-06-01', '2025-11-30', 10, 5, 1)
    `);

    await connection.query(`
      INSERT IGNORE INTO project_members (project_id, employee_id, role) VALUES
      (1, 3, 'developer'), (1, 4, 'designer'), (1, 5, 'manager'),
      (2, 3, 'developer'), (2, 4, 'lead'),
      (3, 3, 'developer'), (3, 5, 'manager')
    `);

    await connection.query(`
      INSERT IGNORE INTO project_tasks (project_id, title, status, priority, assigned_to, created_by) VALUES
      (1, 'Setup authentication module', 'done', 'high', 3, 5),
      (1, 'Build attendance tracking', 'in-progress', 'high', 3, 5),
      (1, 'Design dashboard UI', 'review', 'medium', 4, 5),
      (1, 'Implement leave management', 'todo', 'medium', 3, 5),
      (2, 'Create wireframes', 'done', 'high', 4, 5),
      (2, 'Develop new components', 'in-progress', 'medium', 3, 5)
    `);

    await connection.query(`
      INSERT IGNORE INTO announcements (title, content, type, priority, created_by, is_active) VALUES
      ('Welcome to HRMS', 'Our new HR management system is now live!', 'general', 'high', 1, TRUE),
      ('Team Building Event', 'Join us for team building on Friday at 4 PM', 'event', 'medium', 2, TRUE),
      ('Updated Leave Policy', 'Please review the updated leave policy in the documents section', 'policy', 'high', 2, TRUE)
    `);

    await connection.query(`
      INSERT IGNORE INTO holidays (name, date, type) VALUES
      ('Republic Day', '2025-01-26', 'national'),
      ('Independence Day', '2025-08-15', 'national'),
      ('Diwali', '2025-10-20', 'national'),
      ('Christmas', '2025-12-25', 'national'),
      ('Company Foundation Day', '2025-07-15', 'company')
    `);

    await connection.query(`
      INSERT IGNORE INTO attendance (employee_id, date, clock_in, clock_out, status, working_hours) VALUES
      (3, ?, '09:00:00', '18:00:00', 'present', 8.0),
      (4, ?, '09:15:00', '18:00:00', 'late', 7.75),
      (5, ?, '08:45:00', '18:30:00', 'present', 8.75)
    `, [today, today, today]);

    console.log('Database seeded successfully!');
    console.log('Default login: admin@company.com / Admin@123');
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seed();
