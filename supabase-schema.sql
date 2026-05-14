-- Třebass Finance - Databázové schéma
-- Spusť tento SQL v Supabase SQL Editoru
-- DŮLEŽITÉ: Pokud tabulky již existují, použij ALTER TABLE pro přidání chybějících sloupců.

create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  date date,
  date_end date,
  time_start text,
  time_end text,
  location text,
  type text,
  status text default 'pripravuje_se' check (status in ('pripravuje_se', 'probihá', 'dokonceno', 'archivovano')),
  description text,
  stages text[] default '{}',
  budgets jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Přidej chybějící sloupce pokud tabulka events již existuje:
alter table events add column if not exists date_end date;
alter table events add column if not exists time_start text;
alter table events add column if not exists time_end text;
alter table events add column if not exists stages text[] default '{}';
alter table events add column if not exists budgets jsonb default '{}';

create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  category text not null,
  item text not null,
  note text,
  payment_timing text check (payment_timing in ('PŘED AKCÍ', 'BĚHEM AKCE', 'PO AKCI')),
  price numeric default 0,
  deposit numeric default 0,
  paid boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists income (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  source text not null,
  amount numeric default 0,
  note text,
  created_at timestamp with time zone default now()
);

create table if not exists lineup (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  artist_name text not null,
  fee numeric default 0,
  deposit numeric default 0,
  paid boolean default false,
  set_time text,
  day text,
  stage text,
  notes text,
  created_at timestamp with time zone default now()
);

-- Přidej chybějící sloupce pokud tabulka lineup již existuje:
alter table lineup add column if not exists day text;
alter table lineup add column if not exists stage text;

create table if not exists team_contributions (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  name text not null,
  amount numeric default 0,
  note text,
  created_at timestamp with time zone default now()
);

create table if not exists notes (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  author text not null,
  content text not null,
  created_at timestamp with time zone default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text default 'clen'
);

-- RLS
alter table events enable row level security;
alter table expenses enable row level security;
alter table income enable row level security;
alter table lineup enable row level security;
alter table team_contributions enable row level security;
alter table notes enable row level security;
alter table profiles enable row level security;

-- Policies (create only if they don't exist)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'events'             and policyname = 'allow all') then
    create policy "allow all" on events             for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'expenses'           and policyname = 'allow all') then
    create policy "allow all" on expenses           for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'income'             and policyname = 'allow all') then
    create policy "allow all" on income             for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'lineup'             and policyname = 'allow all') then
    create policy "allow all" on lineup             for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'team_contributions' and policyname = 'allow all') then
    create policy "allow all" on team_contributions for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'notes'              and policyname = 'allow all') then
    create policy "allow all" on notes              for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles'           and policyname = 'allow all') then
    create policy "allow all" on profiles           for all using (true) with check (true); end if;
end $$;
