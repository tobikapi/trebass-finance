-- ===========================================================================
-- Více firem — úklid po nasazení nového kódu (6.11.2026)
-- Spustit AŽ KDYŽ na voletrebass.cz běží verze s přepínačem firem.
-- Navazuje na 2026-11-06_vice_firem.sql.
--
-- Ruší přechodové pojistky pro starý kód:
--   * výchozí org_id = Třebass (nový kód firmu posílá vždy sám; bez výchozí
--     hodnoty se záznam bez firmy odmítne, místo aby tiše skončil v Třebassu),
--   * trigger, který lidi založené přes profiles.role_id přidával do Třebassu
--     (nový kód zakládá členství přímo; trigger by Horizoňáky strkal do Třebassu),
--   * starou rpc can_ledger(eid, action) bez firmy.
-- profiles.role_id a profiles.is_owner zůstávají jako archiv (nic je nečte).
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array['events','contacts','tasks','company_expenses','company_income',
    'owner_ledger','company_balance','ledger_closings']
  loop
    execute format('alter table public.%I alter column org_id drop default', t);
  end loop;
end $$;

drop trigger if exists legacy_profile_to_trebass on profiles;
drop function if exists public.legacy_profile_to_trebass();

drop function if exists public.can_ledger(uuid, text);
