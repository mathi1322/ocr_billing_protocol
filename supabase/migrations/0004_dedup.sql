-- 0004: file-level deduplication
-- SHA-256 of the uploaded bytes, checked BEFORE any AI call so re-uploads
-- of the same document cost nothing.

alter table invoices add column if not exists content_hash text;
create index if not exists invoices_user_hash_idx on invoices(user_id, content_hash);
