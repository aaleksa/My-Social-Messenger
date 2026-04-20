-- SQLite does not support DROP COLUMN before version 3.35.0
-- Recreate tables without image_url if rollback needed
SELECT 1;
