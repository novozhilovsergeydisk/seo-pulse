-- 006_audit_recommendations.sql
ALTER TABLE audits ADD COLUMN IF NOT EXISTS recommendations TEXT;
