-- ===========================================================================
-- Více firem v jednom systému: Třebass + Horizon (6.11.2026)
-- Navazuje na všechny migrace z 12.–13.10.2026.
--
-- Co se mění:
--   * nová tabulka `organizations` (firma = festival) a `org_members`
--     (kdo je v jaké firmě, s jakou rolí, jestli je tam majitel),
--   * role patří firmě (`roles.org_id`) — Horizon má vlastní Admin / Crew Member,
--   * `org_id` dostanou všechny „kořenové" tabulky: akce, kontakty, úkoly,
--     Firma (výdaje, příjmy, zůstatek), kniha majitelů a uzávěrky. Tabulky
--     uvnitř akce (výdaje, lineup, technika…) patří firmě přes svou akci,
--   * všechna oprávnění v databázi se počítají VŽDY pro firmu daného řádku:
--     admin Třebassu není adminem Horizonu, dokud ho tam někdo nepřidá.
--
-- Stávající data se celá připíšou Třebassu. Do Horizonu se přidá jen Tobiáš
-- (Admin). Ostatní přidá Tobiáš v appce.
--
-- Přechod: dokud nebude nasazený nový kód, stará appka dál zapisuje bez
-- org_id → sloupce mají dočasně výchozí hodnotu Třebass. Starý kód taky
-- čte roli z `profiles.role_id` a majitele z `profiles.is_owner` — ty
-- zůstávají (jen pro Třebass), smažou se v další migraci po nasazení.
--
-- Spouští se celé najednou v Supabase SQL editoru. Je idempotentní.
-- Návrat: 2026-11-06_vice_firem_NAVRAT.sql
-- ===========================================================================

-- Firmy ----------------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,           -- podle něj kód vybírá branding (src/lib/orgs.ts)
  name text not null,
  created_at timestamp with time zone default now()
);

insert into organizations (id, slug, name) values
  ('7e1b0000-0000-4000-8000-000000000001', 'trebass', 'Třebass'),
  ('7e1b0000-0000-4000-8000-000000000002', 'horizon', 'Horizon')
on conflict (id) do nothing;

