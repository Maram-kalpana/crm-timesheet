-- Project update enhancements: website URL, update-linked documents
USE hrms_db;

ALTER TABLE project_updates
  ADD COLUMN IF NOT EXISTS website_url VARCHAR(500) NULL AFTER git_repo;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS project_update_id INT NULL AFTER project_id;

-- Add FK only if not already present (ignore error on re-run)
-- ALTER TABLE documents ADD CONSTRAINT fk_documents_project_update
--   FOREIGN KEY (project_update_id) REFERENCES project_updates(id) ON DELETE SET NULL;
