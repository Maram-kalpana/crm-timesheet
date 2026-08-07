CREATE DATABASE IF NOT EXISTS hrms_db;
USE hrms_db;

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  head_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'hr', 'manager', 'employee') DEFAULT 'employee',
  is_active BOOLEAN DEFAULT TRUE,
  reset_token VARCHAR(255) NULL,
  reset_token_expiry DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other'),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  pincode VARCHAR(10),
  department_id INT,
  designation VARCHAR(100),
  joining_date DATE,
  employment_type ENUM('full-time', 'part-time', 'contract', 'intern') DEFAULT 'full-time',
  reporting_manager_id INT NULL,
  avatar VARCHAR(255),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(20),
  pan_number VARCHAR(20),
  aadhar_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (reporting_manager_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  clock_in DATETIME,
  clock_out DATETIME,
  status ENUM('present', 'absent', 'late', 'half-day', 'on-leave', 'holiday', 'weekend') DEFAULT 'absent',
  working_hours DECIMAL(5,2) DEFAULT 0,
  location VARCHAR(255),
  selfie_url VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_employee_date (employee_id, date)
);

CREATE TABLE IF NOT EXISTS leave_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  days_allowed INT DEFAULT 0,
  description TEXT,
  is_paid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  leave_type_id INT NOT NULL,
  total_days INT DEFAULT 0,
  used_days INT DEFAULT 0,
  year INT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
  UNIQUE KEY unique_balance (employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  leave_type_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days DECIMAL(4,1) NOT NULL,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
  approved_by INT NULL,
  approved_at DATETIME NULL,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
  FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS leave_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leave_request_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL,
  changed_by INT,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('planning', 'active', 'on-hold', 'completed', 'cancelled') DEFAULT 'planning',
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  start_date DATE,
  end_date DATE,
  completion_percentage INT DEFAULT 0,
  manager_id INT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  employee_id INT NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_member (project_id, employee_id)
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('todo', 'in-progress', 'review', 'done') DEFAULT 'todo',
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  assigned_to INT,
  due_date DATE,
  completion_percentage INT DEFAULT 0,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  task_id INT NULL,
  employee_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  employee_id INT NOT NULL,
  update_text TEXT NOT NULL,
  hours_spent DECIMAL(4,1) DEFAULT 0,
  update_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS salary_structures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  basic_salary DECIMAL(12,2) NOT NULL,
  hra DECIMAL(12,2) DEFAULT 0,
  transport_allowance DECIMAL(12,2) DEFAULT 0,
  medical_allowance DECIMAL(12,2) DEFAULT 0,
  special_allowance DECIMAL(12,2) DEFAULT 0,
  pf_deduction DECIMAL(12,2) DEFAULT 0,
  tax_deduction DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payslips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  basic_salary DECIMAL(12,2) NOT NULL,
  hra DECIMAL(12,2) DEFAULT 0,
  transport_allowance DECIMAL(12,2) DEFAULT 0,
  medical_allowance DECIMAL(12,2) DEFAULT 0,
  special_allowance DECIMAL(12,2) DEFAULT 0,
  gross_salary DECIMAL(12,2) NOT NULL,
  pf_deduction DECIMAL(12,2) DEFAULT 0,
  tax_deduction DECIMAL(12,2) DEFAULT 0,
  other_deductions DECIMAL(12,2) DEFAULT 0,
  net_salary DECIMAL(12,2) NOT NULL,
  working_days INT DEFAULT 0,
  present_days INT DEFAULT 0,
  pdf_url VARCHAR(255),
  status ENUM('draft', 'generated', 'sent') DEFAULT 'draft',
  generated_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_payslip (employee_id, month, year)
);

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  type ENUM('offer_letter', 'id_card', 'experience_letter', 'relieving_letter', 'other') NOT NULL,
  title VARCHAR(200) NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('general', 'holiday', 'policy', 'event') DEFAULT 'general',
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  created_by INT,
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  type ENUM('national', 'regional', 'company') DEFAULT 'company',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning', 'error', 'leave', 'attendance', 'payroll', 'project') DEFAULT 'info',
  link VARCHAR(255),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_employee ON attendance(employee_id);
CREATE INDEX idx_leave_status ON leave_requests(status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_employees_department ON employees(department_id);
