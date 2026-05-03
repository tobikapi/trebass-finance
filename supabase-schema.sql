-- Třebass Finance - Databázové schéma
-- Spusť tento SQL v Supabase SQL Editoru

create table events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  date date,
  location text,
  type text,
  status text default 'pripravuje_se' check (status in ('pripravuje_se', 'probihá', 'dokonceno', 'archivovano')),
  description text,
  created_at timestamp with time zone default now()
);

create table expenses (
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

create table income (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  source text not null,
  amount numeric default 0,
  note text,
  created_at timestamp with time zone default now()
);

create table lineup (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  artist_name text not null,
  fee numeric default 0,
  deposit numeric default 0,
  paid boolean default false,
  set_time text,
  notes text,
  created_at timestamp with time zone default now()
);

create table team_contributions (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  name text not null,
  amount numeric default 0,
  note text,
  created_at timestamp with time zone default now()
);

-- Povol přístup pro anon klíč (všichni mohou číst a psát)
alter table events enable row level security;
alter table expenses enable row level security;
alter table income enable row level security;
alter table lineup enable row level security;
alter table team_contributions enable row level security;

create policy "allow all" on events for all using (true) with check (true);
create policy "allow all" on expenses for all using (true) with check (true);
create policy "allow all" on income for all using (true) with check (true);
create policy "allow all" on lineup for all using (true) with check (true);
create policy "allow all" on team_contributions for all using (true) with check (true);
