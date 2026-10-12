-- ===========================================================================
-- Výjimky v oprávněních pro konkrétní akci + honoráře odděleně (12.10.2026)
-- Navazuje na 2026-10-12_bezpecnost_rls.sql (musí být spuštěný dřív).
--
-- event_access.permissions = oprávnění NAVÍC k roli, platí jen v té jedné
-- akci (např. Crew Member, který v Jakubově projektu vidí Výdaje).
-- Výjimka jen přidává, nikdy neubírá. Povolené klíče jsou jen ty uvnitř akce
-- (záložky + vytvářet/upravovat/mazat) — přes výjimku si nikdo nedá admina,
-- Firmu ani správu lidí.
--
-- Honoráře: částky z `lineup` se přesouvají do nové tabulky `lineup_fees`,
-- kterou databáze vydá jen s oprávněním „Honoráře v Lineupu" (role nebo
-- výjimka). Sloupce fee/deposit/travel_cost/paid z `lineup` se mažou —
-- jinak by je šlo vyčíst i bez oprávnění.
--
-- Spouští se celé najednou v Supabase SQL editoru.
-- ===========================================================================

alter table event_access add column if not exists permissions jsonb not null default '{}'::jsonb;

-- Klíče, které smí být výjimkou. Musí odpovídat EVENT_PERMISSION_KEYS
-- v src/lib/permissions.ts.
create or replace function public.is_event_perm_key(key text) returns boolean
language sql immutable as $$
  select key = any (array[
    'viewPrehled','viewVydaje','viewPrijmy','viewLineup','viewLineupFees','viewTechnika',
    'viewElektrina','viewTym','viewChat','viewSoubory','canCreate','canEdit','canDelete'])
$$;

