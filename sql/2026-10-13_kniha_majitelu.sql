-- ===========================================================================
-- Kniha majitelů: vklady, výběry a vyrovnání (13.10.2026)
-- Navazuje na 2026-10-12_bezpecnost_rls.sql a 2026-10-12b_vyjimky_v_akci.sql.
--
-- Jedna kniha všech peněz mezi majiteli (a dalšími lidmi, kteří něco
-- zaplatili za firmu) a firmou. Nahrazuje záložku Tým (team_contributions)
-- a vklady/splátky majitelů ve Firmě. Nad knihou počítá appka, kdo komu
-- kolik pošle, aby do akce / firmy dal každý majitel stejně.
--
--   vklad      = poslal peníze firmě, nebo zaplatil něco za firmu ze svého
--   vyber      = firma mu poslala peníze
--   vyrovnani  = profile_id poslal counterparty_id (mezi lidmi, mimo firmu)
--
-- Majitelé (profiles.is_owner) nesou výsledek rovným dílem. Kdo není
-- majitel (např. Artur), má nárok dostat zpět vše, co za firmu zaplatil.
--
-- Spouští se celé najednou v Supabase SQL editoru.
-- ===========================================================================

alter table profiles add column if not exists is_owner boolean not null default false;
update profiles set is_owner = true where id in (
  'e128536f-53af-4f10-90ba-c8c9a69ce8d9',  -- Tobiáš Kapek
  '4d960ab6-33e4-408b-937f-5be54ae5fa70',  -- Jakub Kladiva
  '896c261e-ab88-4b8a-b895-36a563a2856e'   -- Metoděj Hovorka
);

create table if not exists owner_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete restrict,
  counterparty_id uuid references profiles(id) on delete restrict,
  kind text not null check (kind in ('vklad', 'vyber', 'vyrovnani')),
  amount numeric not null check (amount > 0),
  event_id uuid references events(id) on delete cascade,  -- null = Firma obecně
  date date,
  note text,
  source text not null default 'rucne' check (source in ('rucne', 'tym', 'firma', 'kalkulacka', 'vypis')),
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamp with time zone default now(),
  check ((kind = 'vyrovnani') = (counterparty_id is not null)),
  check (counterparty_id is null or counterparty_id <> profile_id)
);
create index if not exists owner_ledger_event_idx on owner_ledger(event_id);
create index if not exists owner_ledger_profile_idx on owner_ledger(profile_id);

-- Ručně zadaný zůstatek na účtu firmy (z bankovnictví) — s datem, ke kdy platí.
create table if not exists company_balance (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  as_of date not null default current_date,
  note text,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamp with time zone default now()
);

alter table owner_ledger enable row level security;
alter table company_balance enable row level security;
revoke all on owner_ledger from anon;
revoke all on company_balance from anon;

