-- Multi-tenant scoping + client payment income. Additive only.
USE hrms_db;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS company_id INT NULL AFTER id;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS company_id INT NULL AFTER id;

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NULL,
  client VARCHAR(255),
  period_label VARCHAR(100),
  period_start DATE NULL,
  period_end DATE NULL,
  client_email VARCHAR(255),
  subject VARCHAR(255),
  total_amount DECIMAL(12,2) DEFAULT 0,
  amount_received DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(40) DEFAULT 'sent',
  sent_by_user_id INT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS company_id INT NULL AFTER id;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  transaction_id VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  notes TEXT NULL,
  receipt_path VARCHAR(255) NULL,
  recorded_by_user_id INT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reversed_at TIMESTAMP NULL,
  reversed_by_user_id INT NULL,
  reversed_reason TEXT NULL
);

CREATE TABLE IF NOT EXISTS income (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  invoice_id INT NOT NULL,
  payment_id INT NOT NULL,
  client VARCHAR(255),
  client_email VARCHAR(255),
  period_label VARCHAR(100),
  period_start DATE NULL,
  period_end DATE NULL,
  invoice_subject VARCHAR(255),
  invoice_total DECIMAL(12,2) DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  payment_date DATE NOT NULL,
  transaction_id VARCHAR(100),
  notes TEXT NULL,
  receipt_path VARCHAR(255) NULL,
  employee_details JSON NULL,
  timesheet_count INT DEFAULT 0,
  recorded_by_user_id INT NULL,
  reversed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_income_payment (payment_id),
  INDEX idx_income_company (company_id),
  INDEX idx_income_date (payment_date)
);

-- Backfill company_id on existing rows from the owning user
UPDATE departments d
JOIN employees e ON d.head_id = e.id
JOIN users u ON e.user_id = u.id
SET d.company_id = u.company_id
WHERE d.company_id IS NULL AND u.company_id IS NOT NULL;

UPDATE projects p
JOIN employees e ON p.manager_id = e.id
JOIN users u ON e.user_id = u.id
SET p.company_id = u.company_id
WHERE p.company_id IS NULL AND u.company_id IS NOT NULL;

UPDATE invoices i
JOIN users u ON i.sent_by_user_id = u.id
SET i.company_id = u.company_id
WHERE i.company_id IS NULL AND u.company_id IS NOT NULL;
