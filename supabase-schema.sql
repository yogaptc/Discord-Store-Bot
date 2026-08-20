-- ════════════════════════════════════════════════════════════════
-- supabase-schema.sql
-- Jalankan di Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ════════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Tabel: products ──────────────────────────────────────────────
create table if not exists products (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  price       integer not null check (price > 0),   -- dalam Rupiah
  description text default '-',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Tabel: stocks ────────────────────────────────────────────────
create table if not exists stocks (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references products(id) on delete cascade,
  key_value   text not null,
  is_sold     boolean default false,
  sold_at     timestamptz,
  created_at  timestamptz default now()
);

-- ── Tabel: transactions ──────────────────────────────────────────
create table if not exists transactions (
  id                  uuid primary key default uuid_generate_v4(),
  order_id            text not null unique,          -- Midtrans order_id
  user_id             text not null,                 -- Discord user ID
  discord_channel_id  text,                          -- Channel asal command
  type                text not null check (type in ('purchase', 'donation')),
  product_id          uuid references products(id),  -- Null untuk donasi
  amount              integer not null,
  status              text default 'pending'
                      check (status in ('pending', 'success', 'failed', 'out_of_stock')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── Index untuk query yang sering dipakai ────────────────────────
create index if not exists idx_stocks_product_id   on stocks(product_id);
create index if not exists idx_stocks_is_sold       on stocks(is_sold);
create index if not exists idx_transactions_order   on transactions(order_id);
create index if not exists idx_transactions_user    on transactions(user_id);
create index if not exists idx_transactions_status  on transactions(status);

-- ── Row Level Security (RLS) ─────────────────────────────────────
-- Nonaktifkan RLS untuk service_role (kita menggunakan service role key di server)
alter table products     disable row level security;
alter table stocks       disable row level security;
alter table transactions disable row level security;

-- ── Trigger auto-update updated_at ──────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_products_updated_at
  before update on products
  for each row execute function update_updated_at();

create trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function update_updated_at();

-- ── Data contoh (opsional, hapus sebelum production) ────────────
-- insert into products (name, price, description) values
--   ('Netflix Premium 1 Bulan', 45000, 'Akun Netflix Premium shared 1 bulan'),
--   ('Spotify Premium 3 Bulan', 55000, 'Akun Spotify Premium 3 bulan garansi');
