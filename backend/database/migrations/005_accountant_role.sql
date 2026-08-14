-- Accountant role + timesheet billing fields + entry comments
USE hrms_db;

ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'hr', 'manager', 'team_lead', 'employee', 'accountant') DEFAULT 'employee';

ALTER TABLE timesheet_entries
  ADD COLUMN IF NOT EXISTS comments VARCHAR(50) NULL AFTER hours;

ALTER TABLE timesheets
  ADD COLUMN IF NOT EXISTS client_email VARCHAR(255) NULL AFTER client,
  ADD COLUMN IF NOT EXISTS sent_to_client_at TIMESTAMP NULL AFTER status,
  ADD COLUMN IF NOT EXISTS sent_by_user_id INT NULL AFTER sent_to_client_at,
  ADD COLUMN IF NOT EXISTS amount_due DECIMAL(12,2) NULL AFTER total_wage;
