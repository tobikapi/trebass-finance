-- ===========================================================================
-- NOUZOVÝ NÁVRAT k 2026-10-12_bezpecnost_rls.sql
--
-- Jen kdyby se po nasazení přísné RLS někdo nedostal k datům, na která má
-- mít přístup. Vrací stav „každý PŘIHLÁŠENÝ smí vše" (anon zůstává odříznutý
-- a úložiště soukromé — díry A–C se tím znovu neotevřou, jen D a E).
-- Nové sloupce (created_by, include_in_totals) zůstávají, kód s nimi počítá.
-- ===========================================================================
do $$
declare r record; t text;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'events','expenses','income','lineup','team_contributions','notes','contacts',
      'tasks','documents','profiles','roles','event_access','event_equipment',
      'company_expenses','company_income')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;

  foreach t in array array['events','expenses','income','lineup','team_contributions','notes','contacts',
    'tasks','documents','profiles','roles','event_access','event_equipment','company_expenses','company_income']
  loop
    execute format('create policy "authenticated all" on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists documents_select on storage.objects;
drop policy if exists documents_insert on storage.objects;
drop policy if exists documents_delete on storage.objects;
create policy documents_all on storage.objects for all to authenticated
  using (bucket_id = 'documents') with check (bucket_id = 'documents');
