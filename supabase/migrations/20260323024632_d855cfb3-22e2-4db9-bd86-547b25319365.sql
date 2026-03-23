
-- 1. Main receipt uploads table
create table if not exists public.receipt_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  brand_id uuid references public.brands(id),
  file_path text,
  ocr_text text,
  merchant_name text,
  total_amount numeric,
  purchase_date timestamptz,
  status text not null default 'pending',
  confidence numeric,
  created_at timestamptz not null default now()
);

-- 2. Line items extracted from OCR
create table if not exists public.receipt_line_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipt_uploads(id) on delete cascade,
  item_name text,
  quantity numeric,
  price numeric,
  created_at timestamptz not null default now()
);

-- 3. Processing logs for debugging + admin review
create table if not exists public.receipt_processing_logs (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipt_uploads(id) on delete cascade,
  step text,
  message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- 4. Brand aliases for fuzzy merchant matching
create table if not exists public.brand_aliases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_receipt_uploads_user on public.receipt_uploads(user_id);
create index if not exists idx_receipt_uploads_brand on public.receipt_uploads(brand_id);
create index if not exists idx_receipt_line_items_receipt on public.receipt_line_items(receipt_id);
create index if not exists idx_brand_aliases_brand on public.brand_aliases(brand_id);

-- RLS
alter table public.receipt_uploads enable row level security;
alter table public.receipt_line_items enable row level security;
alter table public.receipt_processing_logs enable row level security;
alter table public.brand_aliases enable row level security;

-- receipt_uploads policies
create policy "Users can view own receipts" on public.receipt_uploads for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own receipts" on public.receipt_uploads for insert to authenticated with check (auth.uid() = user_id);
create policy "Service role can manage receipts" on public.receipt_uploads for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "Admins can view all receipts" on public.receipt_uploads for select to authenticated using (public.is_admin());

-- receipt_line_items policies
create policy "Users can view own line items" on public.receipt_line_items for select to authenticated using (
  exists (select 1 from public.receipt_uploads r where r.id = receipt_id and r.user_id = auth.uid())
);
create policy "Service role can manage line items" on public.receipt_line_items for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- receipt_processing_logs policies
create policy "Admins can view processing logs" on public.receipt_processing_logs for select to authenticated using (public.is_admin());
create policy "Service role can manage processing logs" on public.receipt_processing_logs for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- brand_aliases policies
create policy "Anyone can view brand aliases" on public.brand_aliases for select to authenticated using (true);
create policy "Admins can manage brand aliases" on public.brand_aliases for all to authenticated using (public.is_admin()) with check (public.is_admin());
