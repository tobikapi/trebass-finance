-- ===========================================================================
-- Vzhled světa: vlastní obrázek v pozadí pro každou firmu (7.11.2026)
-- Navazuje na 2026-11-06_vice_firem.sql.
--
--   organizations.look = { "bg_url": "...", "bg_dim": 82, "bg_mobile": false }
--     bg_url    — obrázek v pozadí (null = výchozí: Třebass fotka pódia, jinak nic)
--     bg_dim    — ztmavení v % (0–95), aby byl text čitelný
--     bg_mobile — zobrazit obrázek i na mobilu
--   Mění ho jen server (service_role) po kontrole, že je člověk admin té firmy.
--
--   Úložiště „branding“ (veřejné čtení — pozadí není citlivé). Nahrávat a mazat
--   smí jen admin firmy, a to jen do složky se svým id firmy: {org_id}/soubor.jpg
--
-- Spouští se celé najednou v Supabase SQL editoru. Je idempotentní.
-- ===========================================================================

alter table organizations add column if not exists look jsonb not null default '{}'::jsonb;

-- Id firmy ze začátku cesty v úložišti; neplatná cesta = null (nesmí shodit dotaz)
create or replace function public.org_id_from_path(path text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end $$;
grant execute on function public.org_id_from_path(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

drop policy if exists branding_select on storage.objects;
drop policy if exists branding_insert on storage.objects;
drop policy if exists branding_update on storage.objects;
drop policy if exists branding_delete on storage.objects;
-- čtení (Supabase ho potřebuje i při nahrávání; obrázky jsou stejně veřejné)
create policy branding_select on storage.objects for select to authenticated
  using (bucket_id = 'branding');
create policy branding_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_org_admin(public.org_id_from_path(name)));
create policy branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_org_admin(public.org_id_from_path(name)))
  with check (bucket_id = 'branding' and public.is_org_admin(public.org_id_from_path(name)));
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_org_admin(public.org_id_from_path(name)));
