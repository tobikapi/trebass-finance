-- ===========================================================================
-- NÁVRAT migrace 2026-11-06_vice_firem.sql
-- Vrátí oprávnění v databázi na stav z 13.10.2026 (role z profiles.role_id,
-- jedna firma). Nové tabulky a sloupce org_id NEMAŽE — nevadí a data v nich
-- zůstanou. Spustit jen v nouzi, když se po migraci někdo nedostane k datům.
-- ===========================================================================

drop trigger if exists legacy_profile_to_trebass on profiles;
drop trigger if exists tasks_inherit_event_org on tasks;
drop trigger if exists owner_ledger_inherit_event_org on owner_ledger;

-- Funkce zpět na původní znění ----------------------------------------------
create or replace function public.can_access_event(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.id = eid and (
      (public.is_admin() and e.admin_access_mode <> 'selected')
      or e.created_by = auth.uid()
      or exists (select 1 from event_access a where a.event_id = eid and a.profile_id = auth.uid())
    )
  )
$$;

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

create or replace function public.can_ledger(eid uuid, action text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when eid is null then public.has_perm('viewFirma') and (action = 'view' or public.has_perm(action))
    else (public.has_perm('viewFirma') and public.can_access_event(eid) and (action = 'view' or public.has_perm(action)))
      or (public.has_event_perm(eid, 'viewTym') and (action = 'view' or public.has_event_perm(eid, action)))
  end
$$;

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

-- Politiky zpět ---------------------------------------------------------------
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

create policy events_select on events for select to authenticated using (public.can_access_event(id));
create policy events_insert on events for insert to authenticated with check (public.has_perm('canCreate'));
create policy events_update on events for update to authenticated
  using (public.has_event_perm(id, 'canEdit')) with check (public.has_event_perm(id, 'canEdit'));
create policy events_delete on events for delete to authenticated
  using (public.can_access_event(id) and public.has_perm('canDeleteEvent'));

create policy event_access_select on event_access for select to authenticated
  using (profile_id = auth.uid() or public.can_access_event(event_id));
create policy event_access_write on event_access for all to authenticated
  using (public.is_admin() or exists (select 1 from events e where e.id = event_id and e.created_by = auth.uid()))
  with check (public.is_admin() or exists (select 1 from events e where e.id = event_id and e.created_by = auth.uid()));

create policy team_contributions_select on team_contributions for select to authenticated
  using (public.has_event_perm(event_id, 'viewTym') or (public.has_perm('viewFirma') and public.can_access_event(event_id)));
create policy team_contributions_insert on team_contributions for insert to authenticated with check (public.has_event_perm(event_id, 'canCreate'));
create policy team_contributions_update on team_contributions for update to authenticated
  using (public.has_event_perm(event_id, 'canEdit')) with check (public.has_event_perm(event_id, 'canEdit'));
create policy team_contributions_delete on team_contributions for delete to authenticated using (public.has_event_perm(event_id, 'canDelete'));

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

create policy company_expenses_select on company_expenses for select to authenticated using (public.has_perm('viewFirma'));
create policy company_expenses_insert on company_expenses for insert to authenticated with check (public.has_perm('viewFirma') and public.has_perm('canCreate'));
create policy company_expenses_update on company_expenses for update to authenticated
  using (public.has_perm('viewFirma') and public.has_perm('canEdit')) with check (public.has_perm('viewFirma') and public.has_perm('canEdit'));
create policy company_expenses_delete on company_expenses for delete to authenticated using (public.has_perm('viewFirma') and public.has_perm('canDelete'));

create policy company_income_select on company_income for select to authenticated using (public.has_perm('viewFirma'));
create policy company_income_insert on company_income for insert to authenticated with check (public.has_perm('viewFirma') and public.has_perm('canCreate'));
create policy company_income_update on company_income for update to authenticated
  using (public.has_perm('viewFirma') and public.has_perm('canEdit')) with check (public.has_perm('viewFirma') and public.has_perm('canEdit'));
create policy company_income_delete on company_income for delete to authenticated using (public.has_perm('viewFirma') and public.has_perm('canDelete'));

create policy owner_ledger_select on owner_ledger for select to authenticated using (public.can_ledger(event_id, 'view'));
create policy owner_ledger_insert on owner_ledger for insert to authenticated with check (public.can_ledger(event_id, 'canCreate'));
create policy owner_ledger_update on owner_ledger for update to authenticated
  using (public.can_ledger(event_id, 'canEdit')) with check (public.can_ledger(event_id, 'canEdit'));
create policy owner_ledger_delete on owner_ledger for delete to authenticated using (public.can_ledger(event_id, 'canDelete'));

create policy company_balance_select on company_balance for select to authenticated using (public.has_perm('viewFirma'));
create policy company_balance_insert on company_balance for insert to authenticated
  with check (public.has_perm('viewFirma') and public.has_perm('canCreate'));
create policy company_balance_delete on company_balance for delete to authenticated
  using (public.has_perm('viewFirma') and public.has_perm('canDelete'));

create policy ledger_closings_select on ledger_closings for select to authenticated using (public.has_perm('viewFirma'));
create policy ledger_closings_insert on ledger_closings for insert to authenticated
  with check (public.has_perm('viewFirma') and public.has_perm('canEdit'));
create policy ledger_closings_delete on ledger_closings for delete to authenticated
  using (public.has_perm('viewFirma') and public.has_perm('canDelete'));

create policy roles_select on roles for select to authenticated using (true);
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
