-- ===========================================================================
-- Kniha majitelů: uzávěrka a dluhy (13.10.2026)
-- Navazuje na 2026-10-13_kniha_majitelu.sql.
--
-- Uzávěrka („Jsme vyrovnaní") označí všechny dosavadní pohyby jako uzavřené.
-- Zůstanou v historii (Firma, Tým u akce), ale kalkulačka „kdo komu kolik"
-- počítá jen s otevřenými. Smazání uzávěrky je zase otevře (on delete set null).
--
-- Dluh: profile_id dluží counterparty_id (např. Artur dluží Jakubovi za
-- Spring Edition). Ve vyrovnání: dlužník −, věřitel +. Do pokladny firmy se
-- nepočítá — peníze firmou neprošly. Splacení = vyrovnání dlužník → věřitel.
--
-- Spouští se celé najednou v Supabase SQL editoru.
-- ===========================================================================

create table if not exists ledger_closings (
  id uuid primary key default gen_random_uuid(),
  closed_on date not null default current_date,
  note text,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamp with time zone default now()
);
alter table ledger_closings enable row level security;
revoke all on ledger_closings from anon;

drop policy if exists ledger_closings_select on ledger_closings;
drop policy if exists ledger_closings_insert on ledger_closings;
drop policy if exists ledger_closings_delete on ledger_closings;
create policy ledger_closings_select on ledger_closings for select to authenticated using (public.has_perm('viewFirma'));
create policy ledger_closings_insert on ledger_closings for insert to authenticated
  with check (public.has_perm('viewFirma') and public.has_perm('canEdit'));
create policy ledger_closings_delete on ledger_closings for delete to authenticated
  using (public.has_perm('viewFirma') and public.has_perm('canDelete'));

alter table owner_ledger add column if not exists closing_id uuid references ledger_closings(id) on delete set null;
create index if not exists owner_ledger_closing_idx on owner_ledger(closing_id);

-- Nový typ „dluh" (u něj i u vyrovnání musí být druhá strana)
alter table owner_ledger drop constraint if exists owner_ledger_kind_check;
alter table owner_ledger add constraint owner_ledger_kind_check check (kind in ('vklad', 'vyber', 'vyrovnani', 'dluh'));
do $$
declare c text;
begin
  -- původní nepojmenovaná kontrola „vyrovnani ⇔ counterparty"
  for c in select conname from pg_constraint
    where conrelid = 'public.owner_ledger'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%counterparty_id IS NOT NULL%'
      and conname <> 'owner_ledger_counterparty_check'
  loop
    execute format('alter table owner_ledger drop constraint %I', c);
  end loop;
end $$;
alter table owner_ledger drop constraint if exists owner_ledger_counterparty_check;
alter table owner_ledger add constraint owner_ledger_counterparty_check
  check ((kind in ('vyrovnani', 'dluh')) = (counterparty_id is not null));
