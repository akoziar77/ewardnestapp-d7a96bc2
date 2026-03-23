
-- Phase 3: Add admin review flag and retry count to receipt_uploads
alter table public.receipt_uploads
  add column if not exists admin_review_flag boolean not null default false,
  add column if not exists retry_count integer not null default 0,
  add column if not exists normalized_merchant text;

-- Phase 3: Add SKU to line items
alter table public.receipt_line_items
  add column if not exists sku text,
  add column if not exists category text;
