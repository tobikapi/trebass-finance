-- Třebass Finance - Databázové schéma
-- Aktuální stav k 2026-05-15
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
  lineup_artist_id uuid,
  created_at timestamp with time zone default now()
);

alter table expenses add column if not exists lineup_artist_id uuid;

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
  date date,
  stage text,
  notes text,
  created_at timestamp with time zone default now()
);

-- date = datum vystoupení (pro vícedenní akce), day je zastaralý sloupec ponechaný z migrace
alter table lineup add column if not exists date date;
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

create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text,
  fee numeric default 0,
  email text,
  phone text,
  note text,
  created_at timestamp with time zone default now()
);

create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  assigned_to text,
  assigned_to_members text[] default '{}',
  status text default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  event_id uuid references events(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table tasks add column if not exists assigned_to_members text[] default '{}';

create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  name text not null,
  file_path text not null,
  file_size bigint,
  file_type text,
  uploaded_by text,
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
alter table contacts enable row level security;
alter table tasks enable row level security;
alter table documents enable row level security;
alter table profiles enable row level security;

-- Policies — allow all (role systém je dočasně vypnutý)
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
  if not exists (select 1 from pg_policies where tablename = 'contacts'           and policyname = 'allow all') then
    create policy "allow all" on contacts           for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'tasks'              and policyname = 'allow all') then
    create policy "allow all" on tasks              for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'documents'          and policyname = 'allow all') then
    create policy "allow all" on documents          for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles'           and policyname = 'allow all') then
    create policy "allow all" on profiles           for all using (true) with check (true); end if;
end $$;

-- ON DELETE CASCADE pro lineup_artist_id v expenses
-- (pokud ještě není nastaveno)
-- ALTER TABLE expenses ADD CONSTRAINT fk_lineup_artist
--   FOREIGN KEY (lineup_artist_id) REFERENCES lineup(id) ON DELETE CASCADE;