-- Role patří firmě -----------------------------------------------------------
alter table roles add column if not exists org_id uuid references organizations(id) on delete cascade;
update roles set org_id = '7e1b0000-0000-4000-8000-000000000001' where org_id is null;
alter table roles alter column org_id set not null;
-- Název role je unikátní jen v rámci firmy (obě firmy mají „Admin").
do $$
declare c text;
begin
  -- jakákoli unikátní kontrola jen na `name` (název neznáme jistě)
  for c in select conname from pg_constraint
    where conrelid = 'public.roles'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (name)'
  loop
    execute format('alter table roles drop constraint %I', c);
  end loop;
end $$;
do $$ begin
  alter table roles add constraint roles_org_name_key unique (org_id, name);
exception when duplicate_table or duplicate_object then null;
end $$;

-- Horizon dostane kopii rolí Admin a Crew Member (stejná oprávnění).
insert into roles (name, color, permissions, is_system, org_id)
select name, color, permissions, is_system, '7e1b0000-0000-4000-8000-000000000002'
from roles
where org_id = '7e1b0000-0000-4000-8000-000000000001' and name in ('Admin', 'Crew Member')
on conflict (org_id, name) do nothing;

-- Členství ve firmě -----------------------------------------------------------
create table if not exists org_members (
  org_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role_id uuid references roles(id) on delete set null,
  is_owner boolean not null default false,
  created_at timestamp with time zone default now(),
  primary key (org_id, profile_id)
);
create index if not exists org_members_profile_idx on org_members(profile_id);

-- Role člena musí být role téže firmy.
create or replace function public.org_members_check_role() returns trigger
language plpgsql as $$
begin
  if new.role_id is not null and not exists (
    select 1 from roles r where r.id = new.role_id and r.org_id = new.org_id) then
    raise exception 'Role nepatří do této firmy.';
  end if;
  return new;
end $$;
drop trigger if exists org_members_check_role on org_members;
create trigger org_members_check_role before insert or update on org_members
  for each row execute function public.org_members_check_role();

-- Všichni současní lidé → Třebass se svou rolí a příznakem majitele.
insert into org_members (org_id, profile_id, role_id, is_owner)
select '7e1b0000-0000-4000-8000-000000000001', id, role_id, is_owner from profiles
on conflict (org_id, profile_id) do nothing;

-- Tobiáš → Horizon jako Admin.
insert into org_members (org_id, profile_id, role_id, is_owner)
select '7e1b0000-0000-4000-8000-000000000002', 'e128536f-53af-4f10-90ba-c8c9a69ce8d9', r.id, false
from roles r where r.org_id = '7e1b0000-0000-4000-8000-000000000002' and r.name = 'Admin'
on conflict (org_id, profile_id) do nothing;

-- DOČASNĚ (jen pro starý kód, smaže se po nasazení): starý Admin zakládá lidi
-- a mění jim roli přes profiles.role_id. Promítnout to do členství v Třebassu,
-- jinak by nově založený člověk neměl přístup nikam.
create or replace function public.legacy_profile_to_trebass() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into org_members (org_id, profile_id, role_id, is_owner)
  values ('7e1b0000-0000-4000-8000-000000000001', new.id, new.role_id, coalesce(new.is_owner, false))
  on conflict (org_id, profile_id) do update
    set role_id = excluded.role_id, is_owner = excluded.is_owner
    where tg_op = 'INSERT' or new.role_id is distinct from old.role_id or new.is_owner is distinct from old.is_owner;
  return new;
end $$;
drop trigger if exists legacy_profile_to_trebass on profiles;
create trigger legacy_profile_to_trebass after insert or update of role_id, is_owner on profiles
  for each row execute function public.legacy_profile_to_trebass();

-- org_id do kořenových tabulek ------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['events','contacts','tasks','company_expenses','company_income',
    'owner_ledger','company_balance','ledger_closings']
  loop
    execute format('alter table public.%I add column if not exists org_id uuid references organizations(id) on delete restrict', t);
    execute format('update public.%I set org_id = %L where org_id is null', t, '7e1b0000-0000-4000-8000-000000000001');
    execute format('alter table public.%I alter column org_id set not null', t);
    -- DOČASNĚ (jen pro starý kód): bez org_id = Třebass. Smaže se po nasazení.
    execute format('alter table public.%I alter column org_id set default %L', t, '7e1b0000-0000-4000-8000-000000000001');
    execute format('create index if not exists %I on public.%I(org_id)', t || '_org_idx', t);
  end loop;
end $$;

-- Úkol nebo pohyb v knize navázaný na akci patří vždy firmě té akce
-- (nejde tak omylem/schválně zapsat do akce cizí firmy).
create or replace function public.inherit_event_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.event_id is not null then
    select e.org_id into new.org_id from events e where e.id = new.event_id;
  end if;
  return new;
end $$;
drop trigger if exists tasks_inherit_event_org on tasks;
create trigger tasks_inherit_event_org before insert or update on tasks
  for each row execute function public.inherit_event_org();
drop trigger if exists owner_ledger_inherit_event_org on owner_ledger;
create trigger owner_ledger_inherit_event_org before insert or update on owner_ledger
  for each row execute function public.inherit_event_org();

-- Oprávnění podle firmy -------------------------------------------------------
-- Oprávnění přihlášeného ve firmě `oid`. Není členem / nemá roli = nic.
create or replace function public.org_perms(oid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select r.permissions from org_members m left join roles r on r.id = m.role_id
    where m.org_id = oid and m.profile_id = auth.uid()
  ), '{}'::jsonb)
$$;

create or replace function public.is_org_member(oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m where m.org_id = oid and m.profile_id = auth.uid())
$$;

