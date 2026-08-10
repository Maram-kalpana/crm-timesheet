-- Schema fixes to align database with application code (run once)
USE hrms_db;

-- Attendance clock-out fields
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS clock_out_location VARCHAR(255) NULL AFTER location,
  ADD COLUMN IF NOT EXISTS clock_out_selfie_url VARCHAR(255) NULL AFTER selfie_url;

-- Projects tech stack
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS tech_stack JSON NULL AFTER manager_id;

-- Project updates extended fields
ALTER TABLE project_updates
  ADD COLUMN IF NOT EXISTS git_repo VARCHAR(500) NULL AFTER update_text,
  ADD COLUMN IF NOT EXISTS credentials TEXT NULL AFTER git_repo,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NULL AFTER credentials;

-- Extended document types
ALTER TABLE documents
  MODIFY COLUMN type ENUM(
    'offer_letter', 'id_card', 'experience_letter', 'relieving_letter',
    'company_policy', 'salary_revision', 'resume', 'education_certificate',
    'aadhaar', 'pan', 'other'
  ) NOT NULL DEFAULT 'other';

-- Bank branch (optional)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100) NULL AFTER bank_ifsc,
  ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(100) NULL AFTER bank_branch;
