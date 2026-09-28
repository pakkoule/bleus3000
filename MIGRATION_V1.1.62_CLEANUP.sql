-- 3615 Bleus V1.1.62 — nettoyage du modèle de rôles
-- Production existante : migration non destructive.
begin;

-- Les anciens rôles n'ont plus de droits applicatifs. On les normalise en USER avant de fermer la contrainte.
update public.profiles
set role='user', updated_at=now()
where role in ('contributor','editor');

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user','admin','superadmin'));

create or replace function public.can_edit()
returns boolean language sql stable security definer set search_path=public
as $$ select public.current_role() in ('admin','superadmin') $$;

create or replace function public.can_contribute()
returns boolean language sql stable security definer set search_path=public
as $$ select public.current_role() in ('admin','superadmin') $$;

create or replace function public.can_edit_selections()
returns boolean language sql stable security definer set search_path=public
as $$ select public.current_role() in ('admin','superadmin') $$;

-- Ces helpers sont utilisés par les politiques RLS : ils restent exécutables par authenticated/service_role, pas par anon/PUBLIC.
revoke all on function public.can_edit() from public, anon;
revoke all on function public.can_contribute() from public, anon;
revoke all on function public.can_edit_selections() from public, anon;
grant execute on function public.can_edit() to authenticated, service_role;
grant execute on function public.can_contribute() to authenticated, service_role;
grant execute on function public.can_edit_selections() to authenticated, service_role;

-- Ancienne table vide remplacée par public.user_preferences.
drop table if exists public.user_display_preferences;

commit;
