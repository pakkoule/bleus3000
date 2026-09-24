-- Bleus 3000 V1.1.35 — TheSportsDB + corrections manuelles champ par champ
-- Idempotent : peut être relancée sans dupliquer les colonnes.

alter table public.matches
  add column if not exists manual_overrides jsonb not null default '{}'::jsonb;

alter table public.selection_teams
  add column if not exists provider_ids jsonb not null default '{}'::jsonb;

-- IDs TheSportsDB confirmés. Les catégories encore inconnues seront découvertes
-- par calendar-sync et ajoutées ensuite dans provider_ids.
update public.selection_teams
set provider_ids = coalesce(provider_ids, '{}'::jsonb) || jsonb_build_object('thesportsdb', '[133913]'::jsonb),
    updated_at = now()
where code = 'FRA-A-M';

update public.selection_teams
set provider_ids = coalesce(provider_ids, '{}'::jsonb) || jsonb_build_object('thesportsdb', '[136843,143161]'::jsonb),
    updated_at = now()
where code = 'FRA-ESP-M';

update public.selection_teams
set provider_ids = coalesce(provider_ids, '{}'::jsonb) || jsonb_build_object('thesportsdb', '[152249]'::jsonb),
    updated_at = now()
where code = 'FRA-U20-M';

update public.selection_teams
set provider_ids = coalesce(provider_ids, '{}'::jsonb) || jsonb_build_object('thesportsdb', '[149863]'::jsonb),
    updated_at = now()
where code = 'FRA-U19-M';

update public.selection_teams
set provider_ids = coalesce(provider_ids, '{}'::jsonb) || jsonb_build_object('thesportsdb', '[149609]'::jsonb),
    updated_at = now()
where code = 'FRA-U17-M';

update public.selection_teams
set provider_ids = coalesce(provider_ids, '{}'::jsonb) || jsonb_build_object('thesportsdb', '[136801]'::jsonb),
    updated_at = now()
where code = 'FRA-A-F';

update public.selection_teams
set provider_ids = coalesce(provider_ids, '{}'::jsonb) || jsonb_build_object('thesportsdb', '[153623]'::jsonb),
    updated_at = now()
where code = 'FRA-U17-F';