-- Smí přihlášený uživatel `key` v akci `eid`? = role to dovoluje, NEBO má
-- k akci přístup a v ní výjimku. Přístup k akci samotné je podmínkou vždy.
create or replace function public.has_event_perm(eid uuid, key text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_access_event(eid) and (
    public.has_perm(key)
    or (public.is_event_perm_key(key) and exists (
      select 1 from event_access a
      where a.event_id = eid and a.profile_id = auth.uid()
        and coalesce((a.permissions ->> key)::boolean, false)))
  )
$$;

-- Má uživatel oprávnění aspoň v jedné akci (role nebo výjimka)? Pro tabulky
-- mimo akce, které záložky v akci potřebují (kontakty v Lineupu).
create or replace function public.has_perm_anywhere(key text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_perm(key) or (public.is_event_perm_key(key) and exists (
    select 1 from event_access a
    where a.profile_id = auth.uid() and coalesce((a.permissions ->> key)::boolean, false)))
$$;

create or replace function public.event_id_from_path(path text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end $$;

revoke all on function public.has_event_perm(uuid, text) from public, anon;
revoke all on function public.has_perm_anywhere(text) from public, anon;
grant execute on function public.has_event_perm(uuid, text), public.has_perm_anywhere(text),
  public.is_event_perm_key(text), public.event_id_from_path(text) to authenticated;

-- Honoráře do vlastní tabulky ------------------------------------------------
create table if not exists lineup_fees (
  lineup_id uuid primary key references lineup(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  fee numeric not null default 0,
  deposit numeric not null default 0,
  travel_cost numeric not null default 0,
  paid boolean not null default false,
  created_at timestamp with time zone default now()
);
alter table lineup_fees enable row level security;
revoke all on lineup_fees from anon;

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'lineup' and column_name = 'fee') then
    insert into lineup_fees (lineup_id, event_id, fee, deposit, travel_cost, paid)
    select id, event_id, coalesce(fee, 0), coalesce(deposit, 0), coalesce(travel_cost, 0), coalesce(paid, false)
    from lineup where event_id is not null
    on conflict (lineup_id) do nothing;
    alter table lineup drop column fee;
    alter table lineup drop column deposit;
    alter table lineup drop column travel_cost;
    alter table lineup drop column paid;
  end if;
end $$;

-- Realtime pro novou tabulku (Lineup se obnovuje i při změně honoráře)
do $$ begin
  alter publication supabase_realtime add table lineup_fees;
exception when others then null;
end $$;

-- Politiky: všechno, co je navázané na akci, přepnout z has_perm na
-- has_event_perm (role NEBO výjimka v té akci) ----------------------------
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'events','expenses','income','lineup','lineup_fees','team_contributions','notes',
      'documents','event_equipment','tasks','contacts')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy events_select on events for select to authenticated
  using (public.can_access_event(id));
create policy events_insert on events for insert to authenticated
  with check (public.has_perm('canCreate'));
create policy events_update on events for update to authenticated
  using (public.has_event_perm(id, 'canEdit'))
  with check (public.has_event_perm(id, 'canEdit'));
create policy events_delete on events for delete to authenticated
  using (public.can_access_event(id) and public.has_perm('canDeleteEvent'));

-- Editor v akci (přes výjimku) smí měnit rozpočty, marži, popis… ale ne to,
-- kdo akci vidí, kdo ji založil ani jestli se počítá do přehledů — to jen
-- admin nebo zakladatel. service_role (auth.uid() = null) smí vše.
create or replace function public.events_guard_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not (public.is_admin() or old.created_by = auth.uid())
     and (new.admin_access_mode is distinct from old.admin_access_mode
          or new.created_by is distinct from old.created_by
          or new.include_in_totals is distinct from old.include_in_totals) then
    raise exception 'Přístup k akci a započítávání do přehledů smí měnit jen admin nebo zakladatel akce.';
  end if;
  return new;
end $$;
drop trigger if exists events_guard_columns on events;
create trigger events_guard_columns before update on events
  for each row execute function public.events_guard_columns();

create or replace function pg_temp.event_child_policies(tbl text, view_cond text) returns void
language plpgsql as $$
begin
  execute format('create policy %I on %I for select to authenticated using (%s)',
    tbl || '_select', tbl, view_cond);
  execute format('create policy %I on %I for insert to authenticated with check (public.has_event_perm(event_id, ''canCreate''))',
    tbl || '_insert', tbl);
  execute format('create policy %I on %I for update to authenticated using (public.has_event_perm(event_id, ''canEdit'')) with check (public.has_event_perm(event_id, ''canEdit''))',
    tbl || '_update', tbl);
  execute format('create policy %I on %I for delete to authenticated using (public.has_event_perm(event_id, ''canDelete''))',
    tbl || '_delete', tbl);
end $$;

select pg_temp.event_child_policies('expenses',
  'public.has_event_perm(event_id, ''viewVydaje'') or public.has_event_perm(event_id, ''viewPrehled'') or (category = ''TECHNIKA'' and public.has_event_perm(event_id, ''viewTechnika''))');
select pg_temp.event_child_policies('income',
  'public.has_event_perm(event_id, ''viewPrijmy'') or public.has_event_perm(event_id, ''viewPrehled'')');
select pg_temp.event_child_policies('lineup', 'public.has_event_perm(event_id, ''viewLineup'')');
select pg_temp.event_child_policies('lineup_fees', 'public.has_event_perm(event_id, ''viewLineupFees'')');
select pg_temp.event_child_policies('notes', 'public.has_event_perm(event_id, ''viewChat'')');
select pg_temp.event_child_policies('documents', 'public.has_event_perm(event_id, ''viewSoubory'')');
select pg_temp.event_child_policies('event_equipment',
  'public.has_event_perm(event_id, ''viewTechnika'') or public.has_event_perm(event_id, ''viewElektrina'')');
select pg_temp.event_child_policies('team_contributions',
  'public.has_event_perm(event_id, ''viewTym'') or (public.has_perm(''viewFirma'') and public.can_access_event(event_id))');

create policy tasks_select on tasks for select to authenticated
  using (case when event_id is null then public.has_perm('viewUkoly') else public.has_event_perm(event_id, 'viewUkoly') end);
create policy tasks_insert on tasks for insert to authenticated
  with check (case when event_id is null then public.has_perm('canCreate') else public.has_event_perm(event_id, 'canCreate') end);
create policy tasks_update on tasks for update to authenticated
  using (case when event_id is null then public.has_perm('canEdit') else public.has_event_perm(event_id, 'canEdit') end)
  with check (case when event_id is null then public.has_perm('canEdit') else public.has_event_perm(event_id, 'canEdit') end);
create policy tasks_delete on tasks for delete to authenticated
  using (case when event_id is null then public.has_perm('canDelete') else public.has_event_perm(event_id, 'canDelete') end);

create policy contacts_select on contacts for select to authenticated
  using (public.has_perm('viewKontakty') or public.has_perm_anywhere('viewLineup'));
create policy contacts_insert on contacts for insert to authenticated with check (public.has_perm('canCreate'));
create policy contacts_update on contacts for update to authenticated
  using (public.has_perm('canEdit')) with check (public.has_perm('canEdit'));
create policy contacts_delete on contacts for delete to authenticated using (public.has_perm('canDelete'));

-- Úložiště: stejné pravidlo jako tabulka documents
drop policy if exists documents_select on storage.objects;
drop policy if exists documents_insert on storage.objects;
drop policy if exists documents_delete on storage.objects;
create policy documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.has_event_perm(public.event_id_from_path(name), 'viewSoubory'));
create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.has_event_perm(public.event_id_from_path(name), 'canCreate'));
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.has_event_perm(public.event_id_from_path(name), 'canDelete'));

-- Kontrola: musí vrátit stejný počet řádků jako lineup
-- select (select count(*) from lineup) as lineup, (select count(*) from lineup_fees) as fees;