-- Číst: Firma (vše), nebo Tým v dané akci (jen pohyby té akce).
-- Měnit: Firma + vytvářet/upravovat/mazat; pohyby akce i přes Tým v akci.
create or replace function public.can_ledger(eid uuid, action text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when eid is null then public.has_perm('viewFirma') and (action = 'view' or public.has_perm(action))
    else (public.has_perm('viewFirma') and public.can_access_event(eid) and (action = 'view' or public.has_perm(action)))
      or (public.has_event_perm(eid, 'viewTym') and (action = 'view' or public.has_event_perm(eid, action)))
  end
$$;
revoke all on function public.can_ledger(uuid, text) from public, anon;
grant execute on function public.can_ledger(uuid, text) to authenticated;

drop policy if exists owner_ledger_select on owner_ledger;
drop policy if exists owner_ledger_insert on owner_ledger;
drop policy if exists owner_ledger_update on owner_ledger;
drop policy if exists owner_ledger_delete on owner_ledger;
create policy owner_ledger_select on owner_ledger for select to authenticated using (public.can_ledger(event_id, 'view'));
create policy owner_ledger_insert on owner_ledger for insert to authenticated with check (public.can_ledger(event_id, 'canCreate'));
create policy owner_ledger_update on owner_ledger for update to authenticated
  using (public.can_ledger(event_id, 'canEdit')) with check (public.can_ledger(event_id, 'canEdit'));
create policy owner_ledger_delete on owner_ledger for delete to authenticated using (public.can_ledger(event_id, 'canDelete'));

drop policy if exists company_balance_select on company_balance;
drop policy if exists company_balance_insert on company_balance;
drop policy if exists company_balance_delete on company_balance;
create policy company_balance_select on company_balance for select to authenticated using (public.has_perm('viewFirma'));
create policy company_balance_insert on company_balance for insert to authenticated
  with check (public.has_perm('viewFirma') and public.has_perm('canCreate'));
create policy company_balance_delete on company_balance for delete to authenticated
  using (public.has_perm('viewFirma') and public.has_perm('canDelete'));

do $$ begin
  alter publication supabase_realtime add table owner_ledger;
exception when others then null;
end $$;

-- Převod dat -------------------------------------------------------------
-- Jména v team_contributions jsou psaná ručně a nejednotně („JAKUB",
-- „Jakub ", „Tobias", „Metodej"…). Přiřadí se podle křestního jména bez
-- diakritiky; neznámé jméno migraci zastaví, ať se nic neztratí potichu.
create or replace function pg_temp.person_id(raw text) returns uuid
language plpgsql as $$
declare k text := lower(translate(trim(raw), 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ', 'acdeeinorstuuyzACDEEINORSTUUYZ'));
begin
  k := split_part(k, ' ', 1);
  return case k
    when 'tobias' then 'e128536f-53af-4f10-90ba-c8c9a69ce8d9'::uuid
    when 'jakub' then '4d960ab6-33e4-408b-937f-5be54ae5fa70'::uuid
    when 'metodej' then '896c261e-ab88-4b8a-b895-36a563a2856e'::uuid
    when 'artur' then 'a66f1c2c-4ec7-4238-9846-486b346f84ea'::uuid
    else null end;
end $$;

do $$
declare bad text;
begin
  -- Spustit jen jednou (kniha je prázdná)
  if exists (select 1 from owner_ledger) then
    raise notice 'owner_ledger už obsahuje data, převod přeskočen';
    return;
  end if;

  select string_agg(distinct name, ', ') into bad from team_contributions
  where pg_temp.person_id(name) is null and amount > 0;
  if bad is not null then raise exception 'Neznámá jména v team_contributions: %', bad; end if;

  select string_agg(distinct coalesce(name, '(prázdné)'), ', ') into bad from company_income
  where source = 'VKLAD Z ÚSPOR' and pg_temp.person_id(coalesce(name, '')) is null;
  if bad is not null then raise exception 'Neznámá jména ve vkladech Firmy: %', bad; end if;

  insert into owner_ledger (profile_id, kind, amount, event_id, date, note, source, created_by, created_at)
  select pg_temp.person_id(name), 'vklad', amount, event_id, created_at::date, note, 'tym', null, created_at
  from team_contributions where amount > 0;

  insert into owner_ledger (profile_id, kind, amount, event_id, date, note, source, created_by, created_at)
  select pg_temp.person_id(name), 'vklad', amount, null, coalesce(date, created_at::date), note, 'firma', null, created_at
  from company_income where source = 'VKLAD Z ÚSPOR';
  delete from company_income where source = 'VKLAD Z ÚSPOR';

  -- Splátky majitelům z Firmy = výběry (zatím žádné, ale pro jistotu)
  select string_agg(distinct item, ', ') into bad from company_expenses where category = 'SPLATKY MAJITELŮ';
  if bad is not null then
    raise exception 'Ve Firmě jsou splátky majitelům (%), převeď je ručně do Knihy', bad;
  end if;
end $$;

-- team_contributions zůstává jako archiv (appka ji už nepoužívá), nic se nemaže.

-- Kontrola: počet a součet musí sedět
-- select (select count(*) from team_contributions where amount > 0) tym, (select count(*) from owner_ledger where source='tym') kniha,
--        (select sum(amount) from team_contributions) tym_sum, (select sum(amount) from owner_ledger where source='tym') kniha_sum;
