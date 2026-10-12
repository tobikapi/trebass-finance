-- ===========================================================================
-- Bezpečnost: skutečné RLS místo „allow all" (12.10.2026)
--
-- Proč: do teď se role a přístup k akcím hlídaly jen v appce. Databáze
-- pouštěla kohokoli s veřejným (anon) klíčem — ten je v JS každé stránky.
-- Ověřeno naživo:
--   * nepřihlášený člověk mohl přepsat tabulku `roles` (→ z Crew Member admin),
--     číst kontakty, event_access a vypsat/stáhnout soubory z úložiště,
--   * přihlášený Crew Member bez přístupu k jediné akci přečetl všech 20 akcí,
--     338 výdajů a firemní finance a mohl si přepsat vlastní role_id na Admin.
--
-- Co se mění:
--   * anon nesmí nic, přihlášení vidí/mění jen to, co jim dovolí role
--     a přístup k akci (stejná logika jako src/lib/permissions.ts
--     a src/lib/event-access.ts, jen vynucená databází),
--   * zápisy do `roles` a do role/jména v `profiles` jdou jen přes server
--     (service_role) po kontrole oprávnění v actions.ts,
--   * úložiště `documents` je soukromé, soubory přes podepsané odkazy.
--
-- Spouští se celé najednou v Supabase SQL editoru. Je idempotentní.
-- Návrat (kdyby se někdo nedostal dovnitř): 2026-10-12_bezpecnost_rls_NAVRAT.sql
-- ===========================================================================

-- Nové sloupce ---------------------------------------------------------------

-- Kdo akci založil — zakladatel ji vidí vždy, i když je akce „jen vybraní"
-- a sám sebe do seznamu nezaškrtl (jinak by mu po založení zmizela).
alter table events add column if not exists created_by uuid references profiles(id) on delete set null default auth.uid();

-- Započítávat akci do celkových přehledů (Dashboard, Archiv). Akce sloužící
-- jen jako soukromá kalkulačka se vypnou.
alter table events add column if not exists include_in_totals boolean not null default true;

-- Pomocné funkce -------------------------------------------------------------
-- security definer = čtou profiles/roles/event_access bez ohledu na RLS,
-- jinak by se politiky zacyklily (politika na event_access volá funkci,
-- která čte event_access…).

-- Oprávnění přihlášeného uživatele. Bez role = prázdná oprávnění (nic).
-- Pozn.: v appce role=null znamená „vše povoleno" (pojistka z doby migrace),
-- v databázi to záměrně neplatí — účet bez role nesmí vidět finance.
create or replace function public.app_perms() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(r.permissions, '{}'::jsonb)
  from profiles p left join roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((public.app_perms() ->> 'admin')::boolean, false)
$$;

