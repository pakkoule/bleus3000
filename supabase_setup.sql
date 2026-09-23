-- BLEUS 3000 V1.1.2
-- NOUVEAU PROJET SUPABASE UNIQUEMENT. À exécuter dans un projet dédié à Bleus 3000.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  username text,
  role text not null default 'user' check (role in ('user','contributor','editor','admin','superadmin')),
  status_text text check (status_text is null or char_length(status_text)<=90),
  presence_status text not null default 'online' check (presence_status in ('online','away','dnd','offline')),
  last_seen_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,first_name,username)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$ select coalesce((select role from public.profiles where id=auth.uid()),'user') $$;
create or replace function public.can_edit() returns boolean language sql stable security definer set search_path=public as $$ select public.current_role() in ('editor','admin','superadmin') $$;
create or replace function public.can_contribute() returns boolean language sql stable security definer set search_path=public as $$ select public.current_role() in ('contributor','editor','admin','superadmin') $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select public.current_role() in ('admin','superadmin') $$;
create or replace function public.is_superadmin() returns boolean language sql stable security definer set search_path=public as $$ select public.current_role()='superadmin' $$;

-- Empêche toute auto-promotion de rôle depuis le client. Les changements de rôle passent par un admin/superadmin.
create or replace function public.guard_profile_role() returns trigger language plpgsql security definer set search_path=public as $$
declare actor_role text;
begin
  if new.role is not distinct from old.role then return new; end if;
  -- Les migrations/SQL serveur sans session utilisateur restent autorisées (bootstrap du premier superadmin).
  if auth.uid() is null then return new; end if;
  actor_role := public.current_role();
  if actor_role not in ('admin','superadmin') then
    raise exception 'Role change forbidden';
  end if;
  if actor_role='admin' and (old.role='superadmin' or new.role='superadmin') then
    raise exception 'Only a superadmin can manage the superadmin role';
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update of role on public.profiles for each row execute function public.guard_profile_role();

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null,
  item_key text not null,
  position int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key(user_id,item_type,item_key)
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  report_type text not null default 'bug',
  message text not null,
  module text,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check(status in('new','in_progress','resolved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create table if not exists public.member_role_labels (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  label_text text not null,
  icon_text text not null default '★',
  appearance text not null default 'gradient',
  color_start text not null default '#E7F0FF',
  color_end text not null default '#2563EB',
  gradient_angle int not null default 135,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.member_postit_styles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  appearance text not null default 'gradient',
  color_start text not null default '#DFEEFF',
  color_end text not null default '#BFE3F3',
  gradient_angle int not null default 135,
  text_color text not null default '#17375E',
  border_color text not null default '#8FB4EA',
  border_style text not null default 'solid',
  border_width int not null default 1,
  border_radius int not null default 9,
  shadow_strength int not null default 1,
  updated_at timestamptz not null default now()
);
create table if not exists public.member_wall_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  author_username text,
  author_first_name text,
  author_role text,
  message text not null check(char_length(message) between 1 and 140),
  created_at timestamptz not null default now()
);
create table if not exists public.member_wall_likes (
  post_id uuid not null references public.member_wall_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text,
  first_name text,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create or replace function public.fill_wall_author() returns trigger language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype;
begin
  select * into p from public.profiles where id=auth.uid();
  new.author_id=auth.uid(); new.author_username=p.username; new.author_first_name=p.first_name; new.author_role=p.role;
  return new;
end $$;
drop trigger if exists fill_wall_author on public.member_wall_posts;
create trigger fill_wall_author before insert on public.member_wall_posts for each row execute function public.fill_wall_author();


-- Noyau relationnel football
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(), name text not null, country text, logo_url text, external_ids jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(), first_name text, last_name text not null, display_name text not null,
  gender text not null check(gender in('M','F')), birth_date date, birth_place text, height_cm int, preferred_foot text,
  primary_position text, secondary_positions text[] default '{}', current_club_id uuid references public.clubs(id) on delete set null,
  france_eligibility boolean not null default true, senior_a_called boolean not null default false, active boolean not null default true,
  photo_url text, external_ids jsonb default '{}'::jsonb, keywords text[] default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(), parent_id uuid references public.competitions(id) on delete set null,
  name text not null, edition text, organizer text, competition_type text, gender text, selection_category text,
  start_date date, end_date date, host_country text, status text, logo_url text, external_ids jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.opponents (
  id uuid primary key default gen_random_uuid(), name text not null unique, fifa_code text, confederation text, continent text,
  federation_name text, flag_url text, federation_logo_url text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(), place_type text not null check(place_type in('country','city','stadium','iconic_place')),
  name text not null, city text, country text, capacity int, latitude numeric, longitude numeric, opened_year int,
  description_short text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.personnel (
  id uuid primary key default gen_random_uuid(), display_name text not null, nationality text, person_type text not null,
  birth_date date, photo_url text, organization text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(), match_date timestamptz not null, gender text not null, selection_category text not null,
  opponent_id uuid references public.opponents(id) on delete restrict, competition_id uuid references public.competitions(id) on delete set null,
  place_id uuid references public.places(id) on delete set null, home_away text, france_score int, opponent_score int, status text default 'scheduled',
  coach_id uuid references public.personnel(id) on delete set null, notes_short text, external_ids jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.match_officials (
  match_id uuid references public.matches(id) on delete cascade, person_id uuid references public.personnel(id) on delete cascade,
  role text not null, primary key(match_id,person_id,role)
);
create table if not exists public.callups (
  id uuid primary key default gen_random_uuid(), title text not null, announcement_date date, start_date date, end_date date,
  gender text not null, selection_category text not null, coach_id uuid references public.personnel(id) on delete set null,
  competition_id uuid references public.competitions(id) on delete set null, place_id uuid references public.places(id) on delete set null,
  notes_short text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.callup_players (
  callup_id uuid references public.callups(id) on delete cascade, player_id uuid references public.players(id) on delete cascade,
  position_group text, status text not null default 'called', first_callup boolean not null default false, replacement_for uuid references public.players(id) on delete set null,
  primary key(callup_id,player_id)
);
create table if not exists public.match_appearances (
  match_id uuid references public.matches(id) on delete cascade, player_id uuid references public.players(id) on delete cascade,
  starter boolean default false, minutes int default 0, goals int default 0, assists int default 0, yellow_cards int default 0, red_cards int default 0,
  captain boolean default false, position text, primary key(match_id,player_id)
);
create table if not exists public.kits (
  id uuid primary key default gen_random_uuid(), name text not null, kit_type text, gender text, selection_category text, season text,
  manufacturer text, colors text[], image_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.match_kits (
  match_id uuid references public.matches(id) on delete cascade, kit_id uuid references public.kits(id) on delete cascade, side text default 'france', primary key(match_id,kit_id)
);
create table if not exists public.bibliography_media (
  id uuid primary key default gen_random_uuid(), media_type text not null, title text not null, author_director text, year int, publisher_broadcaster text,
  duration_minutes int, pages int, language text, cover_url text, availability text, keywords text[] default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(), event_date timestamptz not null, event_type text not null, title text not null, subtitle text,
  gender text, selection_category text, match_id uuid references public.matches(id) on delete cascade, callup_id uuid references public.callups(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete cascade, place_id uuid references public.places(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.player_match_performances (
  id uuid primary key default gen_random_uuid(), player_id uuid not null references public.players(id) on delete cascade,
  external_fixture_id text not null, match_date timestamptz not null, club_id uuid references public.clubs(id) on delete set null,
  opponent_club_name text, competition_name text, home_name text, away_name text, score_for int, score_against int,
  starter boolean, minutes int, position text, goals int default 0, assists int default 0, rating numeric(4,2), stats jsonb default '{}'::jsonb,
  provider text, created_at timestamptz not null default now(), unique(player_id,provider,external_fixture_id)
);
create table if not exists public.ladder_snapshots (
  id uuid primary key default gen_random_uuid(), player_id uuid not null references public.players(id) on delete cascade,
  ladder_type text not null default 'bleu', snapshot_date date not null, rank int not null, score numeric(6,2) not null, trend int default 0,
  details jsonb default '{}'::jsonb, unique(player_id,ladder_type,snapshot_date)
);
create table if not exists public.user_compositions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  composition_type text not null check(composition_type in('xi','five','selection_list')), title text not null, formation text,
  payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Provenance et contributions communes à TOUS les référentiels.
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(), source_type text not null, title text not null, publisher_author text, url text,
  publication_date date, isbn text, page_reference text, notes_short text, created_at timestamptz not null default now()
);
create table if not exists public.entity_sources (
  entity_type text not null, entity_id uuid not null, source_id uuid not null references public.sources(id) on delete cascade,
  field_scope text, primary key(entity_type,entity_id,source_id)
);
create table if not exists public.entity_contributors (
  entity_type text not null, entity_id uuid not null, user_id uuid not null references public.profiles(id) on delete cascade,
  contribution_type text not null default 'contribution', contributed_at timestamptz not null default now(), primary key(entity_type,entity_id,user_id,contribution_type)
);
create table if not exists public.data_change_log (
  id bigserial primary key, actor_user_id uuid references public.profiles(id) on delete set null, entity_type text not null,
  entity_id text, action text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);

-- updated_at triggers
DO $$ declare t text; begin
  foreach t in array array['profiles','user_preferences','member_role_labels','member_postit_styles','clubs','players','competitions','opponents','places','personnel','matches','callups','kits','bibliography_media','calendar_events','user_compositions'] loop
    execute format('drop trigger if exists %I_touch on public.%I',t,t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',t,t);
  end loop;
end $$;

-- RLS
DO $$ declare t text; begin
  foreach t in array array['profiles','user_preferences','favorites','reports','member_role_labels','member_postit_styles','member_wall_posts','member_wall_likes','clubs','players','competitions','opponents','places','personnel','matches','match_officials','callups','callup_players','match_appearances','kits','match_kits','bibliography_media','calendar_events','player_match_performances','ladder_snapshots','user_compositions','sources','entity_sources','entity_contributors','data_change_log'] loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;

-- Lecture publique authentifiée des données encyclopédiques
DO $$ declare t text; begin
  foreach t in array array['clubs','players','competitions','opponents','places','personnel','matches','match_officials','callups','callup_players','match_appearances','kits','match_kits','bibliography_media','calendar_events','player_match_performances','ladder_snapshots','sources','entity_sources','entity_contributors'] loop
    execute format('drop policy if exists read_%I on public.%I',t,t);
    execute format('create policy read_%I on public.%I for select to anon,authenticated using (true)',t,t);
  end loop;
end $$;

-- Écriture encyclopédique : editor/admin/superadmin. Contributor peut proposer via workflow futur.
DO $$ declare t text; begin
  foreach t in array array['clubs','players','competitions','opponents','places','personnel','matches','match_officials','callups','callup_players','match_appearances','kits','match_kits','bibliography_media','calendar_events','player_match_performances','ladder_snapshots','sources','entity_sources','entity_contributors'] loop
    execute format('drop policy if exists write_%I on public.%I',t,t);
    execute format('create policy write_%I on public.%I for all to authenticated using (public.can_edit()) with check (public.can_edit())',t,t);
  end loop;
end $$;

-- Profils
drop policy if exists profiles_read_authenticated on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists preferences_self on public.user_preferences;
drop policy if exists favorites_self on public.favorites;
drop policy if exists compositions_self on public.user_compositions;
drop policy if exists reports_insert_self on public.reports;
drop policy if exists reports_admin_read on public.reports;
drop policy if exists reports_admin_update on public.reports;
drop policy if exists member_labels_read on public.member_role_labels;
drop policy if exists member_labels_self on public.member_role_labels;
drop policy if exists member_labels_update on public.member_role_labels;
drop policy if exists postit_styles_read on public.member_postit_styles;
drop policy if exists postit_styles_self on public.member_postit_styles;
drop policy if exists wall_read on public.member_wall_posts;
drop policy if exists wall_insert on public.member_wall_posts;
drop policy if exists wall_delete on public.member_wall_posts;
drop policy if exists wall_likes_read on public.member_wall_likes;
drop policy if exists wall_likes_self on public.member_wall_likes;
drop policy if exists wall_likes_delete on public.member_wall_likes;
drop policy if exists change_log_admin on public.data_change_log;
create policy profiles_read_authenticated on public.profiles for select to authenticated using(true);
create policy profiles_update_self on public.profiles for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
create policy preferences_self on public.user_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy favorites_self on public.favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy compositions_self on public.user_compositions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy reports_insert_self on public.reports for insert to authenticated with check(user_id=auth.uid());
create policy reports_admin_read on public.reports for select to authenticated using(public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy member_labels_read on public.member_role_labels for select to authenticated using(true);
create policy member_labels_self on public.member_role_labels for insert to authenticated with check(user_id=auth.uid());
create policy member_labels_update on public.member_role_labels for update to authenticated using(user_id=auth.uid() or public.is_superadmin()) with check(user_id=auth.uid() or public.is_superadmin());
create policy postit_styles_read on public.member_postit_styles for select to authenticated using(true);
create policy postit_styles_self on public.member_postit_styles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy wall_read on public.member_wall_posts for select to authenticated using(true);
create policy wall_insert on public.member_wall_posts for insert to authenticated with check(author_id=auth.uid());
create policy wall_delete on public.member_wall_posts for delete to authenticated using(author_id=auth.uid() or public.is_admin());
create policy wall_likes_read on public.member_wall_likes for select to authenticated using(true);
create policy wall_likes_self on public.member_wall_likes for insert to authenticated with check(user_id=auth.uid());
create policy wall_likes_delete on public.member_wall_likes for delete to authenticated using(user_id=auth.uid());
create policy change_log_admin on public.data_change_log for select to authenticated using(public.is_admin());

-- Realtime du mur
DO $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='member_wall_posts') then alter publication supabase_realtime add table public.member_wall_posts; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='member_wall_likes') then alter publication supabase_realtime add table public.member_wall_likes; end if;
exception when undefined_object then null; end $$;
