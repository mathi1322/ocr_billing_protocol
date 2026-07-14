-- 0003: remove review-queue statuses (no review workflow in this app)
-- New status model: uploaded -> processing -> extracted | failed
-- Low-confidence extractions remain 'extracted'; quality is conveyed by
-- confidence_score + flagged_fields, not by a separate status.

-- The check constraint kept its original name from the 'bills' table rename
alter table invoices drop constraint if exists bills_status_check;
alter table invoices drop constraint if exists invoices_status_check;

-- Migrate existing rows
update invoices set status = 'failed'
where status = 'needs_review' and extraction_json is null;

update invoices set status = 'extracted'
where status in ('needs_review', 'approved', 'rejected');

alter table invoices add constraint invoices_status_check
    check (status in ('uploaded', 'processing', 'extracted', 'failed'));