create or replace function public.is_org_admin(oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((public.org_perms(oid) ->> 'admin')::boolean, false)
$$;

create or replace function public.has_org_perm(oid uuid, key text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_admin(oid) or coalesce((public.org_perms(oid) ->> key)::boolean, false)
$$;

create or replace function public.event_org(eid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from events where id = eid
$$;

-- Přístup k akci: jen člen firmy té akce, a pak stejné pravidlo jako dřív.
create or replace function public.can_access_event(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.id = eid and public.is_org_member(e.org_id) and (
      (public.is_org_admin(e.org_id) and e.admin_access_mode <> 'selected')
      or e.created_by = auth.uid()
      or exists (select 1 from event_access a where a.event_id = eid and a.profile_id = auth.uid())
    )
  )
$$;

-- Je přihlášený v seznamu lidí akce? (security definer, aby politika na events
-- nevolala politiky event_access, které se ptají zpátky na events → zacyklení)
create or replace function public.in_event_access(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from event_access a where a.event_id = eid and a.profile_id = auth.uid())
$$;

-- Založil přihlášený tuhle akci?
create or replace function public.is_event_creator(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = eid and e.created_by = auth.uid())
$$;

create or replace function public.has_event_perm(eid uuid, key text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_access_event(eid) and (
    public.has_org_perm(public.event_org(eid), key)
    or (public.is_event_perm_key(key) and exists (
      select 1 from event_access a
      where a.event_id = eid and a.profile_id = auth.uid()
        and coalesce((a.permissions ->> key)::boolean, false)))
  )
$$;

-- Oprávnění ve firmě nebo výjimkou aspoň v jedné akci téže firmy.
create or replace function public.has_org_perm_anywhere(oid uuid, key text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_org_perm(oid, key) or (public.is_event_perm_key(key) and exists (
    select 1 from event_access a join events e on e.id = a.event_id
    where e.org_id = oid and a.profile_id = auth.uid()
      and coalesce((a.permissions ->> key)::boolean, false)))
$$;

create or replace function public.can_ledger(oid uuid, eid uuid, action text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when eid is null then public.has_org_perm(oid, 'viewFirma') and (action = 'view' or public.has_org_perm(oid, action))
    else (public.has_org_perm(oid, 'viewFirma') and public.can_access_event(eid) and (action = 'view' or public.has_org_perm(oid, action)))
      or (public.has_event_perm(eid, 'viewTym') and (action = 'view' or public.has_event_perm(eid, action)))
  end
$$;

-- DOČASNĚ pro starý kód (volá rpc can_ledger s dvěma parametry): bez akce = Třebass.
create or replace function public.can_ledger(eid uuid, action text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_ledger(coalesce(public.event_org(eid), '7e1b0000-0000-4000-8000-000000000001'::uuid), eid, action)
$$;

revoke all on function public.org_perms(uuid), public.is_org_member(uuid), public.is_org_admin(uuid),
  public.in_event_access(uuid), public.is_event_creator(uuid),
  public.has_org_perm(uuid, text), public.event_org(uuid), public.has_org_perm_anywhere(uuid, text),
  public.can_ledger(uuid, uuid, text), public.can_ledger(uuid, text) from public, anon;
grant execute on function public.org_perms(uuid), public.is_org_member(uuid), public.is_org_admin(uuid),
  public.in_event_access(uuid), public.is_event_creator(uuid),
  public.has_org_perm(uuid, text), public.event_org(uuid), public.has_org_perm_anywhere(uuid, text),
  public.can_ledger(uuid, uuid, text), public.can_ledger(uuid, text) to authenticated;

-- Hlídání sloupců akce: firmu akce nesmí měnit nikdo kromě serveru.
create or replace function public.events_guard_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.org_id is distinct from old.org_id then
    raise exception 'Akci nejde přesunout do jiné firmy.';
  end if;
  if auth.uid() is not null
     and not (public.is_org_admin(old.org_id) or old.created_by = auth.uid())
     and (new.admin_access_mode is distinct from old.admin_access_mode
          or new.created_by is distinct from old.created_by
          or new.include_in_totals is distinct from old.include_in_totals) then
    raise exception 'Přístup k akci a započítávání do přehledů smí měnit jen admin nebo zakladatel akce.';
  end if;
  return new;
end $$;

-- RLS nových tabulek ----------------------------------------------------------
alter table organizations enable row level security;
alter table org_members enable row level security;
revoke all on organizations from anon;
revoke all on org_members from anon;
-- Měnit firmy a členství smí jen server (service_role) po kontrole v actions.ts.
revoke insert, update, delete on organizations from authenticated;
revoke insert, update, delete on org_members from authenticated;

drop policy if exists organizations_select on organizations;
create policy organizations_select on organizations for select to authenticated
  using (public.is_org_member(id));

drop policy if exists org_members_select on org_members;
create policy org_members_select on org_members for select to authenticated
  using (profile_id = auth.uid() or public.is_org_member(org_id));

-- Politiky kořenových tabulek (přepis na oprávnění ve firmě) ------------------
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'events','event_access','team_contributions','tasks','contacts','company_expenses',
      'company_income','owner_ledger','company_balance','ledger_closings','roles','profiles')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- EVENTS
-- Čtení kontroluje sloupce přímo na řádku, ne přes can_access_event(id):
-- ta hledá akci v tabulce a právě vkládaný řádek ještě nevidí, takže
-- insert().select() v createEvent končil chybou RLS (chyba od 12.10.2026).
create policy events_select on events for select to authenticated
  using (public.is_org_member(org_id) and (
    created_by = auth.uid()
    or (public.is_org_admin(org_id) and admin_access_mode <> 'selected')
    or public.in_event_access(id)));
create policy events_insert on events for insert to authenticated
  with check (public.has_org_perm(org_id, 'canCreate'));
create policy events_update on events for update to authenticated
  using (public.has_event_perm(id, 'canEdit'))
  with check (public.has_event_perm(id, 'canEdit'));
create policy events_delete on events for delete to authenticated
  using (public.can_access_event(id) and public.has_org_perm(org_id, 'canDeleteEvent'));

-- EVENT_ACCESS
create policy event_access_select on event_access for select to authenticated
  using (profile_id = auth.uid() or public.can_access_event(event_id));
create policy event_access_write on event_access for all to authenticated
  using (public.is_org_admin(public.event_org(event_id)) or public.is_event_creator(event_id))
  with check (
    -- přístup jde dát jen členovi firmy té akce
    exists (select 1 from org_members m where m.org_id = public.event_org(event_id) and m.profile_id = event_access.profile_id)
    and (public.is_org_admin(public.event_org(event_id)) or public.is_event_creator(event_id)));

-- TEAM_CONTRIBUTIONS (archiv)
create policy team_contributions_select on team_contributions for select to authenticated
  using (public.has_event_perm(event_id, 'viewTym')
         or (public.has_org_perm(public.event_org(event_id), 'viewFirma') and public.can_access_event(event_id)));
create policy team_contributions_insert on team_contributions for insert to authenticated
  with check (public.has_event_perm(event_id, 'canCreate'));
create policy team_contributions_update on team_contributions for update to authenticated
  using (public.has_event_perm(event_id, 'canEdit')) with check (public.has_event_perm(event_id, 'canEdit'));
create policy team_contributions_delete on team_contributions for delete to authenticated
  using (public.has_event_perm(event_id, 'canDelete'));

-- TASKS
create policy tasks_select on tasks for select to authenticated
  using (case when event_id is null then public.has_org_perm(org_id, 'viewUkoly') else public.has_event_perm(event_id, 'viewUkoly') end);
create policy tasks_insert on tasks for insert to authenticated
  with check (case when event_id is null then public.has_org_perm(org_id, 'canCreate') else public.has_event_perm(event_id, 'canCreate') end);
create policy tasks_update on tasks for update to authenticated
  using (case when event_id is null then public.has_org_perm(org_id, 'canEdit') else public.has_event_perm(event_id, 'canEdit') end)
  with check (case when event_id is null then public.has_org_perm(org_id, 'canEdit') else public.has_event_perm(event_id, 'canEdit') end);
create policy tasks_delete on tasks for delete to authenticated
  using (case when event_id is null then public.has_org_perm(org_id, 'canDelete') else public.has_event_perm(event_id, 'canDelete') end);

-- CONTACTS
create policy contacts_select on contacts for select to authenticated
  using (public.has_org_perm(org_id, 'viewKontakty') or public.has_org_perm_anywhere(org_id, 'viewLineup'));
create policy contacts_insert on contacts for insert to authenticated
  with check (public.has_org_perm(org_id, 'canCreate'));
create policy contacts_update on contacts for update to authenticated
  using (public.has_org_perm(org_id, 'canEdit')) with check (public.has_org_perm(org_id, 'canEdit'));
create policy contacts_delete on contacts for delete to authenticated
  using (public.has_org_perm(org_id, 'canDelete'));

-- FIRMA: výdaje, příjmy
create or replace function pg_temp.firma_policies(tbl text) returns void
language plpgsql as $$
begin
  execute format('create policy %I on %I for select to authenticated using (public.has_org_perm(org_id, ''viewFirma''))', tbl || '_select', tbl);
  execute format('create policy %I on %I for insert to authenticated with check (public.has_org_perm(org_id, ''viewFirma'') and public.has_org_perm(org_id, ''canCreate''))', tbl || '_insert', tbl);
  execute format('create policy %I on %I for update to authenticated using (public.has_org_perm(org_id, ''viewFirma'') and public.has_org_perm(org_id, ''canEdit'')) with check (public.has_org_perm(org_id, ''viewFirma'') and public.has_org_perm(org_id, ''canEdit''))', tbl || '_update', tbl);
  execute format('create policy %I on %I for delete to authenticated using (public.has_org_perm(org_id, ''viewFirma'') and public.has_org_perm(org_id, ''canDelete''))', tbl || '_delete', tbl);
end $$;
select pg_temp.firma_policies('company_expenses');
select pg_temp.firma_policies('company_income');

-- KNIHA MAJITELŮ
create policy owner_ledger_select on owner_ledger for select to authenticated using (public.can_ledger(org_id, event_id, 'view'));
create policy owner_ledger_insert on owner_ledger for insert to authenticated with check (public.can_ledger(org_id, event_id, 'canCreate'));
create policy owner_ledger_update on owner_ledger for update to authenticated
  using (public.can_ledger(org_id, event_id, 'canEdit')) with check (public.can_ledger(org_id, event_id, 'canEdit'));
create policy owner_ledger_delete on owner_ledger for delete to authenticated using (public.can_ledger(org_id, event_id, 'canDelete'));

create policy company_balance_select on company_balance for select to authenticated using (public.has_org_perm(org_id, 'viewFirma'));
create policy company_balance_insert on company_balance for insert to authenticated
  with check (public.has_org_perm(org_id, 'viewFirma') and public.has_org_perm(org_id, 'canCreate'));
create policy company_balance_delete on company_balance for delete to authenticated
  using (public.has_org_perm(org_id, 'viewFirma') and public.has_org_perm(org_id, 'canDelete'));

create policy ledger_closings_select on ledger_closings for select to authenticated using (public.has_org_perm(org_id, 'viewFirma'));
create policy ledger_closings_insert on ledger_closings for insert to authenticated
  with check (public.has_org_perm(org_id, 'viewFirma') and public.has_org_perm(org_id, 'canEdit'));
create policy ledger_closings_delete on ledger_closings for delete to authenticated
  using (public.has_org_perm(org_id, 'viewFirma') and public.has_org_perm(org_id, 'canDelete'));

-- ROLES: vidí jen členové té firmy, měnit jen server
create policy roles_select on roles for select to authenticated using (public.is_org_member(org_id));

-- PROFILES: vidím sebe a lidi, se kterými jsem v nějaké firmě
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from org_members mine join org_members theirs on theirs.org_id = mine.org_id
    where mine.profile_id = auth.uid() and theirs.profile_id = profiles.id));
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Realtime pro členství (přepínač firem se obnoví, když admin někoho přidá)
do $$ begin
  alter publication supabase_realtime add table org_members;
exception when others then null;
end $$;

-- Kontroly po spuštění -------------------------------------------------------
-- 1) Všechno je Třebass, nikde chybějící firma (má vrátit jen řádky „trebass"):
-- select 'events' t, o.slug, count(*) from events x join organizations o on o.id = x.org_id group by 2
-- union all select 'contacts', o.slug, count(*) from contacts x join organizations o on o.id = x.org_id group by 2
-- union all select 'tasks', o.slug, count(*) from tasks x join organizations o on o.id = x.org_id group by 2;
-- 2) Členové: 10× Třebass, 1× Horizon (Tobiáš Admin):
-- select o.slug, p.name, r.name role, m.is_owner from org_members m
--   join organizations o on o.id = m.org_id join profiles p on p.id = m.profile_id
--   left join roles r on r.id = m.role_id order by 1, 2;
