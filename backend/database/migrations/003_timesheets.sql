-- Timesheet submission tables
USE hrms_db;

CREATE TABLE IF NOT EXISTS timesheets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  client VARCHAR(255),
  manager_name VARCHAR(255),
  rate_type ENUM('Hourly', 'Daily', 'Monthly') DEFAULT 'Hourly',
  rate_value DECIMAL(12,2) DEFAULT 0,
  period_type ENUM('Weekly', 'Monthly') NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_label VARCHAR(100),
  total_hours DECIMAL(8,2) DEFAULT 0,
  total_wage DECIMAL(12,2) DEFAULT 0,
  status ENUM('submitted', 'reviewed') DEFAULT 'submitted',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  timesheet_id INT NOT NULL,
  entry_date DATE NULL,
  day_name VARCHAR(10),
  task_description TEXT,
  hours DECIMAL(5,2) DEFAULT 0,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (timesheet_id) REFERENCES timesheets(id) ON DELETE CASCADE
);