create or replace function public.has_perm(key text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce((public.app_perms() ->> key)::boolean, false)
$$;

-- Stejné pravidlo jako canAccessEvent() v src/lib/event-access.ts:
-- admin vidí akci, pokud není „jen vybraní"; jinak musí být v event_access.
-- Navíc: zakladatel akce ji vidí vždy.
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

-- Složka v úložišti = id akce. Neplatný název složky nesmí shodit dotaz.
create or replace function public.can_access_event_path(path text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare eid uuid;
begin
  begin
    eid := split_part(path, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return public.can_access_event(eid);
end $$;

revoke all on function public.app_perms() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_perm(text) from public, anon;
revoke all on function public.can_access_event(uuid) from public, anon;
revoke all on function public.can_access_event_path(text) from public, anon;
grant execute on function public.app_perms(), public.is_admin(), public.has_perm(text),
  public.can_access_event(uuid), public.can_access_event_path(text) to authenticated;

-- Smazat všechny dosavadní politiky (včetně těch zakládaných ručně mimo
-- supabase-schema.sql — jejich jména neznáme, proto smyčkou) ---------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'events','expenses','income','lineup','team_contributions','notes','contacts',
      'tasks','documents','profiles','roles','event_access','event_equipment',
      'company_expenses','company_income')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- RLS zapnout všude a anon odstřihnout i na úrovni práv ----------------------
do $$
declare t text;
begin
  foreach t in array array['events','expenses','income','lineup','team_contributions','notes','contacts',
    'tasks','documents','profiles','roles','event_access','event_equipment','company_expenses','company_income']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- EVENTS ---------------------------------------------------------------------
create policy events_select on events for select to authenticated
  using (public.can_access_event(id));
create policy events_insert on events for insert to authenticated
  with check (public.has_perm('canCreate'));
create policy events_update on events for update to authenticated
  using (public.can_access_event(id) and public.has_perm('canEdit'))
  with check (public.can_access_event(id) and public.has_perm('canEdit'));
create policy events_delete on events for delete to authenticated
  using (public.can_access_event(id) and public.has_perm('canDeleteEvent'));

-- EVENT_ACCESS ---------------------------------------------------------------
-- Číst: své řádky + řádky akcí, ke kterým mám přístup (appka podle nich filtruje).
-- Měnit: admin, nebo zakladatel akce (při zakládání akce s výběrem lidí).
create policy event_access_select on event_access for select to authenticated
  using (profile_id = auth.uid() or public.can_access_event(event_id));
create policy event_access_write on event_access for all to authenticated
  using (public.is_admin() or exists (select 1 from events e where e.id = event_id and e.created_by = auth.uid()))
  with check (public.is_admin() or exists (select 1 from events e where e.id = event_id and e.created_by = auth.uid()));

-- Tabulky navázané na akci ---------------------------------------------------
-- Číst = přístup k akci + oprávnění k záložce. Zapisovat = přístup k akci
-- + canCreate/canEdit/canDelete (stejně jako server actions).
create or replace function pg_temp.event_child_policies(tbl text, view_cond text) returns void
language plpgsql as $$
begin
  execute format('create policy %I on %I for select to authenticated using (public.can_access_event(event_id) and (%s))',
    tbl || '_select', tbl, view_cond);
  execute format('create policy %I on %I for insert to authenticated with check (public.can_access_event(event_id) and public.has_perm(''canCreate''))',
    tbl || '_insert', tbl);
  execute format('create policy %I on %I for update to authenticated using (public.can_access_event(event_id) and public.has_perm(''canEdit'')) with check (public.can_access_event(event_id) and public.has_perm(''canEdit''))',
    tbl || '_update', tbl);
  execute format('create policy %I on %I for delete to authenticated using (public.can_access_event(event_id) and public.has_perm(''canDelete''))',
    tbl || '_delete', tbl);
end $$;

-- Výdaje: pronajímatelé techniky (category TECHNIKA) potřebuje i záložka Technika.
select pg_temp.event_child_policies('expenses',
  'public.has_perm(''viewVydaje'') or public.has_perm(''viewPrehled'') or (category = ''TECHNIKA'' and public.has_perm(''viewTechnika''))');
select pg_temp.event_child_policies('income',
  'public.has_perm(''viewPrijmy'') or public.has_perm(''viewPrehled'')');
select pg_temp.event_child_policies('lineup', 'public.has_perm(''viewLineup'')');
select pg_temp.event_child_policies('notes', 'public.has_perm(''viewChat'')');
select pg_temp.event_child_policies('documents', 'public.has_perm(''viewSoubory'')');
select pg_temp.event_child_policies('event_equipment',
  'public.has_perm(''viewTechnika'') or public.has_perm(''viewElektrina'')');
select pg_temp.event_child_policies('team_contributions', 'public.has_perm(''viewTym'')');
-- Firma zobrazuje příspěvky týmu napříč akcemi.
create policy team_contributions_select_firma on team_contributions for select to authenticated
  using (public.has_perm('viewFirma') and public.can_access_event(event_id));

-- TASKS (event_id může být prázdné = úkol mimo akci) ------------------------
create policy tasks_select on tasks for select to authenticated
  using (public.has_perm('viewUkoly') and (event_id is null or public.can_access_event(event_id)));
create policy tasks_insert on tasks for insert to authenticated
  with check (public.has_perm('canCreate') and (event_id is null or public.can_access_event(event_id)));
create policy tasks_update on tasks for update to authenticated
  using (public.has_perm('canEdit') and (event_id is null or public.can_access_event(event_id)))
  with check (public.has_perm('canEdit') and (event_id is null or public.can_access_event(event_id)));
create policy tasks_delete on tasks for delete to authenticated
  using (public.has_perm('canDelete') and (event_id is null or public.can_access_event(event_id)));

-- CONTACTS (Lineup si z nich bere jména umělců) -----------------------------
create policy contacts_select on contacts for select to authenticated
  using (public.has_perm('viewKontakty') or public.has_perm('viewLineup'));
create policy contacts_insert on contacts for insert to authenticated with check (public.has_perm('canCreate'));
create policy contacts_update on contacts for update to authenticated
  using (public.has_perm('canEdit')) with check (public.has_perm('canEdit'));
create policy contacts_delete on contacts for delete to authenticated using (public.has_perm('canDelete'));

-- FIRMA ----------------------------------------------------------------------
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

-- ROLES: číst smí každý přihlášený, měnit jen server (service_role) ----------
create policy roles_select on roles for select to authenticated using (true);

-- PROFILES -------------------------------------------------------------------
-- Jména a telefony vidí přihlášení (Kontakty, Tým, výběr lidí u akce).
-- Sám sobě smí člověk změnit jen příznak must_change_password (po změně hesla);
-- jméno, e-mail, telefon a hlavně role_id mění jen server přes service_role.
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (must_change_password) on profiles to authenticated;
revoke insert, delete on profiles from authenticated;
revoke insert, update, delete on roles from authenticated;

-- ÚLOŽIŠTĚ -------------------------------------------------------------------
update storage.buckets set public = false where id = 'documents';

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and (policyname ilike '%document%' or qual ilike '%documents%' or with_check ilike '%documents%')
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.can_access_event_path(name) and public.has_perm('viewSoubory'));
create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_access_event_path(name) and public.has_perm('canCreate'));
create policy documents_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.can_access_event_path(name) and public.has_perm('canDelete'));

-- Kontrola po spuštění: tohle musí vrátit 0 řádků (žádná politika pro anon/public).
-- select tablename, policyname, roles from pg_policies
--   where schemaname = 'public' and not (roles = '{authenticated}');
