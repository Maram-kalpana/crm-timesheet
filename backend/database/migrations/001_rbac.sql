-- RBAC & workflow migration (run once on existing database)
USE hrms_db;

-- Add team_lead role (keeps manager for backward compatibility)
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'hr', 'manager', 'team_lead', 'employee') DEFAULT 'employee';
UPDATE users SET role = 'team_lead' WHERE role = 'manager';

-- Employment status on employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employment_status ENUM('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED') DEFAULT 'ACTIVE' AFTER employment_type;

-- Resignations
CREATE TABLE IF NOT EXISTS resignations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  reason TEXT,
  last_working_date DATE,
  status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
  approved_by INT NULL,
  approved_at DATETIME NULL,
  experience_letter_url VARCHAR(255) NULL,
  relieving_letter_url VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL
);

-- Ensure documents table matches code (employee docs only; project_id optional)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS project_id INT NULL AFTER employee_id;

ALTER TABLE documents MODIFY COLUMN employee_id INT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_reporting_manager ON employees(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee ON documents(employee_id);
