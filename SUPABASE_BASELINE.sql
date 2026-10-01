-- ============================================================================
-- 3615 BLEUS — SUPABASE BASELINE V1.1.62
-- Généré le 25/09/2026 à partir du setup historique et des migrations
-- consolidées jusqu’à la V1.1.62.
--
-- USAGE : NOUVEAU PROJET SUPABASE UNIQUEMENT.
-- Ce fichier reconstruit le schéma, les fonctions, RLS, policies, buckets et
-- données bootstrap prévues par les migrations historiques.
-- Il ne contient PAS les données de production (joueurs, matchs, photos, etc.).
-- Après création d'un premier compte, utiliser SUPABASE_FIRST_ADMIN.sql si
-- nécessaire pour l'administration initiale.
-- ============================================================================

-- === BASE HISTORIQUE / SETUP INITIAL =======================================

-- BLEUS 3000 V1.1.4
-- NOUVEAU PROJET SUPABASE UNIQUEMENT. À exécuter dans un projet dédié à Bleus 3000.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  username text,
  role text not null default 'user' check (role in ('user','admin','superadmin')),
  status_text text check (status_text is null or char_length(status_text)<=90),
  presence_status text not null default 'online' check (presence_status in ('online','away','dnd','offline')),
  last_seen_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare assigned_role text := 'user';
begin
  -- Le tout premier compte Bleus 3000 devient SUPERADMIN. Le verrou évite un double bootstrap simultané.
  perform pg_advisory_xact_lock(hashtext('bleus3000_first_superadmin'));
  if not exists (select 1 from public.profiles) then assigned_role := 'superadmin'; end if;
  insert into public.profiles(id,email,first_name,username,role)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),assigned_role)
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$ select coalesce((select role from public.profiles where id=auth.uid()),'user') $$;
create or replace function public.can_edit() returns boolean language sql stable security definer set search_path=public as $$ select public.current_role() in ('admin','superadmin') $$;
create or replace function public.can_contribute() returns boolean language sql stable security definer set search_path=public as $$ select public.current_role() in ('admin','superadmin') $$;
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
  gender text not null check(gender in('M','F')), birth_date date, death_date date, birth_place text, height_cm int, preferred_foot text,
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
  birth_date date, death_date date, photo_url text, organization text, active boolean not null default true,
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


-- V1.1.4 — catalogue global Tags & Étiquettes + liaisons génériques aux tuiles
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null default 'tag' check (kind in ('tag','label')),
  label_text text not null check (char_length(label_text) between 1 and 40),
  icon_text text not null default '🏷️',
  aliases text[] not null default '{}',
  appearance text not null default 'gradient' check (appearance in ('solid','gradient')),
  color_start text not null default '#2563EB',
  color_end text not null default '#0EA5C6',
  gradient_colors text[] not null default ARRAY['#2563EB','#0EA5C6']::text[] check (cardinality(gradient_colors) between 0 and 5),
  text_color text not null default '#FFFFFF',
  border_color text not null default '#1E4FA7',
  gradient_angle int not null default 135 check (gradient_angle between 0 and 360),
  border_radius int not null default 8 check (border_radius between 0 and 32),
  border_width int not null default 1 check (border_width between 0 and 6),
  created_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.entity_tags (
  entity_type text not null,
  entity_id uuid not null,
  tag_id uuid not null references public.tags(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(entity_type,entity_id,tag_id)
);

drop trigger if exists tags_touch on public.tags;
create trigger tags_touch before update on public.tags for each row execute function public.touch_updated_at();
alter table public.tags enable row level security;
alter table public.entity_tags enable row level security;

drop policy if exists tags_read on public.tags;
drop policy if exists tags_insert on public.tags;
drop policy if exists tags_update on public.tags;
drop policy if exists tags_delete on public.tags;
drop policy if exists entity_tags_read on public.entity_tags;
drop policy if exists entity_tags_write on public.entity_tags;
create policy tags_read on public.tags for select to anon,authenticated using (is_active=true);
create policy tags_insert on public.tags for insert to authenticated with check (public.can_contribute() and created_by=auth.uid());
create policy tags_update on public.tags for update to authenticated using (created_by=auth.uid() or public.can_edit()) with check (created_by=auth.uid() or public.can_edit());
create policy tags_delete on public.tags for delete to authenticated using (created_by=auth.uid() or public.can_edit());
create policy entity_tags_read on public.entity_tags for select to anon,authenticated using (true);
create policy entity_tags_write on public.entity_tags for all to authenticated using (public.can_contribute()) with check (public.can_contribute());

create index if not exists tags_created_by_idx on public.tags(created_by);
create index if not exists entity_tags_tag_id_idx on public.entity_tags(tag_id);
create index if not exists entity_tags_entity_idx on public.entity_tags(entity_type,entity_id);

-- V1.1.5 — icônes personnalisées pour tags/étiquettes
alter table public.tags add column if not exists icon_image_path text;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('tag-icons','tag-icons',true,524288,array['image/webp','image/png','image/jpeg']::text[])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists tag_icons_insert on storage.objects;
drop policy if exists tag_icons_update on storage.objects;
drop policy if exists tag_icons_delete on storage.objects;
create policy tag_icons_insert on storage.objects for insert to authenticated
with check(bucket_id='tag-icons' and public.can_contribute() and (storage.foldername(name))[1]=auth.uid()::text);
create policy tag_icons_update on storage.objects for update to authenticated
using(bucket_id='tag-icons' and (owner=auth.uid() or public.can_edit()))
with check(bucket_id='tag-icons' and (owner=auth.uid() or public.can_edit()));
create policy tag_icons_delete on storage.objects for delete to authenticated
using(bucket_id='tag-icons' and (owner=auth.uid() or public.can_edit()));

-- V1.1.15 — Tags ↔ Référentiels
create table if not exists public.tag_reference_links (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.tags(id) on delete cascade,
  reference_type text not null check (reference_type in ('selection','competition','opponent','place','personnel','equipment','bibliography','match','callup')),
  reference_id uuid not null,
  relation_kind text not null default 'membership' check (relation_kind in ('membership','status','topic')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(tag_id,reference_type,reference_id,relation_kind)
);
alter table public.tag_reference_links enable row level security;
drop policy if exists tag_reference_links_read on public.tag_reference_links;
drop policy if exists tag_reference_links_write on public.tag_reference_links;
create policy tag_reference_links_read on public.tag_reference_links for select to anon,authenticated using(true);
create policy tag_reference_links_write on public.tag_reference_links for all to authenticated using(public.can_contribute()) with check(public.can_contribute());
create index if not exists tag_reference_links_tag_idx on public.tag_reference_links(tag_id);
create index if not exists tag_reference_links_ref_idx on public.tag_reference_links(reference_type,reference_id,relation_kind);

-- V1.1.18 — Accomplissement Capitanat
alter table public.player_achievements
  add column if not exists achievement_value integer
  check (achievement_value is null or achievement_value >= 0);

insert into public.achievements(slug,label_text,icon_text,icon_image_path,description_short,appearance)
values('capitanat','Capitanat','C','assets/achievement-capitanat.png','Nombre de capitanats avec la sélection concernée.',jsonb_build_object('badge_background','navy_duotone','counter_prefix','×','counter_position','top'))
on conflict (slug) do update set label_text=excluded.label_text,icon_text=excluded.icon_text,icon_image_path=excluded.icon_image_path,description_short=excluded.description_short,appearance=excluded.appearance,updated_at=now();

-- V1.1.19 — gestionnaire d'accomplissements + affiliations + icônes
alter table public.achievements add column if not exists is_active boolean not null default true;
alter table public.achievements add column if not exists icon_storage_path text;
create table if not exists public.achievement_reference_scopes (
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  reference_type text not null check (reference_type in ('selection','callup','match','competition','opponent','personnel','equipment','statistics','place','bibliography')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(achievement_id,reference_type)
);
alter table public.achievement_reference_scopes enable row level security;
drop policy if exists achievement_reference_scopes_read on public.achievement_reference_scopes;
drop policy if exists achievement_reference_scopes_write on public.achievement_reference_scopes;
create policy achievement_reference_scopes_read on public.achievement_reference_scopes for select to anon,authenticated using(true);
create policy achievement_reference_scopes_write on public.achievement_reference_scopes for all to authenticated using(public.can_edit_selections()) with check(public.can_edit_selections());
create index if not exists achievement_reference_scopes_type_idx on public.achievement_reference_scopes(reference_type);
insert into public.achievement_reference_scopes(achievement_id,reference_type,created_by)
select a.id,'selection',a.created_by from public.achievements a where a.slug='capitanat' on conflict do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('achievement-icons','achievement-icons',true,524288,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists achievement_icons_insert on storage.objects;
drop policy if exists achievement_icons_update on storage.objects;
drop policy if exists achievement_icons_delete on storage.objects;
create policy achievement_icons_insert on storage.objects for insert to authenticated with check(bucket_id='achievement-icons' and public.can_edit_selections() and (storage.foldername(name))[1]=auth.uid()::text);
create policy achievement_icons_update on storage.objects for update to authenticated using(bucket_id='achievement-icons' and (owner=auth.uid() or public.can_edit_selections())) with check(bucket_id='achievement-icons' and (owner=auth.uid() or public.can_edit_selections()));
create policy achievement_icons_delete on storage.objects for delete to authenticated using(bucket_id='achievement-icons' and (owner=auth.uid() or public.can_edit_selections()));
create index if not exists players_secondary_positions_gin on public.players using gin(secondary_positions);

-- V1.1.51 — photos/bordures des tuiles Staff, Arbitres et Stades.
-- match_appearances existait déjà et sert directement aux feuilles de match dépliables.
alter table public.personnel
  add column if not exists photo_path text,
  add column if not exists tile_border_appearance text not null default 'gradient',
  add column if not exists tile_border_color_start text not null default '#123B8F',
  add column if not exists tile_border_color_end text not null default '#2F6DFF',
  add column if not exists tile_border_gradient_angle integer not null default 135,
  add column if not exists tile_border_width integer not null default 3,
  add column if not exists tile_border_radius integer not null default 14;
alter table public.places
  add column if not exists photo_path text,
  add column if not exists tile_border_appearance text not null default 'gradient',
  add column if not exists tile_border_color_start text not null default '#123B8F',
  add column if not exists tile_border_color_end text not null default '#2F6DFF',
  add column if not exists tile_border_gradient_angle integer not null default 135,
  add column if not exists tile_border_width integer not null default 3,
  add column if not exists tile_border_radius integer not null default 14;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('reference-photos','reference-photos',true,5242880,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists reference_photos_insert on storage.objects;
drop policy if exists reference_photos_update on storage.objects;
drop policy if exists reference_photos_delete on storage.objects;
create policy reference_photos_insert on storage.objects for insert to authenticated with check(bucket_id='reference-photos' and public.can_edit());
create policy reference_photos_update on storage.objects for update to authenticated using(bucket_id='reference-photos' and (owner=auth.uid() or public.can_edit())) with check(bucket_id='reference-photos' and (owner=auth.uid() or public.can_edit()));
create policy reference_photos_delete on storage.objects for delete to authenticated using(bucket_id='reference-photos' and (owner=auth.uid() or public.can_edit()));

-- 3615 Bleus V1.1.59 — Référentiel Maillots
-- Exécuter dans Supabase SQL Editor sur une base existante.

create table if not exists public.jerseys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  season_label text,
  year_start integer,
  year_end integer,
  usage_type text not null default 'domicile',
  gender_scope text,
  manufacturer text,
  manufacturer_reference text,
  template_name text,
  primary_color text,
  secondary_color text,
  accent_colors text[] not null default '{}',
  collar_type text,
  sleeve_type text,
  pattern_description text,
  crest_description text,
  stars_count integer,
  number_font text,
  player_name_font text,
  material text,
  technology text,
  fit_type text,
  version_type text,
  first_worn_date date,
  last_worn_date date,
  launch_date date,
  notes_short text,
  description_long text,
  source_urls text[] not null default '{}',
  main_photo_path text,
  main_photo_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jersey_selection_teams (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  selection_team_id uuid not null references public.selection_teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (jersey_id, selection_team_id)
);

create table if not exists public.jersey_competitions (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (jersey_id, competition_id)
);

create table if not exists public.jersey_photos (
  id uuid primary key default gen_random_uuid(),
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  photo_path text,
  photo_url text,
  photo_type text not null default 'autre',
  caption text,
  credit text,
  source_url text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists jerseys_year_idx on public.jerseys(year_start,year_end);
create index if not exists jerseys_usage_idx on public.jerseys(usage_type);
create index if not exists jerseys_manufacturer_idx on public.jerseys(manufacturer);
create index if not exists jersey_photos_jersey_idx on public.jersey_photos(jersey_id,sort_order);
create index if not exists jersey_selection_teams_team_idx on public.jersey_selection_teams(selection_team_id);
create index if not exists jersey_competitions_comp_idx on public.jersey_competitions(competition_id);

alter table public.jerseys enable row level security;
alter table public.jersey_selection_teams enable row level security;
alter table public.jersey_competitions enable row level security;
alter table public.jersey_photos enable row level security;

drop policy if exists jerseys_public_read on public.jerseys;
create policy jerseys_public_read on public.jerseys for select using (true);
drop policy if exists jerseys_edit on public.jerseys;
create policy jerseys_edit on public.jerseys for all to authenticated
using (public.can_edit()) with check (public.can_edit());

drop policy if exists jersey_selection_teams_public_read on public.jersey_selection_teams;
create policy jersey_selection_teams_public_read on public.jersey_selection_teams for select using (true);
drop policy if exists jersey_selection_teams_edit on public.jersey_selection_teams;
create policy jersey_selection_teams_edit on public.jersey_selection_teams for all to authenticated
using (public.can_edit()) with check (public.can_edit());

drop policy if exists jersey_competitions_public_read on public.jersey_competitions;
create policy jersey_competitions_public_read on public.jersey_competitions for select using (true);
drop policy if exists jersey_competitions_edit on public.jersey_competitions;
create policy jersey_competitions_edit on public.jersey_competitions for all to authenticated
using (public.can_edit()) with check (public.can_edit());

drop policy if exists jersey_photos_public_read on public.jersey_photos;
create policy jersey_photos_public_read on public.jersey_photos for select using (true);
drop policy if exists jersey_photos_edit on public.jersey_photos;
create policy jersey_photos_edit on public.jersey_photos for all to authenticated
using (public.can_edit()) with check (public.can_edit());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('jersey-photos','jersey-photos',true,10485760,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists jersey_photos_storage_insert on storage.objects;
drop policy if exists jersey_photos_storage_update on storage.objects;
drop policy if exists jersey_photos_storage_delete on storage.objects;
create policy jersey_photos_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='jersey-photos' and public.can_edit());
create policy jersey_photos_storage_update on storage.objects for update to authenticated
using(bucket_id='jersey-photos' and (owner=auth.uid() or public.can_edit()))
with check(bucket_id='jersey-photos' and (owner=auth.uid() or public.can_edit()));
create policy jersey_photos_storage_delete on storage.objects for delete to authenticated
using(bucket_id='jersey-photos' and (owner=auth.uid() or public.can_edit()));



-- === V1.1.60.3 : Maillots ↔ Matchs ===
-- 3615 Bleus V1.1.60.3 — relation Maillots ↔ Feuilles de match
-- Exécuter dans Supabase SQL Editor après la migration V1.1.59 Maillots.

create table if not exists public.match_jerseys (
  match_id uuid not null references public.matches(id) on delete cascade,
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  selection_team_id uuid references public.selection_teams(id) on delete set null,
  role text not null default 'outfield',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, jersey_id, role)
);

create index if not exists match_jerseys_match_idx on public.match_jerseys(match_id);
create index if not exists match_jerseys_jersey_idx on public.match_jerseys(jersey_id);
create index if not exists match_jerseys_selection_idx on public.match_jerseys(selection_team_id);

alter table public.match_jerseys enable row level security;

drop policy if exists match_jerseys_public_read on public.match_jerseys;
create policy match_jerseys_public_read on public.match_jerseys for select using (true);

drop policy if exists match_jerseys_edit on public.match_jerseys;
create policy match_jerseys_edit on public.match_jerseys for all to authenticated
using (public.can_edit()) with check (public.can_edit());

comment on table public.match_jerseys is 'Lien relationnel entre une feuille de match et le maillot France utilisé.';
comment on column public.match_jerseys.role is 'outfield par défaut ; permet ensuite gardien ou variantes si nécessaire.';


-- === MIGRATION_V1.1.7_SELECTIONS_TAG_CORRECTED.sql ============================================================

-- Bleus 3000 V1.1.6 — Référentiel SELECTIONS
-- Cette migration est déjà appliquée au projet Supabase bleus3000 de production.
-- Le seed des 949 France A Masculins a également été appliqué côté base et n'est volontairement
-- pas embarqué dans le frontend statique.

alter table public.players
  add column if not exists legacy_key text,
  add column if not exists profile_slug text,
  add column if not exists name_normalized text,
  add column if not exists photo_path text,
  add column if not exists data_status text,
  add column if not exists active_source boolean not null default false;

create unique index if not exists players_legacy_key_uidx on public.players(legacy_key) where legacy_key is not null;
create unique index if not exists players_profile_slug_uidx on public.players(profile_slug) where profile_slug is not null;
create index if not exists players_name_normalized_idx on public.players(name_normalized);

create table if not exists public.selection_teams (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  gender text not null check (gender in ('M','F')), category text not null, sort_order int not null default 100,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.selection_photo_borders (
  selection_id uuid primary key references public.selection_teams(id) on delete cascade,
  appearance text not null default 'gradient' check (appearance in ('solid','gradient')),
  color_start text not null default '#1D4ED8', color_end text not null default '#0EA5E9',
  border_width int not null default 4, border_radius int not null default 16, gradient_angle int not null default 135,
  updated_by uuid references public.profiles(id) on delete set null, updated_at timestamptz not null default now()
);

create table if not exists public.player_selection_stats (
  id uuid primary key default gen_random_uuid(), player_id uuid not null references public.players(id) on delete cascade,
  selection_id uuid not null references public.selection_teams(id) on delete cascade,
  selections int, goals int, wins int, draws int, losses int, starts int, minutes int,
  international_number int, first_year int, last_year int, source_rank int, source_date date, data_status text,
  updated_by uuid references public.profiles(id) on delete set null, updated_at timestamptz not null default now(),
  unique(player_id,selection_id)
);

create table if not exists public.player_jersey_numbers (
  id uuid primary key default gen_random_uuid(), player_id uuid not null references public.players(id) on delete cascade,
  selection_id uuid not null references public.selection_teams(id) on delete cascade,
  shirt_number int not null check (shirt_number between 0 and 99), first_match_date date, last_match_date date,
  appearances_count int, notes_short text, created_at timestamptz not null default now(), unique(player_id,selection_id,shirt_number)
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(), slug text not null unique, label_text text not null,
  icon_text text, icon_image_path text, description_short text, appearance jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.player_achievements (
  player_id uuid not null references public.players(id) on delete cascade,
  selection_id uuid references public.selection_teams(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  achieved_on date, notes_short text, added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), primary key(player_id,achievement_id,selection_id)
);

-- Catégories créées en production :
-- FRA-A-M, FRA-ESP-M, FRA-U20-M, FRA-U19-M, FRA-U18-M, FRA-U17-M, FRA-U16-M
-- FRA-A-F, FRA-U23-F, FRA-U20-F, FRA-U19-F, FRA-U18-F, FRA-U17-F, FRA-U16-F
-- Les droits d'écriture de ce référentiel sont réservés à CONTRIBUTOR / ADMIN / SUPERADMIN.

create or replace function public.can_edit_selections()
returns boolean language sql stable security definer set search_path=public
as $$ select public.current_role() in ('admin','superadmin') $$;
revoke all on function public.can_edit_selections() from public,anon;
grant execute on function public.can_edit_selections() to authenticated,service_role;

create or replace function public.adjust_selection_stat(p_player_id uuid,p_selection_id uuid,p_field text,p_delta int)
returns public.player_selection_stats language plpgsql security definer set search_path=public as $$
declare r public.player_selection_stats;
begin
  if auth.uid() is null or not public.can_edit_selections() then raise exception 'Modification non autorisée'; end if;
  if p_field not in ('selections','goals','wins','draws','losses','starts') then raise exception 'Champ statistique non autorisé'; end if;
  if p_delta not in (-1,1) then raise exception 'Delta non autorisé'; end if;
  execute format('update public.player_selection_stats set %I=greatest(coalesce(%I,0)+$1,0),updated_by=auth.uid(),updated_at=now() where player_id=$2 and selection_id=$3 returning *',p_field,p_field)
    into r using p_delta,p_player_id,p_selection_id;
  if r.id is null then raise exception 'Ligne statistique introuvable'; end if;
  insert into public.entity_contributors(entity_type,entity_id,user_id,contribution_type)
    values ('player',p_player_id,auth.uid(),'stat_update') on conflict do nothing;
  insert into public.data_change_log(actor_user_id,entity_type,entity_id,action,after_data)
    values (auth.uid(),'player_selection_stats',r.id::text,'adjust_'||p_field,to_jsonb(r));
  return r;
end $$;
revoke all on function public.adjust_selection_stat(uuid,uuid,text,int) from public,anon;
grant execute on function public.adjust_selection_stat(uuid,uuid,text,int) to authenticated,service_role;

create or replace function public.record_selection_contribution(p_player_id uuid,p_type text default 'edit')
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.can_edit_selections() then raise exception 'Modification non autorisée'; end if;
  insert into public.entity_contributors(entity_type,entity_id,user_id,contribution_type)
    values ('player',p_player_id,auth.uid(),left(coalesce(p_type,'edit'),80)) on conflict do nothing;
end $$;
revoke all on function public.record_selection_contribution(uuid,text) from public,anon;
grant execute on function public.record_selection_contribution(uuid,text) to authenticated,service_role;

alter table public.selection_teams enable row level security;
alter table public.selection_photo_borders enable row level security;
alter table public.player_selection_stats enable row level security;
alter table public.player_jersey_numbers enable row level security;
alter table public.achievements enable row level security;
alter table public.player_achievements enable row level security;

create policy selection_teams_read on public.selection_teams for select to anon,authenticated using(true);
create policy selection_teams_write on public.selection_teams for all to authenticated using(public.can_edit_selections()) with check(public.can_edit_selections());
create policy selection_borders_read on public.selection_photo_borders for select to anon,authenticated using(true);
create policy selection_borders_write on public.selection_photo_borders for all to authenticated using(public.can_edit_selections()) with check(public.can_edit_selections());
create policy selection_stats_read on public.player_selection_stats for select to anon,authenticated using(true);
create policy selection_stats_write on public.player_selection_stats for all to authenticated using(public.can_edit_selections()) with check(public.can_edit_selections());
create policy jersey_read on public.player_jersey_numbers for select to anon,authenticated using(true);
create policy jersey_write on public.player_jersey_numbers for all to authenticated using(public.can_edit_selections()) with check(public.can_edit_selections());
create policy achievements_read on public.achievements for select to anon,authenticated using(true);
create policy achievements_write on public.achievements for all to authenticated using(public.can_edit_selections()) with check(public.can_edit_selections());
create policy player_achievements_read on public.player_achievements for select to anon,authenticated using(true);
create policy player_achievements_write on public.player_achievements for all to authenticated using(public.can_edit_selections()) with check(public.can_edit_selections());

insert into public.selection_teams(code,name,gender,category,sort_order) values
('FRA-A-M','France A Masculin','M','A',10),('FRA-ESP-M','France Espoirs / U21 Masculin','M','Espoirs/U21',20),
('FRA-U20-M','France U20 Masculin','M','U20',30),('FRA-U19-M','France U19 Masculin','M','U19',40),
('FRA-U18-M','France U18 Masculin','M','U18',50),('FRA-U17-M','France U17 Masculin','M','U17',60),
('FRA-U16-M','France U16 Masculin','M','U16',70),('FRA-A-F','France A Féminin','F','A',110),
('FRA-U23-F','France U23 / Espoirs Féminine','F','U23/Espoirs',120),('FRA-U20-F','France U20 Féminine','F','U20',130),
('FRA-U19-F','France U19 Féminine','F','U19',140),('FRA-U18-F','France U18 Féminine','F','U18',150),
('FRA-U17-F','France U17 Féminine','F','U17',160),('FRA-U16-F','France U16 Féminine','F','U16',170)
on conflict(code) do update set name=excluded.name,gender=excluded.gender,category=excluded.category,sort_order=excluded.sort_order,active=true;

-- Le tag France A Masculin existe déjà dans le catalogue utilisateur.
-- Cette migration ne crée aucun doublon : elle attend le tag slug = 'international'.
-- Son libellé, son icône importée et son style restent entièrement gérés depuis le menu Profil.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('player-photos','player-photos',true,2097152,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy player_photos_insert on storage.objects for insert to authenticated
with check(bucket_id='player-photos' and public.can_edit_selections());
create policy player_photos_delete on storage.objects for delete to authenticated
using(bucket_id='player-photos' and public.can_edit_selections());


-- === MIGRATION_V1.1.8_PHOTO_RLS_FIX.sql ============================================================

-- Déjà appliqué au projet Supabase bleus3000.
-- Correctif RLS du bucket player-photos : SELECT/INSERT/UPDATE/DELETE
-- autorisés aux CONTRIBUTOR / ADMIN / SUPERADMIN via can_edit_selections().


-- === MIGRATION_V1.1.12_CONVOCATION_STATUS.sql ============================================================

-- Bleus 3000 V1.1.12 — statut Convocation / International
alter table public.player_selection_stats
  add column if not exists appearance_status text not null default 'capped'
  check (appearance_status in ('capped','called_only'));

update public.player_selection_stats
set appearance_status='capped'
where appearance_status is null
   or selections > 0
   or international_number is not null;

create index if not exists pss_appearance_status_idx
  on public.player_selection_stats(selection_id, appearance_status);


-- === MIGRATION_V1.1.14_GLOBAL_PLAYERS_TABLE.sql ============================================================

-- Bleus 3000 V1.1.14 — Base globale joueurs + tag principal par sélection
alter table public.selection_teams
  add column if not exists team_tag_id uuid references public.tags(id) on delete set null;

create index if not exists selection_teams_team_tag_idx
  on public.selection_teams(team_tag_id);

update public.selection_teams s
set team_tag_id=t.id
from public.tags t
where
  (s.code='FRA-A-M' and t.slug='international')
  or (s.code='FRA-U17-M' and t.slug='u17')
  or (s.code='FRA-U17-F' and t.slug='u17-feminin');

create index if not exists players_primary_position_idx
  on public.players(primary_position);


-- === MIGRATION_V1.1.15_TAG_REFERENCE_LINKS.sql ============================================================

-- Bleus 3000 V1.1.15 — liaison explicite Tags ↔ Référentiels
create table if not exists public.tag_reference_links (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.tags(id) on delete cascade,
  reference_type text not null check (reference_type in ('selection','competition','opponent','place','personnel','equipment','bibliography','match','callup')),
  reference_id uuid not null,
  relation_kind text not null default 'membership' check (relation_kind in ('membership','status','topic')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(tag_id,reference_type,reference_id,relation_kind)
);
alter table public.tag_reference_links enable row level security;
drop policy if exists tag_reference_links_read on public.tag_reference_links;
drop policy if exists tag_reference_links_write on public.tag_reference_links;
create policy tag_reference_links_read on public.tag_reference_links for select to anon,authenticated using(true);
create policy tag_reference_links_write on public.tag_reference_links for all to authenticated using(public.can_contribute()) with check(public.can_contribute());
create index if not exists tag_reference_links_tag_idx on public.tag_reference_links(tag_id);
create index if not exists tag_reference_links_ref_idx on public.tag_reference_links(reference_type,reference_id,relation_kind);


-- === MIGRATION_V1.1.17_FRANCE_A_FEMININE.sql ============================================================

-- V1.1.17 — structure complémentaire France A Féminine
alter table public.player_selection_stats
  add column if not exists first_selection_date date,
  add column if not exists first_selection_competition_code text,
  add column if not exists first_selection_match text,
  add column if not exists first_callup_text text,
  add column if not exists source_quality text;

create or replace view public.selection_team_counts
with (security_invoker = true)
as
select selection_id, count(*)::int as player_count
from public.player_selection_stats
group by selection_id;

grant select on public.selection_team_counts to anon, authenticated;

-- Les 339 joueuses ont été importées dans le projet Supabase bleus3000.
-- Le fichier source n'est volontairement pas embarqué dans le front public.


-- === MIGRATION_V1.1.18_CAPITANAT.sql ============================================================

-- Bleus 3000 V1.1.18 — Accomplissement Capitanat
alter table public.player_achievements
  add column if not exists achievement_value integer
  check (achievement_value is null or achievement_value >= 0);

insert into public.achievements(
  slug,label_text,icon_text,icon_image_path,description_short,appearance
)
values(
  'capitanat',
  'Capitanat',
  'C',
  'assets/achievement-capitanat.png',
  'Nombre de capitanats avec la sélection concernée.',
  jsonb_build_object(
    'badge_background','navy_duotone',
    'counter_prefix','×',
    'counter_position','top'
  )
)
on conflict (slug) do update set
  label_text=excluded.label_text,
  icon_text=excluded.icon_text,
  icon_image_path=excluded.icon_image_path,
  description_short=excluded.description_short,
  appearance=excluded.appearance,
  updated_at=now();


-- === MIGRATION_V1.1.19_ACHIEVEMENTS_POSITIONS.sql ============================================================

-- Bleus 3000 V1.1.19 — gestionnaire d'accomplissements + icônes + affiliations
alter table public.achievements
  add column if not exists is_active boolean not null default true;
alter table public.achievements
  add column if not exists icon_storage_path text;

create table if not exists public.achievement_reference_scopes (
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  reference_type text not null check (reference_type in (
    'selection','callup','match','competition','opponent',
    'personnel','equipment','statistics','place','bibliography'
  )),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (achievement_id, reference_type)
);
alter table public.achievement_reference_scopes enable row level security;
drop policy if exists achievement_reference_scopes_read on public.achievement_reference_scopes;
drop policy if exists achievement_reference_scopes_write on public.achievement_reference_scopes;
create policy achievement_reference_scopes_read on public.achievement_reference_scopes
  for select to anon,authenticated using(true);
create policy achievement_reference_scopes_write on public.achievement_reference_scopes
  for all to authenticated using(public.can_edit_selections()) with check(public.can_edit_selections());
create index if not exists achievement_reference_scopes_type_idx on public.achievement_reference_scopes(reference_type);

insert into public.achievement_reference_scopes(achievement_id,reference_type,created_by)
select a.id,'selection',a.created_by from public.achievements a where a.slug='capitanat'
on conflict do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('achievement-icons','achievement-icons',true,524288,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists achievement_icons_insert on storage.objects;
drop policy if exists achievement_icons_update on storage.objects;
drop policy if exists achievement_icons_delete on storage.objects;
create policy achievement_icons_insert on storage.objects for insert to authenticated
with check(bucket_id='achievement-icons' and public.can_edit_selections() and (storage.foldername(name))[1]=auth.uid()::text);
create policy achievement_icons_update on storage.objects for update to authenticated
using(bucket_id='achievement-icons' and (owner=auth.uid() or public.can_edit_selections()))
with check(bucket_id='achievement-icons' and (owner=auth.uid() or public.can_edit_selections()));
create policy achievement_icons_delete on storage.objects for delete to authenticated
using(bucket_id='achievement-icons' and (owner=auth.uid() or public.can_edit_selections()));

create index if not exists players_secondary_positions_gin on public.players using gin(secondary_positions);


-- === MIGRATION_V1.1.20_FRANCE_A_FEMININE_VND_NUMEROS_CAPITANAT.sql ============================================================

-- Bleus 3000 V1.1.20 — France A Féminine : V/N/D, numéros observés, capitanat vérifié

alter table public.player_selection_stats
  add column if not exists vnd_source_selections integer,
  add column if not exists vnd_coherence text;

create or replace function public.import_france_a_fem_v2_blob(p_blob text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  l text;
  a text[];
  v_player_id uuid;
  v_selection_id uuid;
  v_achievement_id uuid;
  v_num text;
  v_stats_count int := 0;
  v_jersey_inserted int := 0;
  v_cap_inserted int := 0;
begin
  select id into v_selection_id from public.selection_teams where code='FRA-A-F';
  select id into v_achievement_id from public.achievements where slug='capitanat';
  if v_selection_id is null then raise exception 'Sélection FRA-A-F introuvable'; end if;
  if v_achievement_id is null then raise exception 'Accomplissement capitanat introuvable'; end if;

  foreach l in array string_to_array(p_blob,E'\n') loop
    if btrim(l)='' then continue; end if;
    a := string_to_array(l,'|');
    if array_length(a,1) <> 8 then raise exception 'Ligne invalide (% champs): %',array_length(a,1),l; end if;
    select id into v_player_id from public.players where legacy_key=a[1];
    if v_player_id is null then raise exception 'Joueuse introuvable: %',a[1]; end if;

    update public.player_selection_stats
    set wins=a[2]::int, draws=a[3]::int, losses=a[4]::int,
        vnd_source_selections=nullif(a[5],'')::int,
        vnd_coherence=nullif(a[6],''), updated_at=now()
    where player_id=v_player_id and selection_id=v_selection_id;
    if found then v_stats_count:=v_stats_count+1; end if;

    if nullif(a[7],'') is not null then
      foreach v_num in array string_to_array(a[7],',') loop
        insert into public.player_jersey_numbers(player_id,selection_id,shirt_number,notes_short)
        values(v_player_id,v_selection_id,v_num::int,
          'Numéro observé dans le référentiel féminin A V2 (reconstruction partielle vérifiée, non exhaustive).')
        on conflict (player_id,selection_id,shirt_number) do nothing;
        if found then v_jersey_inserted:=v_jersey_inserted+1; end if;
      end loop;
    end if;

    if a[8]::int > 0 then
      insert into public.player_achievements(player_id,selection_id,achievement_id,achievement_value,notes_short)
      values(v_player_id,v_selection_id,v_achievement_id,a[8]::int,
        'Minimum vérifié dans le référentiel féminin A V2 : échantillon de 4 feuilles de match, capitanat non exhaustif.')
      on conflict (player_id,achievement_id,selection_id) do nothing;
      if found then v_cap_inserted:=v_cap_inserted+1; end if;
    end if;
  end loop;

  return jsonb_build_object('stats_updated',v_stats_count,'jersey_rows_inserted',v_jersey_inserted,'capitanat_rows_inserted',v_cap_inserted);
end;
$$;

revoke all on function public.import_france_a_fem_v2_blob(text) from public,anon,authenticated;
grant execute on function public.import_france_a_fem_v2_blob(text) to service_role;

select public.import_france_a_fem_v2_blob(convert_from(decode('RURGLUYtQS1FVUdFTklFLUxFLVNPTU1FUi1EQVJJRUx8MTQyfDMzfDI1fDIwMHxPS3x8MApFREYtRi1BLVNBTkRSSU5FLVNPVUJFWVJBTkR8MTE1fDM5fDQ0fDE5OHxPS3x8MApFREYtRi1BLUVMSVNFLUJVU1NBR0xJQXwxMzR8Mjd8MzF8MTkyfE9LfDE1fDEKRURGLUYtQS1MQVVSQS1HRU9SR0VTfDEyMXwzNnwzMXwxODh8T0t8NHwwCkVERi1GLUEtQ0FNSUxMRS1BQklMWXwxMjJ8MzJ8Mjl8MTgzfE9LfHwwCkVERi1GLUEtV0VORElFLVJFTkFSRHwxMjN8MjJ8MjN8MTY4fE9LfDN8MQpFREYtRi1BLUdBRVRBTkUtVEhJTkVZfDExOHwyNXwyMHwxNjN8T0t8MTd8MApFREYtRi1BLVNPTklBLUJPTVBBU1RPUnw5OXwyM3wzNHwxNTZ8T0t8OHwwCkVERi1GLUEtU0FSQUgtQk9VSEFEREl8OTl8Mjd8MjN8MTQ5fE9LfDE2fDAKRURGLUYtQS1MT1VJU0EtTkVDSUItQ0FEQU1VUk98MTAyfDIyfDIxfDE0NXxPS3x8MApFREYtRi1BLUVMT0RJRS1USE9NSVN8OTZ8MjN8MjJ8MTQxfE9LfDEyfDAKRURGLUYtQS1LQURJRElBVE9VLURJQU5JfDgzfDE4fDIxfDEyMnxQcm9maWwgU3RhdHNGb290IGVuIHJldGFyZCAvIMOpY2FydCBzb3VyY2V8MTF8MApFREYtRi1BLU1BUklFLUxBVVJFLURFTElFfDg3fDIwfDE2fDEyM3xPS3x8MApFREYtRi1BLUNPUklOTkUtRElBQ1JFfDY2fDIwfDM1fDEyMXxPS3x8MApFREYtRi1BLVNURVBIQU5JRS1NVUdORVJFVC1CRUdIRXw2MXwyMXwzNHwxMTZ8T0t8fDAKRURGLUYtQS1NQVJJTkVUVEUtUElDSE9OfDYyfDIxfDI5fDExMnxPS3x8MApFREYtRi1BLUdSQUNFLUdFWU9ST3w3OHwxOHwxN3wxMTN8T0t8OHwwCkVERi1GLUEtSE9EQS1MQVRUQUZ8NTl8MTl8MzN8MTExfE9LfHwwCkVERi1GLUEtQU1BTkRJTkUtSEVOUll8Nzl8MTV8MTV8MTA5fE9LfDZ8MApFREYtRi1BLVNBS0lOQS1LQVJDSEFPVUl8NzZ8MTR8MTJ8MTAyfE9LfDd8MQpFREYtRi1BLUdSSUVER0UtTUJPQ0stQkFUSFktTktBfDcxfDEzfDE0fDk4fE9LfHwwCkVERi1GLUEtU0FCUklOQS1WSUdVSUVSfDY0fDE2fDEzfDkzfE9LfDV8MApFREYtRi1BLVBFR0dZLVBST1ZPU1R8NDh8MTl8MjV8OTJ8UHJvZmlsIFN0YXRzRm9vdCBwbHVzIHLDqWNlbnQgcXVlIFYxfHwwCkVERi1GLUEtQ09SSU5FLVBFVElULUZSQU5DT3w2NHwxM3wxMnw4OXxPS3w3fDAKRURGLUYtQS1ERUxQSElORS1DQVNDQVJJTk98NjR8OXwxM3w4NnxPS3wxMCwyMHwwCkVERi1GLUEtQ0FORElFLUhFUkJFUlR8NDl8MTN8MjF8ODN8T0t8OXwwCkVERi1GLUEtRU1NQU5VRUxMRS1TWUtPUkF8NDl8MTN8MjB8ODJ8T0t8fDAKRURGLUYtQS1BTUVMLU1BSlJJfDY1fDl8OHw4MnxPS3wxMHwwCkVERi1GLUEtRUxPRElFLVdPT0NLfDQwfDE1fDIzfDc4fE9LfHwwCkVERi1GLUEtUEFVTElORS1QRVlSQVVELU1BR05JTnw1N3w5fDEwfDc2fE9LfDE2LDIxfDAKRURGLUYtQS1LRU5aQS1EQUxJfDU5fDV8MTJ8NzZ8T0t8MTV8MApFREYtRi1BLVNBTkRJRS1UT0xFVFRJfDU5fDd8Nnw3MnxPS3w2LDE0fDAKRURGLUYtQS1TQU5EUklORS1ST1VYfDMxfDE1fDI0fDcwfFByb2ZpbCBTdGF0c0Zvb3QgZW4gcmV0YXJkIC8gw6ljYXJ0IHNvdXJjZXx8MApFREYtRi1BLU9QSEVMSUUtTUVJTExFUk9VWHw1NHw0fDl8Njd8T0t8fDAKRURGLUYtQS1WSVZJQU5FLUFTU0VZSXw1MHw4fDh8NjZ8T0t8MTh8MApFREYtRi1BLUxBRVRJVElBLVRPTkFaWkl8MzZ8MTh8MTJ8NjZ8T0t8MTF8MApFREYtRi1BLUxBVVJFLUJPVUxMRUFVfDQ5fDEyfDR8NjV8T0t8fDAKRURGLUYtQS1DRUxJTkUtREVWSUxMRXw0NHwxMHwxMXw2NXxPS3wxfDAKRURGLUYtQS1KRVNTSUNBLUhPVUFSQS1ELUhPTU1FQVVYfDQzfDEyfDl8NjR8T0t8fDAKRURGLUYtQS1NQVJJRS1BTlRPSU5FVFRFLUtBVE9UT3w1MXw0fDEwfDY1fFByb2ZpbCBTdGF0c0Zvb3QgZW4gcmV0YXJkIC8gw6ljYXJ0IHNvdXJjZXw5LDEyfDAKRURGLUYtQS1IRUxFTkUtSElMTElPTi1HVUlMTEVNSU58Mjh8MTJ8MjJ8NjJ8T0t8fDAKRURGLUYtQS1FVkUtUEVSSVNTRVR8NDh8Nnw3fDYxfE9LfDIsMjJ8MApFREYtRi1BLUFMSU5FLVJJRVJBLVVCSUVSR098MzJ8MTF8MTd8NjB8T0t8fDAKRURGLUYtQS1DSEFSTE9UVEUtQklMQkFVTFR8NDZ8NHw2fDU2fE9LfDE0fDAKRURGLUYtQS1GUkFOQ09JU0UtSkVaRVFVRUx8MzB8N3wxOXw1NnxPS3x8MApFREYtRi1BLVNBTkRZLUJBTFRJTU9SRXw0Mnw3fDh8NTd8T0t8fDAKRURGLUYtQS1TRUxNQS1CQUNIQXwzOXw0fDExfDU0fE9LfDEzfDAKRURGLUYtQS1FTElTQS1ERS1BTE1FSURBfDM3fDd8OHw1MnxPS3w1LDIyfDAKRURGLUYtQS1NQVJJT04tVE9SUkVOVHw0MHw2fDV8NTF8T0t8fDAKRURGLUYtQS1BTkdFTElRVUUtUk9VSkFTfDIyfDExfDE4fDUxfE9LfHwwCkVERi1GLUEtQU5ORS1aRU5PTkl8MjN8MTF8MTZ8NTB8T0t8fDAKRURGLUYtQS1DTEFSQS1NQVRFT3wzOHw2fDV8NDl8T0t8MTJ8MApFREYtRi1BLVNBTkRSSU5FLURVU0FOR3wzMHw4fDl8NDd8T0t8fDAKRURGLUYtQS1DRUNJTEUtTE9DQVRFTExJfDI1fDl8MTJ8NDZ8T0t8fDAKRURGLUYtQS1CRVJOQURFVFRFLUNPTlNUQU5USU58MTh8OHwxOXw0NXxPS3x8MApFREYtRi1BLU1BUklFLUFOR0UtS1JBTU98MjV8NnwxM3w0NHxPS3x8MApFREYtRi1BLVNPUEhJRS1SWUNLRUJPRVItQ0hBUlJJRVJ8MTN8MTJ8MTd8NDJ8T0t8fDAKRURGLUYtQS1FTElTQUJFVEgtTE9JU0VMfDEyfDEzfDE2fDQxfE9LfHwwCkVERi1GLUEtSVNBQkVMTEUtTVVTU0VUfDEzfDEzfDE1fDQxfE9LfHwwCkVERi1GLUEtR0FFTExFLUJMT1VJTnwyMXw3fDEzfDQxfE9LfHwwCkVERi1GLUEtS0hFSVJBLUhBTVJBT1VJfDMwfDZ8NXw0MXxPS3x8MApFREYtRi1BLUFJU1NBVE9VLVRPVU5LQVJBfDMxfDV8NHw0MHxPS3w1fDEKRURGLUYtQS1DRUxJTkUtTUFSVFl8MjV8NXwxMHw0MHxPS3x8MApFREYtRi1BLU1FTFZJTkUtTUFMQVJEfDMyfDR8NXw0MXxPS3wxMiwxNHwwCkVERi1GLUEtVkVST05JUVVFLU5PV0FLfDE1fDEwfDE0fDM5fE9LfHwwCkVERi1GLUEtTFVESVZJTkUtRElHVUVMTUFOfDIzfDh8OHwzOXxPS3wzfDAKRURGLUYtQS1TQUJSSU5BLURFTEFOTk9ZfDI5fDZ8NHwzOXxPS3x8MApFREYtRi1BLU1BRUxMRS1MQUtSQVJ8MjV8Nnw5fDQwfE9LfDJ8MApFREYtRi1BLVJFR0lORS1NSVNNQUNRfDEzfDl8MTZ8Mzh8T0t8fDAKRURGLUYtQS1MQVVSRS1MRVBBSUxMRVVSfDI0fDZ8OHwzOHxPS3x8MApFREYtRi1BLVZBTEVSSUUtR0FVVklOfDI5fDN8NXwzN3xPS3x8MApFREYtRi1BLU1BUklFLUNIUklTVElORS1VTURFTlNUT0NLfDE0fDl8MTR8Mzd8T0t8fDAKRURGLUYtQS1NSUNIRUxFLVdPTEZ8OHwxMHwxN3wzNXxQcm9maWwgU3RhdHNGb290IGVuIHJldGFyZCAvIMOpY2FydCBzb3VyY2V8fDAKRURGLUYtQS1DTEFJUkUtTEFWT0dFWnwyMnw2fDd8MzV8T0t8fDAKRURGLUYtQS1CUklHSVRURS1PTElWRS1IRU5SSVFVRVN8MTd8Nnw5fDMyfE9LfHwwCkVERi1GLUEtTUFSSUUtQU5HRUxFLUJMSU58MTF8OHwxMnwzMXxPS3x8MApFREYtRi1BLUNBTUlMTEUtQ0FUQUxBfDIzfDd8MXwzMXxPS3x8MApFREYtRi1BLUpPQ0VMWU5FLUdPVVR8MTZ8N3w3fDMwfE9LfHwwCkVERi1GLUEtSVNBQkVMTEUtTEUtQk9VTENIfDEwfDZ8MTN8Mjl8T0t8fDAKRURGLUYtQS1PVUxFWU1BVEEtU0FSUnwxOHw1fDV8Mjh8T0t8fDAKRURGLUYtQS1BTk5FLUxBVVJFLUNBU1NFTEVVWHwxNXw5fDR8Mjh8T0t8fDAKRURGLUYtQS1TWUxWSUUtQkFSQUNBVHw4fDZ8MTN8Mjd8T0t8fDAKRURGLUYtQS1DT1JJTk5FLUxBR0FDSEV8MTJ8Nnw5fDI3fE9LfHwwCkVERi1GLUEtU1lMVklFLUpPU1NFVHw5fDZ8MTF8MjZ8T0t8fDAKRURGLUYtQS1NQVJJRS1BR05FUy1BTk5FUVVJTi1QTEFOVEFHRU5FVHw5fDh8OXwyNnxPS3x8MApFREYtRi1BLU9SSUFORS1KRUFOLUZSQU5DT0lTfDIwfDR8M3wyN3xPS3x8MApFREYtRi1BLU1ZUklBTS1CRVJOQVVFUnwxMHwzfDEyfDI1fE9LfHwwCkVERi1GLUEtTUFSSUVMTEUtQlJFVE9OfDEyfDV8N3wyNHxPS3x8MApFREYtRi1BLU5BVEhBTElFLVRBUkFERXw5fDR8MTF8MjR8T0t8fDAKRURGLUYtQS1GTE9SRU5DRS1SSU1CQVVMVHw1fDh8MTF8MjR8T0t8fDAKRURGLUYtQS1HSElTTEFJTkUtQkFST058MTF8NHw5fDI0fE9LfHwwCkVERi1GLUEtRkFCSUVOTkUtUFJJRVVYfDEyfDN8OHwyM3xPS3x8MApFREYtRi1BLUJFUkFOR0VSRS1TQVBPV0lDWnwxN3wzfDN8MjN8T0t8fDAKRURGLUYtQS1TQU5EUklORS1CUkVUSUdOWXwxNHwzfDV8MjJ8T0t8fDAKRURGLUYtQS1TWUxWSUUtQkFJTExZfDV8NnwxMHwyMXxPS3x8MApFREYtRi1BLU1BUklFLU5PRUxMRS1XQVJPVC1GT1VSRFJJR05JRVJ8Nnw3fDh8MjF8T0t8fDAKRURGLUYtQS1TQU5EUklORS1GVVNJRVJ8MTN8Mnw2fDIxfE9LfHwwCkVERi1GLUEtTUFSSUUtTE9VSVNFLUJVVFpJR3w1fDR8MTF8MjB8T0t8fDAKRURGLUYtQS1TQU5EUklORS1SSU5HTEVSfDExfDF8N3wxOXxPS3x8MApFREYtRi1BLVZJQ0tJLUJFQ0hPfDEyfDN8NXwyMHxPS3wyM3wwCkVERi1GLUEtTUFSSUUtRlJBTkNPSVNFLVNJRElCRXw4fDd8NHwxOXxPS3x8MApFREYtRi1BLUVTVEVMTEUtQ0FTQ0FSSU5PfDEzfDJ8M3wxOHxPS3wyMHwwCkVERi1GLUEtU1lMVklFLVNBVU5JRVJ8Nnw2fDZ8MTh8T0t8fDAKRURGLUYtQS1TQVJBSC1NLUJBUkVLfDl8Mnw3fDE4fE9LfHwwCkVERi1GLUEtU0FORFJJTkUtQ0FQWXwxM3wxfDR8MTh8T0t8fDAKRURGLUYtQS1WRVJPTklRVUUtUk9NQUdOT0xJfDV8NXw3fDE3fE9LfHwwCkVERi1GLUEtQ0FST0xJTkUtUElaWkFMQXwxMnwzfDJ8MTd8T0t8MTh8MApFREYtRi1BLUFNRUxJRS1DT1FVRVR8OXw1fDN8MTd8T0t8fDAKRURGLUYtQS1FTExBLVBBTElTfDEyfDF8M3wxNnxPS3x8MApFREYtRi1BLUNMQVJJU1NFLUxFLUJJSEFOfDExfDN8MnwxNnxPS3x8MApFREYtRi1BLU1BUklFLUJFUk5BREVUVEUtVEhPTUFTfDN8NXw4fDE2fE9LfHwwCkVERi1GLUEtTklDT0xFLUFCQVJ8NXw2fDV8MTZ8T0t8fDAKRURGLUYtQS1QQVRSSUNJQS1NT1VTRUx8Mnw2fDd8MTV8T0t8fDAKRURGLUYtQS1MRUEtTEUtR0FSUkVDfDEyfDB8M3wxNXxPS3wxN3wwCkVERi1GLUEtTUFSVElORS1QVUVOVEVTfDZ8NXw0fDE1fE9LfHwwCkVERi1GLUEtTUFSSU5BLU1BS0FOWkF8MTF8M3wxfDE1fE9LfHwwCkVERi1GLUEtU0VWRVJJTkUtTEVDT1VGTEV8MTB8M3wyfDE1fE9LfHwwCkVERi1GLUEtUEVSTEUtTU9SUk9OSXwxMnwyfDB8MTR8T0t8MjN8MApFREYtRi1BLVRISU5JQkEtU0FNT1VSQXw5fDN8NHwxNnxQcm9maWwgU3RhdHNGb290IHBsdXMgcsOpY2VudCBxdWUgVjF8fDAKRURGLUYtQS1NQVJUSU5FLUNIQVBVWkVUfDR8NHw2fDE0fE9LfHwwCkVERi1GLUEtQ09OU1RBTkNFLVBJQ0FVRHwxMHwxfDV8MTZ8UHJvZmlsIFN0YXRzRm9vdCBwbHVzIHLDqWNlbnQgcXVlIFYxfDF8MApFREYtRi1BLU1BUklFLU5PRUxMRS1ERUdBUkRJTnw0fDR8NnwxNHxPS3x8MApFREYtRi1BLU1BUkxFTkUtRkFSUlVHSUF8NHw1fDV8MTR8T0t8fDAKRURGLUYtQS1MQVVSRU5DRS1SSUNIT1VYfDh8M3wzfDE0fE9LfHwwCkVERi1GLUEtTUVMSU5FLUdFUkFSRHwxMXwyfDF8MTR8T0t8fDAKRURGLUYtQS1LRUxMWS1HQUdPfDl8MnwzfDE0fFByb2ZpbCBTdGF0c0Zvb3QgcGx1cyByw6ljZW50IHF1ZSBWMXx8MApFREYtRi1BLU1ZTEVORS1DSEFVVk9UfDR8M3w2fDEzfE9LfHwwCkVERi1GLUEtQUxJQ0UtU09NQkFUSHwxMnwyfDF8MTV8UHJvZmlsIFN0YXRzRm9vdCBwbHVzIHLDqWNlbnQgcXVlIFYxfHwwCkVERi1GLUEtQVJNRUxMRS1CSU5BUkR8MXw0fDh8MTN8T0t8fDAKRURGLUYtQS1ERUxQSElORS1CTEFOQ3w5fDJ8MnwxM3xPS3wyfDAKRURGLUYtQS1GQUJJRU5ORS1NQVJUSU58NnwyfDR8MTJ8T0t8fDAKRURGLUYtQS1DSFJJU1RJTkUtR0FDSEVOT1R8Mnw0fDZ8MTJ8T0t8fDAKRURGLUYtQS1BTk5JRS1CQVRBSUxMRXwyfDJ8OHwxMnxPS3x8MApFREYtRi1BLUtFU1NZQS1CVVNTWXw5fDJ8MHwxMXxPS3x8MApFREYtRi1BLUNFQ0lMRS1NQVJHQVJJQXw0fDJ8NXwxMXxPS3x8MApFREYtRi1BLVJFTkVFLURFTEFIQVlFfDF8M3w3fDExfE9LfHwwCkVERi1GLUEtU0FORFJJTkUtQ09MT01CSUVSfDR8NHwzfDExfE9LfHwwCkVERi1GLUEtTUVMV0VFTi1OLURPTkdBTEF8MTB8MXwxfDEyfFByb2ZpbCBTdGF0c0Zvb3QgcGx1cyByw6ljZW50IHF1ZSBWMXx8MApFREYtRi1BLUFOTkFJRy1CVVRFTHw3fDJ8MXwxMHxPS3x8MApFREYtRi1BLUNIUklTVElORS1PUlNBVHw2fDF8M3wxMHxPS3x8MApFREYtRi1BLU1FTEFOSUUtQlJJQ0hFfDV8MnwzfDEwfE9LfHwwCkVERi1GLUEtSlVMSUUtU09ZRVJ8M3w2fDF8MTB8T0t8fDAKRURGLUYtQS1IQVdBLUNJU1NPS098OXwwfDB8OXxPS3x8MApFREYtRi1BLU5BT01JRS1GRUxMRVJ8NXwyfDJ8OXxPS3wxOXwwCkVERi1GLUEtTUFSSUUtQ0hBUkxPVFRFLUxFR0VSfDZ8MXwyfDl8T0t8fDAKRURGLUYtQS1ET01JTklRVUUtREVXVUxGfDF8Mnw2fDl8T0t8fDAKRURGLUYtQS1ORUxMWS1HVUlMQkVSVHw3fDB8Mnw5fE9LfHwwCkVERi1GLUEtQVNUUklELUxBR1JFVk9MfDV8MXwzfDl8T0t8fDAKRURGLUYtQS1FTE9ESUUtUkFNT1N8NXwwfDR8OXxPS3x8MApFREYtRi1BLUdFUkFMRElORS1IRVJQSEVMSU58NXwxfDN8OXxPS3x8MApFREYtRi1BLU1ZUklBTS1PTEVKTklLfDN8MHw1fDh8T0t8fDAKRURGLUYtQS1KVUxJRS1EVUZPVVJ8NHwxfDN8OHxPS3w0fDAKRURGLUYtQS1WRVJPTklRVUUtUk9ZfDJ8Mnw0fDh8T0t8fDAKRURGLUYtQS1TVEVQSEFOSUUtVFJPR05PTnw0fDJ8Mnw4fE9LfHwwCkVERi1GLUEtQ0xBVURJTkUtRElFfDF8Mnw1fDh8T0t8fDAKRURGLUYtQS1HSElTTEFJTkUtUk9ZRVItU09VRUZ8MXwyfDV8OHxPS3x8MApFREYtRi1BLUNPUklOTkUtRVJOT1VMVHwzfDF8M3w3fE9LfHwwCkVERi1GLUEtQU1JTkFUQS1ESUFMTE98M3wyfDJ8N3xPS3x8MApFREYtRi1BLU1BUlRJTkUtVEhJVk9MTEV8M3wyfDJ8N3xPS3x8MApFREYtRi1BLUVNRUxZTkUtTEFVUkVOVHw3fDB8MHw3fE9LfHwwCkVERi1GLUEtRUxJU0FCRVRILURFSkVBTnwxfDF8NXw3fE9LfHwwCkVERi1GLUEtSVNBQkVMTEUtR1VJVFRJfDZ8MHwxfDd8T0t8fDAKRURGLUYtQS1BVVJFTElFLUtBQ0l8NnwwfDF8N3xPS3x8MApFREYtRi1BLU5JQ09MRS1NQU5HQVN8MnwyfDN8N3xPS3x8MApFREYtRi1BLUZMT1JFTkNFLURFQ09PUE1BTnwyfDF8M3w2fE9LfHwwCkVERi1GLUEtQ0hSSVNUSU5FLVNDSEFST3wwfDN8M3w2fE9LfHwwCkVERi1GLUEtTklDT0xFLUNBUlJJRS1DQVVWRVR8MXwwfDV8NnxPS3x8MApFREYtRi1BLU1BUklFLUNIUklTVElORS1UU0NIT1BQfDF8MnwzfDZ8T0t8fDAKRURGLUYtQS1TQU5EUklORS1QQVNUT1JJQ0F8MHwxfDV8NnxPS3x8MApFREYtRi1BLUxPVS1CT0dBRVJUfDV8MHwxfDZ8T0t8fDAKRURGLUYtQS1MSU5EU0VZLVRIT01BU3wzfDF8Mnw2fE9LfHwwCkVERi1GLUEtTkFUSEFMSUUtRkxJU0FSfDR8MHwyfDZ8T0t8fDAKRURGLUYtQS1GUkFOQ09JU0UtUEFVTEhBQ3wyfDJ8Mnw2fE9LfHwwCkVERi1GLUEtTUFSSUUtS1VCSUFLfDN8MXwyfDZ8T0t8fDAKRURGLUYtQS1TRVZFUklORS1DUkVVWkVULUxBUExBTlRFU3w0fDJ8MHw2fE9LfHwwCkVERi1GLUEtVkVST05JUVVFLVBJQ0FSRHwzfDN8MHw2fE9LfHwwCkVERi1GLUEtTUFFVkEtQ0xFTUFST058NnwwfDB8NnxPS3x8MApFREYtRi1BLVNBTkRSSU5FLVJPVVFVRVR8MXwzfDJ8NnxPS3x8MApFREYtRi1BLVZFUk9OSVFVRS1TT1VSRElOfDN8MHwzfDZ8T0t8fDAKRURGLUYtQS1FTExFTi1QT0dFQU5UfDN8MXwyfDZ8T0t8fDAKRURGLUYtQS1TWUxWSUUtQ0FTU0FVQkEtVElDQVJaT1R8MnwxfDN8NnxPS3x8MApFREYtRi1BLUVMT0RJRS1KQUNRfDF8MnwzfDZ8T0t8fDAKRURGLUYtQS1JU0FCRUxMRS1GTEFNRU5UfDJ8MnwxfDV8T0t8fDAKRURGLUYtQS1NQVJUSU5FLUFVR1VFVHwyfDF8Mnw1fE9LfHwwCkVERi1GLUEtQ09SSU5ORS1CQVVERVRURXwwfDF8NHw1fE9LfHwwCkVERi1GLUEtQ0hBTlRBTC1QQU5JfDJ8MnwxfDV8T0t8fDAKRURGLUYtQS1NQVJUSU5FLUNPTUJFU3w0fDF8MHw1fE9LfHwwCkVERi1GLUEtQ0xBVURFLUJBU1NMRVJ8MXwxfDN8NXxPS3x8MApFREYtRi1BLUxBVVJJTkEtRkFaRVJ8M3wyfDB8NXxPS3x8MApFREYtRi1BLUtBUklOQS1MQUlaRXwyfDB8M3w1fE9LfHwwCkVERi1GLUEtSk9TSUFORS1NQVJDQVNTT0xJfDF8MnwyfDV8T0t8fDAKRURGLUYtQS1MQUVUSVRJQS1HUkFWSUVSfDN8MHwyfDV8T0t8fDAKRURGLUYtQS1OQVRBQ0hBLUJSQU5EWXwyfDF8Mnw1fE9LfHwwCkVERi1GLUEtS0FSSU1BLUJFTkFNRVVSLVRBSUVCfDN8MXwxfDV8T0t8fDAKRURGLUYtQS1MSUxBUy1UUkFJS0lBfDR8MXwwfDV8T0t8fDAKRURGLUYtQS1LRUxMWS1HQURFQXw0fDF8MHw1fE9LfHwwCkVERi1GLUEtRE9NSU5JUVVFLVRFREVTQ0hJfDB8MHw1fDV8T0t8fDAKRURGLUYtQS1DT0xFVFRFLUdVWUFSRHwxfDJ8Mnw1fE9LfHwwCkVERi1GLUEtTUlDSEVMRS1CQVJJU0VUfDF8MHw0fDV8T0t8fDAKRURGLUYtQS1SRUdJTkUtUE9VUlZFVVh8MnwwfDN8NXxPS3x8MApFREYtRi1BLUpPU0lBTkUtTEVCT1VURVR8MHwwfDR8NHxPS3x8MApFREYtRi1BLU5BVEhBTElFLUNBVkFMSUVSfDF8MXwyfDR8T0t8fDAKRURGLUYtQS1EQU5JRUxMRS1WQVRJTnwxfDF8Mnw0fE9LfHwwCkVERi1GLUEtQVJMRVRURS1CSUhMRVJ8MnwxfDF8NHxPS3x8MApFREYtRi1BLVNPTEVORS1EVVJBTkR8MnwyfDB8NHxPS3wxfDAKRURGLUYtQS1DQVRIRVJJTkUtTUVSQ0FESUVSfDJ8MXwxfDR8T0t8fDAKRURGLUYtQS1MRUEtS0hFTElGSXwzfDB8MXw0fE9LfHwwCkVERi1GLUEtU1lMVklFLVJPVVNTRUFVfDB8MXwzfDR8T0t8fDAKRURGLUYtQS1DT1JJTk5FLVNVQ0hPRE9MU0tJfDB8MnwyfDR8T0t8fDAKRURGLUYtQS1OQVRIQUxJRS1DQVJBREVDfDB8MXwzfDR8T0t8fDAKRURGLUYtQS1BTElYLUZBWUUtQ0hFTExBTEl8M3wxfDB8NHxPS3wxMHwwCkVERi1GLUEtSlVMSUEtREFOWXwwfDJ8Mnw0fE9LfHwwCkVERi1GLUEtSU5HUklELUJPWUVMRElFVXwzfDB8MXw0fE9LfHwwCkVERi1GLUEtTEFFVElUSUEtUEhJTElQUEV8M3wwfDF8NHxPS3x8MApFREYtRi1BLUlORVMtSkFVUkVOQXwyfDF8MXw0fE9LfHwwCkVERi1GLUEtQ0FORElDRS1QUkVWT1NUfDJ8MXwxfDR8T0t8fDAKRURGLUYtQS1TQU5EUklORS1URVJSQVNTRXwzfDF8MHw0fE9LfHwwCkVERi1GLUEtVkVST05JUVVFLUJFUk5BUkR8MHwyfDJ8NHxPS3x8MApFREYtRi1BLUFVREUtQkFOQVNJQUt8MXwwfDN8NHxPS3x8MApFREYtRi1BLURPTUlOSVFVRS1QUk9WT1NUfDB8M3wxfDR8T0t8fDAKRURGLUYtQS1DTEFSSVNTRS1TQ0hFUlJFUnwwfDF8MnwzfE9LfHwwCkVERi1GLUEtSk9DRUxZTkUtSEVOUll8MXwyfDB8M3xPS3x8MApFREYtRi1BLUlTQUJFTExFLUdJQkFTU0lFUnwxfDB8MnwzfE9LfHwwCkVERi1GLUEtSk9DRUxZTkUtUkFUSUdOSUVSfDF8MnwwfDN8T0t8fDAKRURGLUYtQS1NQVJJRS1TVEVMTEEtRC1BTkRSRUF8MXwxfDF8M3xPS3x8MApFREYtRi1BLUJFVFRZLUdPUkVUfDF8MHwyfDN8T0t8fDAKRURGLUYtQS1BTkFFTEUtTEUtTU9HVUVERUN8NHwwfDF8NXxQcm9maWwgU3RhdHNGb290IHBsdXMgcsOpY2VudCBxdWUgVjF8fDAKRURGLUYtQS1KVUxJRS1USElCQVVEfDJ8MXwwfDN8T0t8fDAKRURGLUYtQS1LQVJJTkUtU0VMQk9OTkV8MHwxfDJ8M3xPS3x8MApFREYtRi1BLUVWRUxZTkUtR09MQVdTS0l8MnwwfDF8M3xPS3x8MApFREYtRi1BLU1BUllTRS1MRVNJRVVSfDF8MXwxfDN8T0t8fDAKRURGLUYtQS1DTEFJUkUtTU9SRUx8MnwwfDF8M3xPS3x8MApFREYtRi1BLUpVTElFLURFQkVWRVJ8M3wwfDB8M3xPS3x8MApFREYtRi1BLUxZRElFLURFVkFVRHwyfDB8MXwzfE9LfHwwCkVERi1GLUEtRU1NQU5VRUxMRS1EQUxQT1N8MnwwfDF8M3xPS3x8MApFREYtRi1BLVZJUkdJTklFLURFU1NBTExFfDF8MXwxfDN8T0t8fDAKRURGLUYtQS1BTEVYQU5EUkEtR1VJTkV8MnwxfDB8M3xPS3x8MApFREYtRi1BLUVNSUxJRS1ET1MtU0FOVE9TfDJ8MXwwfDN8T0t8fDAKRURGLUYtQS1TVEVQSEFOSUUtTU9SRUx8M3wwfDB8M3xPS3x8MApFREYtRi1BLVNJR0EtVEFORElBfDN8MHwwfDN8T0t8fDAKRURGLUYtQS1TRVZFUklORS1HT1VMT0lTfDF8MnwwfDN8T0t8fDAKRURGLUYtQS1OQURJTkUtSkFDUVVFTU9ORHwwfDB8MnwyfE9LfHwwCkVERi1GLUEtU09QSElFLURBTkVMfDB8MXwxfDJ8T0t8fDAKRURGLUYtQS1GQUJJRU5ORS1CRU5URUpBQ3wxfDF8MHwyfE9LfHwwCkVERi1GLUEtQUdORVMtU0FWSU5JfDB8MXwxfDJ8T0t8fDAKRURGLUYtQS1NQVJJRS1KT1NFLVZBTkRFUkxFTk5FfDB8MHwyfDJ8T0t8fDAKRURGLUYtQS1WSVJHSU5JRS1SVUdHSUVSSS1EUlVFTHwwfDF8MXwyfE9LfHwwCkVERi1GLUEtRkFCSUVOTkUtQkVSVEhPVVR8MHwxfDF8MnxPS3x8MApFREYtRi1BLUNIQU5UQUwtUFJPVVZFVVJ8MHwxfDF8MnxPS3x8MApFREYtRi1BLUlTQUJFTExFLU1BTlVDQ0l8MHwwfDJ8MnxPS3x8MApFREYtRi1BLU1BUkdBVVgtTEUtTU9VRUx8MXwwfDF8MnxPS3x8MApFREYtRi1BLUdSQUNFLUtBWkFESS1OVEFNQldFfDF8MHwxfDJ8T0t8fDAKRURGLUYtQS1KQURFLUxFLUdVSUxMWXwxfDB8MXwyfE9LfHwwCkVERi1GLUEtV0FTU0EtU0FOR0FSRXwyfDF8MHwzfFByb2ZpbCBTdGF0c0Zvb3QgcGx1cyByw6ljZW50IHF1ZSBWMXx8MApFREYtRi1BLUNJTkRZLUNBUFVUT3wxfDB8MXwyfE9LfHwwCkVERi1GLUEtTUFSSU5FLURBRkVVUnwyfDB8MHwyfE9LfHwwCkVERi1GLUEtU1RFUEhBTklFLU1PUkVBVXwyfDB8MHwyfE9LfHwwCkVERi1GLUEtRkFVU1RJTkUtUk9CRVJUfDB8MXwxfDJ8T0t8fDAKRURGLUYtQS1JU0FCRUxMRS1HQUlMTEFSRHwwfDB8MnwyfE9LfHwwCkVERi1GLUEtUkFDSEVMRS1WSUxBUklOSE98MXwxfDB8MnxPS3x8MApFREYtRi1BLUJFQVRSSUNFLUJBU1NFfDJ8MHwwfDJ8T0t8fDAKRURGLUYtQS1DT1JJTk5FLUtFUk9VUkVEQU58MXwwfDF8MnxPS3x8MApFREYtRi1BLUFOTkUtR09VRVpFTHwyfDB8MHwyfE9LfHwwCkVERi1GLUEtRkxPUkVOQ0UtRlJFWUVSTVVUSHwwfDF8MXwyfE9LfHwwCkVERi1GLUEtSVNBQkVMTEUtTEUtREVOTUFUfDB8MHwyfDJ8T0t8fDAKRURGLUYtQS1TWUxWSUUtVlVJTExBVU1FfDF8MHwxfDJ8T0t8fDAKRURGLUYtQS1NRUxJU1NBLVBMQVpBfDJ8MHwwfDJ8T0t8fDAKRURGLUYtQS1WSVJHSU5JRS1GQUlTQU5ESUVSfDF8MHwxfDJ8T0t8fDAKRURGLUYtQS1ET1JPVEhFRS1WQVJMRVR8MXwwfDF8MnxPS3x8MApFREYtRi1BLU5PTk5BLURFQk9OTkV8MXwwfDF8MnxPS3x8MApFREYtRi1BLU1BUklFLUFOVE9JTkVUVEUtQklMT058MXwxfDB8MnxPS3x8MApFREYtRi1BLVNBTkRSQS1IT0xaSEFVU0VSfDF8MHwxfDJ8T0t8fDAKRURGLUYtQS1BTklUQS1ET1VBUkR8MXwwfDF8MnxPS3x8MApFREYtRi1BLURPTUlOSVFVRS1TQ0hBUk98MHwwfDJ8MnxPS3x8MApFREYtRi1BLU1BUklFLUxBVVJFLU1PTlRBVVJJT0x8MXwxfDB8MnxPS3x8MApFREYtRi1BLUNIQU5UQUwtU0VSUkV8MHwyfDB8MnxPS3x8MApFREYtRi1BLUpPU0lBTkUtTUFSSUNIQUx8MHwwfDJ8MnxPS3x8MApFREYtRi1BLUNBUklORS1QSU1PVU5FVHwxfDB8MXwyfE9LfHwwCkVERi1GLUEtU1lMVklFLURJWklFUnwwfDF8MHwxfE9LfHwwCkVERi1GLUEtSVNBQkVMTEUtQkFVRFVJTnwwfDF8MHwxfE9LfHwwCkVERi1GLUEtQU5HRUxFLU1FSXwwfDF8MHwxfE9LfHwwCkVERi1GLUEtS0FSSU5FLUxFVll8MXwwfDB8MXxPS3x8MApFREYtRi1BLURPTUlOSVFVRS1DSEFSUEVORVR8MHwxfDB8MXxPS3x8MApFREYtRi1BLVNZTFZJRS1QSU5URXwxfDB8MHwxfE9LfHwwCkVERi1GLUEtSk9DRUxZTkUtTUlPTnwxfDB8MHwxfE9LfHwwCkVERi1GLUEtTkFUSEFMSUUtQk9VTEFSRHwxfDB8MHwxfE9LfHwwCkVERi1GLUEtU09QSElFLVJVREFOVHwxfDB8MHwxfE9LfHwwCkVERi1GLUEtU1lMVklFLVZBUklOfDB8MXwwfDF8T0t8fDAKRURGLUYtQS1NWVJJQU0tQVNTRU5BVHwwfDB8MXwxfE9LfHwwCkVERi1GLUEtQ09SSU5ORS1QVVlFVHwwfDB8MXwxfE9LfHwwCkVERi1GLUEtTUFSSUUtQ0hSSVNUSU5FLUJPVVJHRU9JU3wwfDB8MXwxfE9LfHwwCkVERi1GLUEtSVNBQkVMTEUtTEUtRFV8MXwwfDB8MXxPS3x8MApFREYtRi1BLVRIRUEtR1JFQk9WQUx8MXwwfDB8MXxPS3x8MApFREYtRi1BLU1ZTEVORS1DSEFWQVN8MXwwfDB8MXxPS3x8MApFREYtRi1BLU1BUlRJTkUtUEVUSVR8MHwxfDB8MXxPS3x8MApFREYtRi1BLU1BVEhJTERFLUJPVVJESUVVfDB8MXwwfDF8T0t8fDAKRURGLUYtQS1ISUxMQVJZLURJQVp8MXwwfDB8MXxPS3w2fDAKRURGLUYtQS1BTkFJUy1FQkFZSUxJTnwxfDB8MHwxfE9LfHwwCkVERi1GLUEtTE9VTkEtUklCQURFSVJBfDF8MHwwfDF8T0t8fDAKRURGLUYtQS1OQURKTUEtQUxJLU5BREpJTXwwfDB8MXwxfE9LfHwwCkVERi1GLUEtQ0hBUkxPVFRFLUxPUkdFUkV8MXwwfDB8MXxPS3x8MApFREYtRi1BLU5BVEhBTElFLUdJR09OfDB8MHwxfDF8T0t8fDAKRURGLUYtQS1GRVJOQU5EQS1EQS1NT1RBLUZFUlJFSVJBfDB8MXwwfDF8T0t8fDAKRURGLUYtQS1HRVJBTERJTkUtVklHVUlFfDB8MHwxfDF8T0t8fDAKRURGLUYtQS1JU0FCRUxMRS1QRVRJVHwxfDB8MHwxfE9LfHwwCkVERi1GLUEtS0FSSU5FLURST1NUfDF8MHwwfDF8T0t8fDAKRURGLUYtQS1OSUNPTEUtVFVSQ09UfDF8MHwwfDF8T0t8fDAKRURGLUYtQS1GTE9SRU5DRS1QT0xTSU5FTExJfDB8MHwxfDF8T0t8fDAKRURGLUYtQS1NQVJJRS1GUkFOQ0UtQ09VUlRPSVN8MHwwfDF8MXxPS3x8MApFREYtRi1BLUFOTkUtTEFVUkUtUEVSUk9UfDF8MHwwfDF8T0t8fDAKRURGLUYtQS1NQVJJRS1KT0VMTEUtS1JBTU98MXwwfDB8MXxPS3x8MApFREYtRi1BLUxFQS1SVUJJT3wxfDB8MHwxfE9LfHwwCkVERi1GLUEtTUVMQU5JRS1MRUpFVU5FfDB8MHwxfDF8T0t8fDAKRURGLUYtQS1TT05JQS1IQVpJUkFKfDB8MHwxfDF8T0t8fDAKRURGLUYtQS1WQUxFUklFLUJPVVJOQVR8MHwwfDF8MXxPS3x8MApFREYtRi1BLVNPUkFZQS1CRUxLQURJfDF8MHwwfDF8T0t8fDAKRURGLUYtQS1MQUVUSVRJQS1TVFJJQklDSy1CVVJDS0VMfDB8MXwwfDF8T0t8fDAKRURGLUYtQS1JTkVTLURIQU9VfDF8MHwwfDF8T0t8fDAKRURGLUYtQS1DT1JBTElFLURVQ0hFUnwwfDB8MXwxfE9LfHwwCkVERi1GLUEtRU1JTElFLU1BWk9VRXwxfDB8MHwxfE9LfHwwCkVERi1GLUEtRU1JTElFLUwtSFVJTExJRVJ8MXwwfDB8MXxPS3x8MApFREYtRi1BLVBBVUxJTkUtQ1JBTU1FUnwxfDB8MHwxfE9LfHwwCkVERi1GLUEtSlVMSUUtTU9SRUx8MXwwfDB8MXxPS3x8MApFREYtRi1BLUxZRElFLVBFUlJBVURFQVV8MXwwfDB8MXxPS3x8MApFREYtRi1BLURFTFBISU5FLUJPVUxMRVQtR0lHQVJFTHwwfDB8MXwxfE9LfHwwCkVERi1GLUEtTUFSWVNFLUNBU0VMTEF8MHwwfDF8MXxPS3x8MApFREYtRi1BLU5JQ09MRS1SRVZFVHwwfDB8MXwxfE9LfHwwCkVERi1GLUEtQ09MRVRURS1NQVRISUFOfDB8MHwxfDF8T0t8fDAKRURGLUYtQS1JU0FCRUxMRS1GTEVVUkFOQ0V8MHwxfDB8MXxPS3x8MApFREYtRi1BLVNZTFZJRS1CTE9UfDB8MHwxfDF8T0t8fDAKRURGLUYtQS1OSUNPTEUtR1JPU0xBTkR8MHwxfDB8MXxPS3x8MApFREYtRi1BLU1PTklRVUUtR0VISU58MHwwfDF8MXxPS3x8MApFREYtRi1BLU1JQ0hFTEUtQ0hSSVNUT1BIRXwwfDB8MXwxfE9LfHwwCkVERi1GLUEtUk9TRS1MQVZBVUR8MXwwfDB8MXxPS3x8MApFREYtRi1BLVNURVBIQU5JRS1NT1JJQ0VBVS1NT1JFQVV8MHwwfDF8MXxPS3x8MApFREYtRi1BLU1BUklFLUFSTkFMfDF8MHwwfDF8T0t8fDAKRURGLUYtQS1NQVJJRS1DTEFJUkUtQ0FST04tSEFSQU5UfDF8MHwwfDF8T0t8fDAKRURGLUYtQS1NSUNIRUxFLU1PTklFUnwxfDB8MHwxfE9LfHwwCkVERi1GLUEtQU5EUkVFLUJFTkFEREl8MHwxfDB8MXxPS3x8MA==','base64'),'UTF8'));

drop function if exists public.import_france_a_fem_v2_blob(text);


-- === MIGRATION_V1.1.26_ESPOIRS_RELATIONAL.sql ============================================================

-- Bleus 3000 V1.1.26 — structure persistante Espoirs / matchs / officiels
-- Les données V4 du classeur fourni ont été importées sur le projet Supabase Bleus 3000.

update public.selection_teams s
set team_tag_id=t.id, updated_at=now()
from public.tags t
where s.code='FRA-ESP-M' and t.slug='espoirs';

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select t.id,'selection',s.id,'membership',t.created_by
from public.tags t join public.selection_teams s on s.code='FRA-ESP-M'
where t.slug='espoirs'
on conflict do nothing;

insert into public.tags(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,text_color,border_color,gradient_angle,border_radius,border_width,is_active)
values('general','tag','GENERAL','∑',array['TOTAL','TOUTES SELECTIONS','TOUTES SÉLECTIONS'],'gradient','#082654','#2563eb','#ffffff','#082654',135,10,1,true)
on conflict(slug) do nothing;

alter table public.matches
  add column if not exists selection_team_id uuid references public.selection_teams(id) on delete set null,
  add column if not exists phase text,
  add column if not exists spectators integer,
  add column if not exists lineup_status text,
  add column if not exists source_calendar_url text,
  add column if not exists source_detail_url text;
create index if not exists matches_selection_team_idx on public.matches(selection_team_id);

alter table public.match_appearances
  add column if not exists shirt_number integer,
  add column if not exists squad_status text,
  add column if not exists source_composition_url text,
  add column if not exists source_number_url text,
  add column if not exists verification text;

alter table public.personnel
  add column if not exists external_ids jsonb not null default '{}'::jsonb,
  add column if not exists keywords text[] not null default '{}'::text[],
  add column if not exists notes_short text;
create index if not exists personnel_display_name_idx on public.personnel(lower(display_name));

create table if not exists public.match_goal_events(
  id uuid primary key default gen_random_uuid(),
  source_goal_id text unique,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  scorer_name text not null,
  team_name text,
  minute_text text,
  score_after text,
  source_url text,
  created_at timestamptz not null default now()
);
alter table public.match_goal_events enable row level security;
drop policy if exists match_goal_events_read on public.match_goal_events;
drop policy if exists match_goal_events_write on public.match_goal_events;
create policy match_goal_events_read on public.match_goal_events for select to anon,authenticated using(true);
create policy match_goal_events_write on public.match_goal_events for all to authenticated using(public.can_edit()) with check(public.can_edit());
create index if not exists match_goal_events_match_idx on public.match_goal_events(match_id);
create index if not exists match_goal_events_player_idx on public.match_goal_events(player_id);

create or replace view public.espoirs_personnel_stats with(security_invoker=true) as
with coach_stats as (
  select p.id person_id,count(m.id)::int coached_matches,
    count(m.id) filter(where m.france_score>m.opponent_score)::int coached_wins,
    count(m.id) filter(where m.france_score=m.opponent_score)::int coached_draws,
    count(m.id) filter(where m.france_score<m.opponent_score)::int coached_losses
  from public.personnel p
  left join public.matches m on m.coach_id=p.id and m.selection_team_id=(select id from public.selection_teams where code='FRA-ESP-M')
  group by p.id
), official_stats as (
  select p.id person_id,
    count(distinct mo.match_id) filter(where m.id is not null)::int official_matches,
    array_remove(array_agg(distinct mo.role) filter(where m.id is not null),null) official_roles
  from public.personnel p
  left join public.match_officials mo on mo.person_id=p.id
  left join public.matches m on m.id=mo.match_id and m.selection_team_id=(select id from public.selection_teams where code='FRA-ESP-M')
  group by p.id
)
select p.id,p.display_name,p.nationality,p.person_type,p.photo_url,p.organization,p.active,p.external_ids,p.keywords,p.notes_short,
  coalesce(c.coached_matches,0) coached_matches,coalesce(c.coached_wins,0) coached_wins,coalesce(c.coached_draws,0) coached_draws,coalesce(c.coached_losses,0) coached_losses,
  coalesce(o.official_matches,0) official_matches,coalesce(o.official_roles,'{}'::text[]) official_roles
from public.personnel p left join coach_stats c on c.person_id=p.id left join official_stats o on o.person_id=p.id
where coalesce(c.coached_matches,0)>0 or coalesce(o.official_matches,0)>0 or (p.external_ids ? 'espoirs_source');
grant select on public.espoirs_personnel_stats to anon,authenticated;


-- === MIGRATION_V1.1.26_ESPOIRS_RELATIONNELS.sql ============================================================

-- Bleus 3000 V1.1.26 — structure du référentiel France Espoirs / U21 Masculin
-- Les données V4 ont été importées directement dans Supabase depuis le classeur source.

update public.selection_teams s
set team_tag_id=t.id, updated_at=now()
from public.tags t
where s.code='FRA-ESP-M' and t.slug='espoirs';

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select t.id,'selection',s.id,'membership',t.created_by
from public.tags t join public.selection_teams s on s.code='FRA-ESP-M'
where t.slug='espoirs'
on conflict do nothing;

insert into public.tags(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,text_color,border_color,gradient_angle,border_radius,border_width,is_active)
values('general','tag','GENERAL','∑',array['TOTAL','TOUTES SELECTIONS','TOUTES SÉLECTIONS'],'gradient','#082654','#2563eb','#ffffff','#082654',135,10,1,true)
on conflict (slug) do nothing;

alter table public.matches
  add column if not exists selection_team_id uuid references public.selection_teams(id) on delete set null,
  add column if not exists phase text,
  add column if not exists spectators integer,
  add column if not exists lineup_status text,
  add column if not exists source_calendar_url text,
  add column if not exists source_detail_url text;
create index if not exists matches_selection_team_idx on public.matches(selection_team_id);

alter table public.match_appearances
  add column if not exists shirt_number integer,
  add column if not exists squad_status text,
  add column if not exists source_composition_url text,
  add column if not exists source_number_url text,
  add column if not exists verification text;

alter table public.personnel
  add column if not exists external_ids jsonb not null default '{}'::jsonb,
  add column if not exists keywords text[] not null default '{}'::text[],
  add column if not exists notes_short text;

create table if not exists public.match_goal_events (
  id uuid primary key default gen_random_uuid(),
  source_goal_id text unique,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  scorer_name text not null,
  team_name text,
  minute_text text,
  score_after text,
  source_url text,
  created_at timestamptz not null default now()
);


-- === MIGRATION_V1.1.29_U17_MASCULIN.sql ============================================================

-- Bleus 3000 V1.1.29 — Référentiel France U17 Masculin (2004–2026)
-- Source utilisateur : Bleus3000_U17_Masculine_2004_2026_V3_STATS.xlsx
-- 376 joueurs. Les valeurs statistiques absentes dans la source restent NULL : aucun chiffre n'est inventé.
-- IMPORTANT : l'import réutilise d'abord le joueur global déjà connu (nom normalisé + sexe,
-- avec préférence à la date de naissance). Il ne crée donc pas une seconde tuile pour un joueur déjà présent
-- dans une autre sélection/tag.

insert into public.tags(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,text_color,border_color,gradient_angle,border_radius,border_width,is_active)
values('general','tag','GENERAL','∑',array['TOTAL','TOUTES SELECTIONS','TOUTES SÉLECTIONS'],'gradient','#082654','#2563eb','#ffffff','#082654',135,10,1,true)
on conflict(slug) do nothing;

-- Le tag U17 Masculin existe déjà : on le conserve tel quel et on le relie à FRA-U17-M.
update public.selection_teams s set team_tag_id=t.id,updated_at=now()
from public.tags t where s.code='FRA-U17-M' and t.slug='u17';
insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select t.id,'selection',s.id,'membership',t.created_by from public.tags t join public.selection_teams s on s.code='FRA-U17-M'
where t.slug='u17' on conflict do nothing;

create or replace function pg_temp.b3k_norm(v text) returns text language sql immutable as $$
  select regexp_replace(translate(lower(coalesce(v,'')),
    'àáâäãåçèéêëìíîïñòóôöõùúûüýÿœæ’''-.',
    'aaaaaaceeeeiiiinooooouuuuyyoea    '), '[^a-z0-9]+','','g')
$$;

create temp table b3k_u17_import(
  source_id text, display_name text, positions text, birth_date date, first_year int, last_year int,
  selections int, goals int, first_selection_date date, source_name text, source_status text,
  source_url text, keywords_text text
) on commit drop;

insert into b3k_u17_import values
('U17P-0001','Abdallah Yaisien','Milieu','1994-04-23',2010,2010,18,12,'2010-08-27','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Abdallah Yaisien; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0241','Abdelhamid El Kaoutari','Défenseur',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Abdelhamid El Kaoutari; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0002','Abdoul Camara','Attaquant','1990-02-20',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Abdoul Camara; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0003','Abdoulaye Camara','Milieu','2008-09-28',2025,2025,21,1,'2024-09-18','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Abdoulaye Camara; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0363','Abdoulaye Dabo','Milieu',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Abdoulaye Dabo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0004','Abdoulaye Doucouré','Milieu','1993-01-01',2010,2010,19,1,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Abdoulaye Doucouré; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0005','Abdoulaye Keita','Gardien','1990-08-19',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Abdoulaye Keita; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0006','Adam N''Kusu','Milieu / Attaquant','1994-01-29',2010,2010,9,0,'2010-10-27','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Adam N''Kusu; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0007','Adama Baradji','Attaquant','2007-10-10',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Adama Baradji; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0293','Adama Diakité','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Adama Diakité; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0250','Adel Taarabt','Milieu',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Adel Taarabt; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0365','Adil Aouchiche',NULL,NULL,2018,2018,25,15,'2018-10-25','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Adil Aouchiche; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2018'),
('U17P-0008','Adrien Tamèze','Milieu','1994-02-04',2010,2010,21,0,'2010-08-24','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Adrien Tamèze; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0009','Ahmed Yahiaoui','Milieu',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ahmed Yahiaoui; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0275','Alassane També','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Alassane També; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0312','Alban Lafont','Gardien',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Alban Lafont; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0010','Alec Georgen','Défenseur',NULL,2014,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Alec Georgen; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0268','Alexandre Coeff','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Alexandre Coeff; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0301','Alexandre Lacazette','Attaquant',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Alexandre Lacazette; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0011','Alexi Koum Mbondo','Attaquant','2006-02-05',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Alexi Koum Mbondo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0340','Alexis Claude-Maurice','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Alexis Claude-Maurice; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0012','Alexis Kabamba','Milieu','2005-10-15',2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Alexis Kabamba; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0013','Alexis Moreira','Attaquant','1994-07-28',2010,2010,4,0,'2010-08-24','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Alexis Moreira; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0014','Alfred N''Diaye','Milieu','1990-03-06',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Alfred N''Diaye; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0227','Allan Saint-Maximin','Attaquant',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Allan Saint-Maximin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0015','Alphonse Areola','Gardien','1993-02-27',2010,2010,10,0,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Alphonse Areola; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0016','Alvin Arrondel','Défenseur','1993-11-11',2010,2010,11,0,'2009-10-19','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Alvin Arrondel; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0017','Amidou Doumbouya','Milieu','2007-08-05',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Amidou Doumbouya; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0208','Amine Belahmeur','Milieu',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'Amine Belahmeur; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0375','Amine Gouiri',NULL,NULL,NULL,NULL,15,20,NULL,'Transfermarkt','Source secondaire — meilleur buteur','https://www.transfermarkt.fr/frankreich-u17/toptorschuetzen/verein/10831','Amine Gouiri; France U17; U17 masculine; Bleuets; équipe de France jeunes; '),
('U17P-0284','André Auras','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'André Auras; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0018','Anthony Koura','Attaquant','1993-05-06',2010,2010,13,5,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Anthony Koura; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0376','Anthony Martial',NULL,NULL,NULL,NULL,13,10,NULL,'Transfermarkt','Source secondaire — meilleur buteur','https://www.transfermarkt.fr/frankreich-u17/toptorschuetzen/verein/10831','Anthony Martial; France U17; U17 masculine; Bleuets; équipe de France jeunes; '),
('U17P-0261','Anthony Mfa Mezui','Gardien',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Anthony Mfa Mezui; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0019','Aristote Lusinga','Défenseur','1990-02-20',2006,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Aristote Lusinga; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0243','Armand Traoré','Défenseur',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Armand Traoré; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0220','Arnaud Lusamba','Milieu',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Arnaud Lusamba; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0274','Arnaud Souquet','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Arnaud Souquet; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0020','Arone Gadou','Attaquant','2009-01-19',2026,2026,9,7,'2025-10-08','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Arone Gadou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0338','Aslam Saindou Ahamada','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Aslam Saindou Ahamada; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0270','Atila Turan','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Atila Turan; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0334','Aurélien Nguiamba','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Aurélien Nguiamba; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0357','Aurélien Tchouaméni','Milieu',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Aurélien Tchouaméni; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0021','Axel Decrenisse','Gardien','2009-01-25',2026,2026,7,0,'2025-10-08','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Axel Decrenisse; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0022','Axel Gueguin','Attaquant','2005-03-24',2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Axel Gueguin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0023','Ayman Aiki','Attaquant',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ayman Aiki; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0024','Aymen Amaaouch','Attaquant','2009-09-30',2026,2026,14,3,NULL,'Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Aymen Amaaouch; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0025','Aymen Sadi','Défenseur','2006-04-10',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Aymen Sadi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0026','Badis Lebbihi','Défenseur','1990-03-14',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Badis Lebbihi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0027','Bastien Meupiyou','Défenseur','2006-03-19',2023,2023,22,3,'2022-09-28','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Bastien Meupiyou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0242','Bastién Pergaud','Défenseur',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Bastién Pergaud; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0028','Believe Munongo','Milieu','2009-11-23',2025,2026,24,1,'2025-02-18','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Believe Munongo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2026'),
('U17P-0303','Benjamin Guibert','Gardien',NULL,2010,2010,NULL,NULL,NULL,NULL,'À compléter',NULL,'Benjamin Guibert; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010'),
('U17P-0252','Benjamin Leclerc','Milieu',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Benjamin Leclerc; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0029','Benjamin Mendy','Défenseur','1994-07-17',2010,2010,17,1,'2010-08-24','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Benjamin Mendy; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0352','Benoît Badiashile','Défenseur',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Benoît Badiashile; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0030','Benoît Costil','Gardien','1987-07-03',2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Benoît Costil; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0031','Bilal Boutobba','Milieu / Attaquant','1998-08-29',2015,2015,15,2,NULL,'FFF','Vérifié FFF','https://www.fff.fr/equipe-nationale/joueur/9399-boutobba-bilal/fiche.html','Bilal Boutobba; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0223','Bilali Doucouré','Milieu',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Bilali Doucouré; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0032','Billel Omrani','Attaquant','1993-06-02',2010,2010,11,4,'2009-10-17','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Billel Omrani; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0333','Boubacar Kamara','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Boubacar Kamara; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0033','Bradley Danger','Défenseur',NULL,2014,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Bradley Danger; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0370','Brandon Soppy',NULL,NULL,2017,2017,22,1,'2017-11-02','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Brandon Soppy; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0344','Bryan Mbeumo','Attaquant',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Bryan Mbeumo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0283','Cheick Doukouré','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Cheick Doukouré; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0372','Chrislain Matsima',NULL,NULL,2018,2018,21,0,'2018-09-25','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Chrislain Matsima; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2018'),
('U17P-0034','Christ Batola','Attaquant','2009-06-03',2026,2026,20,4,'2025-05-19','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Christ Batola; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0035','Christ-Emmanuel Faitout Maouassa','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Christ-Emmanuel Faitout Maouassa; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0036','Christian Mawissa Elebi','Défenseur',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Christian Mawissa Elebi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0281','Christopher Missilou','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Christopher Missilou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0286','Clément Grenier','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Clément Grenier; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0218','Corentin Jacob','Gardien',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Corentin Jacob; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0037','Damien Le Tallec','Attaquant / Milieu','1990-04-19',2006,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Damien Le Tallec; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0320','Dan-Axel Zagadou','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Dan-Axel Zagadou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0038','Daouda Traoré','Milieu','2006-07-22',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Daouda Traoré; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0266','Darnel Situ','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Darnel Situ; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0039','David Boly','Défenseur','2009-01-22',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'David Boly; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0230','David Faupala','Attaquant',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'David Faupala; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0040','Dayot Upamecano','Défenseur',NULL,2015,2015,12,0,NULL,'FFF','Vérifié FFF','https://www.fff.fr/equipe-nationale/joueur/9009-upamecano-dayot/fiche.html','Dayot Upamecano; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0221','Denis Will Poha','Milieu',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Denis Will Poha; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0273','Dennis Appiah','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Dennis Appiah; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0374','Dilane Bakwa',NULL,NULL,2017,2017,20,2,'2017-11-02','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Dilane Bakwa; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0245','Distel Zola','Milieu',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Distel Zola; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0041','Djibril Coulibaly','Milieu','2008-11-18',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Djibril Coulibaly; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0042','Djylian N''Guessan','Attaquant','2008-08-30',2025,2025,11,11,NULL,'Transfermarkt','Source secondaire — meilleur buteur','https://www.transfermarkt.fr/frankreich-u17/toptorschuetzen/verein/10831','Djylian N''Guessan; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0258','Dominique Malonga','Attaquant',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Dominique Malonga; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0043','Dylan Deligny','Milieu','1993-08-05',2010,2010,18,1,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Dylan Deligny; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0044','Désiré Doué','Milieu','2005-06-03',2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Désiré Doué; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0045','El Chadaille Bitshiabu','Défenseur',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'El Chadaille Bitshiabu; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0046','Eli Kroupi','Milieu','2006-06-23',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Eli Kroupi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0047','Elikya Legros','Défenseur','2008-06-06',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Elikya Legros; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0048','Eliott Sorin','Milieu','1993-03-01',2010,2010,19,0,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Eliott Sorin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0049','Elyaz Zidane','Défenseur',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Elyaz Zidane; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0050','Emmanuel Mbemba','Défenseur','2008-03-20',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Emmanuel Mbemba; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0219','Enock Kwateng','Défenseur',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Enock Kwateng; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0369','Enzo Millot',NULL,NULL,2018,2018,23,3,'2018-09-25','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Enzo Millot; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2018'),
('U17P-0288','Enzo Reale','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Enzo Reale; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0346','Ervin Taha','Attaquant',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ervin Taha; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0326','Faitout Maouassa','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Faitout Maouassa; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0051','Fodé Sylla','Milieu','2006-04-16',2023,2023,24,1,'2022-09-28','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Fodé Sylla; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0052','Formose Mendy','Défenseur','1993-10-08',2010,2010,9,0,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Formose Mendy; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0280','Francis Coquelin','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Francis Coquelin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0053','Franck Songo''o','Milieu',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Franck Songo''o; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0253','Frédéric Bulot','Attaquant',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Frédéric Bulot; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0054','Frédéric Duplus','Défenseur','1990-04-07',2006,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Frédéric Duplus; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0055','Félix Bienck','Défenseur','2007-05-26',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Félix Bienck; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0256','Gabriel Obertan','Attaquant',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Gabriel Obertan; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0292','Gaël Kakuta','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Gaël Kakuta; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0295','Gaël N''Lundulu','Attaquant',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Gaël N''Lundulu; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0314','Gaëtan Poussin','Gardien',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Gaëtan Poussin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0367','Georginio Rutter',NULL,NULL,2017,2017,25,8,'2017-11-02','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Georginio Rutter; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0297','Gilles Sunu','Attaquant',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Gilles Sunu; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0279','Gueïda Fofana','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Gueïda Fofana; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0248','Guillaume Insou','Milieu',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Guillaume Insou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0056','Guy Zohouri','Milieu','2007-02-01',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Guy Zohouri; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0339','Hakim El Mokeddem','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Hakim El Mokeddem; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0057','Hatem Ben Arfa','Attaquant',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Hatem Ben Arfa; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0058','Henri Saivet','Milieu','1990-10-26',2006,2007,21,8,NULL,'Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Henri Saivet; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0059','Hervé Bazile','Attaquant','1990-03-18',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Hervé Bazile; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0209','Hugo Coldefy','Gardien',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'Hugo Coldefy; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0060','Hugo Lamouliatte','Défenseur','2006-07-14',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Hugo Lamouliatte; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0319','Hugo Mesbah','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Hugo Mesbah; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0061','Ibrahim Kanté','Attaquant','2007-03-18',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ibrahim Kanté; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0062','Ibrahim M''Baye','Attaquant','2008-01-24',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ibrahim M''Baye; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0332','Ibrahima Diallo','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ibrahima Diallo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0322','Ibrahima Konaté','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ibrahima Konaté; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0063','Ibrahima Tandia','Milieu','1993-07-12',2010,2010,14,2,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Ibrahima Tandia; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0302','Idriss Saadi','Attaquant',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Idriss Saadi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0064','Ilan Jourdren','Gardien','2008-07-17',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ilan Jourdren; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0065','Ilyas Azizi','Milieu','2008-04-13',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ilyas Azizi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0066','Irélé Apo','Défenseur',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Irélé Apo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0067','Isaac Doamo','Gardien','2007-12-26',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Isaac Doamo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0361','Isaac Solet','Milieu',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Isaac Solet; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0068','Ismail Bouneb','Milieu','2006-06-07',2023,2023,24,7,'2022-09-28','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Ismail Bouneb; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0224','Issa Diop','Défenseur',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Issa Diop; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0069','Issa Samba','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Issa Samba; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0232','Jason Pendant','Défenseur',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jason Pendant; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0070','Jaydee Canvot','Défenseur','2006-07-29',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jaydee Canvot; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0071','Jean Ruiz','Milieu / Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jean Ruiz; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0072','Jean-Christophe Cesto','Milieu',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jean-Christophe Cesto; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0213','Jean-Kévin Augustin','Attaquant',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jean-Kévin Augustin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0073','Jean-Victor Makengo','Milieu',NULL,2014,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jean-Victor Makengo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0074','Jeanuël Belocian','Défenseur',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jeanuël Belocian; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0075','Jeff Reine-Adélaïde','Milieu',NULL,2014,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jeff Reine-Adélaïde; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0263','Jeffrey Baltus','Gardien',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jeffrey Baltus; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0294','Jimmy Kamghain','Attaquant',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jimmy Kamghain; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0076','Joachim Kayi-Sanda','Défenseur','2006-11-29',2023,2023,21,0,'2022-09-28','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Joachim Kayi-Sanda; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0373','Johann Lepenant',NULL,NULL,2018,2018,21,0,'2018-09-25','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Johann Lepenant; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2018'),
('U17P-0355','John Da','Défenseur',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'John Da; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0077','Jonathan Ikoné','Attaquant','1998-05-02',2014,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jonathan Ikoné; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0078','Jordan Ikoko','Défenseur','1994-02-03',2010,2010,19,1,'2010-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Jordan Ikoko; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0079','Jordan Rambaud','Attaquant',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jordan Rambaud; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0080','Joris Delle','Gardien','1990-03-29',2006,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Joris Delle; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0081','Joshua Dago','Attaquant','2009-05-10',2026,2026,11,4,'2025-09-17','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Joshua Dago; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0278','Joël Adegoroye','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Joël Adegoroye; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0082','Joël-Emmanuel Coulibaly','Milieu','2007-05-11',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Joël-Emmanuel Coulibaly; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0083','Jules Stawiecki','Gardien','2007-04-10',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jules Stawiecki; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0236','Julien Berthomier','Défenseur',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Julien Berthomier; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0084','Junior Ndiaye','Attaquant',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Junior Ndiaye; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0085','Justin Tsouh','Milieu','2007-11-23',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Justin Tsouh; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0216','Jérémy Gélin','Défenseur',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jérémy Gélin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0086','Jérémy Ménez','Attaquant',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jérémy Ménez; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0087','Jérémy Obin','Défenseur','1993-03-05',2010,2010,12,0,'2009-12-08','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Jérémy Obin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0226','Jérôme Onguéné','Défenseur',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Jérôme Onguéné; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0254','Karim Aït-Fana','Attaquant',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Karim Aït-Fana; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0088','Karim Benzema','Attaquant',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Karim Benzema; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0089','Karim El Mourabet','Défenseur',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Karim El Mourabet; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0090','Kaïl Boudache','Milieu','2006-06-15',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Kaïl Boudache; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0328','Kelvin Amian','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Kelvin Amian; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0207','Kelvin Amian Adou','Défenseur',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'Kelvin Amian Adou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0358','Khéphren Thuram','Milieu',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Khéphren Thuram; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0091','Kouakou Gadou','Défenseur','2007-01-17',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Kouakou Gadou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0092','Kurt Zouma','Défenseur','1994-10-27',2010,2010,17,1,'2010-08-24','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Kurt Zouma; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0093','Kylian Kouakou','Attaquant','2007-01-05',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Kylian Kouakou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0204','Kylian Mbappé','Attaquant','1998-12-20',2014,2014,2,0,'2014-09-10','FFF','Vérifié FFF','https://www.fff.fr/equipe-nationale/joueur/8566-mbappe-kylian/fiche.html','Kylian Mbappé; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0094','Kyllian Antonio','Défenseur','2008-01-04',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Kyllian Antonio; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0095','Kénan Doganay','Milieu','2009-01-22',2026,2026,10,1,'2025-10-08','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Kénan Doganay; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0239','Kévin Barré','Défenseur',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Kévin Barré; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0307','Kévin Châtelain','Défenseur',NULL,2010,2010,NULL,NULL,NULL,NULL,'À compléter',NULL,'Kévin Châtelain; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010'),
('U17P-0096','Kévin Constant','Milieu',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Kévin Constant; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0097','Kévin Crépel','Gardien','1993-04-16',2010,2010,3,0,'2009-12-10','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Kévin Crépel; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0335','Lamine Fomba','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lamine Fomba; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0343','Lamine Ghezali','Attaquant',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lamine Ghezali; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0238','Lamine Koné','Défenseur',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lamine Koné; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0098','Lenny Nangis','Attaquant','1994-03-24',2010,2010,20,9,'2010-08-24','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Lenny Nangis; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0327','Lenny Vallier','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lenny Vallier; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0269','Lionel Carole','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lionel Carole; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0304','Lionel Mpasi-Nzau','Gardien',NULL,2010,2010,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lionel Mpasi-Nzau; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010'),
('U17P-0099','Lisandru Olmeta','Gardien',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lisandru Olmeta; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0100','Loan Merrifield','Attaquant','2009-03-29',2026,2026,13,4,NULL,'Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Loan Merrifield; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0351','Logan Costa','Défenseur',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Logan Costa; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0101','Lorenzo Callegari','Milieu','1998-02-27',2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lorenzo Callegari; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0102','Lorik Vial','Gardien','2009-07-29',2026,2026,1,0,'2026-06-01','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Lorik Vial; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0277','Loris Néry','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Loris Néry; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0244','Loïc Abenzoar','Défenseur',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Loïc Abenzoar; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0316','Loïc Badiashile','Gardien',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Loïc Badiashile; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0321','Loïc Bessilé','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Loïc Bessilé; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0287','Loïc Damour','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Loïc Damour; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0299','Loïc Gagnon','Attaquant',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Loïc Gagnon; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0353','Loïc Mbe Soh','Défenseur',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Loïc Mbe Soh; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0276','Loïc Nego','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Loïc Nego; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0247','Loïc Poujol','Milieu',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Loïc Poujol; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0103','Luca Zidane','Gardien',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Luca Zidane; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0104','Lucas Batbedat','Défenseur','2008-08-01',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lucas Batbedat; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0362','Lucas Da Cunha','Milieu',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lucas Da Cunha; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0105','Lucas Digne','Défenseur','1993-07-20',2010,2010,15,0,'2009-08-27','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Lucas Digne; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0356','Lucas Russo','Défenseur',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Lucas Russo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0368','Lucien Agoumé',NULL,NULL,2018,2018,25,4,'2018-09-25','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Lucien Agoumé; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2018'),
('U17P-0228','Ludovic Blas','Milieu',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ludovic Blas; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0106','Luzolo Vangi Vungele','Défenseur',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Luzolo Vangi Vungele; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0222','Léo Blanchard','Défenseur',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Léo Blanchard; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0107','Léo Lemaître Lezcano','Défenseur','2009-03-20',2026,2026,8,1,'2025-09-17','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Léo Lemaître Lezcano; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0108','Léo Paul Bouyer','Gardien','2008-08-14',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Léo Paul Bouyer; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0324','Léon Valentin','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Léon Valentin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0310','M''Baye Niang','Attaquant',NULL,2010,2010,NULL,NULL,NULL,NULL,'À compléter',NULL,'M''Baye Niang; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010'),
('U17P-0323','Mahamadou Dembélé','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mahamadou Dembélé; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0318','Malang Sarr','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Malang Sarr; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0109','Mamadou Doucouré','Attaquant / Défenseur','1993-03-29',2010,2015,4,2,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Mamadou Doucouré; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2015'),
('U17P-0110','Mamadou Meïté','Attaquant','2009-07-01',2026,2026,6,1,NULL,'Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Mamadou Meïté; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0111','Mamadou Sakho','Défenseur','1990-02-13',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mamadou Sakho; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0112','Mamadou Sarr','Défenseur',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mamadou Sarr; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0306','Marc-Gauthier Bedimé','Défenseur',NULL,2010,2010,NULL,NULL,NULL,NULL,'À compléter',NULL,'Marc-Gauthier Bedimé; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010'),
('U17P-0113','Marco Rosenfelder','Défenseur','1993-07-19',2010,2010,19,2,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Marco Rosenfelder; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0229','Marcus Thuram','Attaquant',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'Marcus Thuram; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0114','Marius Courcoul','Milieu','2007-01-01',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Marius Courcoul; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0115','Marius Louër','Défenseur','2007-03-11',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Marius Louër; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0116','Martial Riff','Milieu','1990-02-22',2006,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Martial Riff; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0210','Mathias Fischer','Défenseur',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mathias Fischer; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0309','Mathieu Castaing','Attaquant',NULL,2010,2010,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mathieu Castaing; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010'),
('U17P-0231','Mathieu Coquin','Milieu',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mathieu Coquin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0235','Mathieu Gorgelin','Gardien',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mathieu Gorgelin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0117','Mathis Amougou','Milieu','2006-01-18',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mathis Amougou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0118','Mathis Chambon','Défenseur','2009-01-18',2026,2026,11,0,'2025-09-17','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Mathis Chambon; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0119','Mathis Lambourde','Attaquant','2006-01-09',2023,2023,23,10,'2022-09-28','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Mathis Lambourde; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0120','Mathis Tel','Attaquant',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mathis Tel; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0234','Matthieu Dreyer','Gardien',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Matthieu Dreyer; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0121','Matthieu Saunier','Défenseur','1990-02-07',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Matthieu Saunier; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0122','Matys Donavin','Défenseur','2006-11-22',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Matys Donavin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0354','Maxence Lacroix','Défenseur',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Maxence Lacroix; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0206','Maxime Bernauer','Défenseur',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'Maxime Bernauer; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0123','Maxime Dupé','Gardien','1993-03-04',2010,2010,8,0,'2009-08-27','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Maxime Dupé; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0124','Maxime Josse','Défenseur','1987-03-21',2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Maxime Josse; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0271','Maxime Poundjé','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Maxime Poundjé; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0125','Maxime Pélican','Attaquant',NULL,2014,2015,20,5,'2014-09-10','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Maxime Pélican; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0126','Maël Gernigon','Défenseur','2009-10-01',2026,2026,11,0,'2025-09-17','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Maël Gernigon; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0289','Mehdi Abeid','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mehdi Abeid; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0336','Michaël Cuisance','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Michaël Cuisance; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0127','Mickaël Nelson','Défenseur','1990-02-02',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mickaël Nelson; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0128','Milan Leccese','Milieu','2008-11-30',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Milan Leccese; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0129','Mohamed Diaby','Défenseur','2009-08-31',2026,2026,2,0,'2026-05-29','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Mohamed Diaby; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0130','Mohamed Meïté','Attaquant','2007-10-11',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mohamed Meïté; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0131','Mohamed Sylla','Défenseur','2009-02-01',2026,2026,10,0,'2025-09-17','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Mohamed Sylla; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0132','Mohamed-Amine Bouchenna','Attaquant','2006-06-15',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mohamed-Amine Bouchenna; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0246','Morgan Schneiderlin','Milieu',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Morgan Schneiderlin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0305','Mory Koné','Défenseur',NULL,2010,2010,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mory Koné; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010'),
('U17P-0249','Moussa Sissoko','Milieu',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Moussa Sissoko; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0133','Mustapha Sissoko','Défenseur','2007-01-17',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Mustapha Sissoko; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0342','Myziane Maolida','Attaquant',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Myziane Maolida; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0134','Nahim El Bouhmidi','Milieu','2007-01-18',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Nahim El Bouhmidi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0237','Namaie Mendy','Défenseur',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Namaie Mendy; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0359','Naouirou Ahamada','Milieu',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Naouirou Ahamada; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0135','Nathan Kasia Nkondo','Défenseur','2009-02-05',2026,2026,1,0,'2026-06-01','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Nathan Kasia Nkondo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0136','Nathan Talbot','Défenseur','2007-09-12',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Nathan Talbot; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0366','Nathanaël Mbuku',NULL,NULL,2018,2018,25,10,'2018-10-25','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Nathanaël Mbuku; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2018'),
('U17P-0137','Naïm Byar','Milieu','2005-02-23',2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Naïm Byar; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0138','Nhoa Sangui','Défenseur','2006-02-27',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Nhoa Sangui; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0139','Nicolas Janvier','Milieu',NULL,2014,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Nicolas Janvier; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0140','Nicolas Kocik','Gardien',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Nicolas Kocik; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0141','Noah Loufoundou Debski','Milieu','2009-05-13',2026,2026,8,3,'2026-02-18','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Noah Loufoundou Debski; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0142','Noah Raveyre','Gardien',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Noah Raveyre; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0143','Noha Tiehi','Attaquant','2009-06-30',2026,2026,9,2,NULL,'Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Noha Tiehi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0144','Nolan Ferro','Milieu','2006-01-18',2023,2023,23,0,'2022-09-28','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Nolan Ferro; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0145','Numan Bostan','Gardien',NULL,2014,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Numan Bostan; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0315','Numan Soysal','Gardien',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Numan Soysal; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0146','Odsonne Édouard','Attaquant','1998-01-16',2015,2015,12,15,NULL,'FFF','Vérifié FFF','https://www.fff.fr/equipe-nationale/joueur/8955-edouard-odsonne/fiche.html','Odsonne Édouard; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0240','Omar Benzerga','Défenseur',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Omar Benzerga; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0205','Ousmane Dembélé','Attaquant','1997-05-15',2013,2013,8,4,'2013-09-10','FFF','Vérifié FFF','https://www.fff.fr/equipe-nationale/joueur/8736-dembele-ousmane/fiche.html','Ousmane Dembélé; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0147','Pape Cabral','Milieu','2007-01-20',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Pape Cabral; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0225','Patrick Keyoubi','Attaquant',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Patrick Keyoubi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0148','Paul Argney','Gardien','2006-05-23',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Paul Argney; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0331','Paul Devarrewaere','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Paul Devarrewaere; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0149','Paul Eymard','Milieu','2008-01-05',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Paul Eymard; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0330','Paul Fargeas','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Paul Fargeas; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0150','Paul Pogba','Milieu','1993-03-15',2010,2010,10,2,'2010-02-13','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Paul Pogba; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0217','Paulo Henriques de Pinho','Milieu',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Paulo Henriques de Pinho; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0317','Peter Ouaneh','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Peter Ouaneh; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0151','Philtzgerald Mbaka','Milieu','1993-01-24',2010,2010,1,0,'2010-02-14','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Philtzgerald Mbaka; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0152','Pierre Bourdin','Défenseur','1994-01-06',2010,2010,4,0,NULL,'Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Pierre Bourdin; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0153','Pierre Ducasse','Milieu',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Pierre Ducasse; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0260','Pierrick Cros','Gardien',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Pierrick Cros; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0154','Pladi N''Zinga-Pambani','Défenseur','2007-03-17',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Pladi N''Zinga-Pambani; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0291','Plaisir Bahamboula','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Plaisir Bahamboula; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0155','Quentin Beunardeau','Gardien','1994-02-27',2010,2010,14,0,'2010-08-24','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Quentin Beunardeau; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0311','Quentin N''Gakoutou','Attaquant',NULL,2010,2010,NULL,NULL,NULL,NULL,'À compléter',NULL,'Quentin N''Gakoutou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010'),
('U17P-0345','Rafik Guitane','Attaquant',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Rafik Guitane; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0337','Raouf Mroivili','Milieu',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Raouf Mroivili; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0156','Raphaël Calvet','Défenseur','1994-02-07',2010,2010,20,1,'2010-08-24','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Raphaël Calvet; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0157','Rayane Messi','Attaquant','2007-05-23',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Rayane Messi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0262','Riffi Mandanda','Gardien',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Riffi Mandanda; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0158','Robinio Vaz','Attaquant','2007-02-17',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Robinio Vaz; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0159','Romain Davigny','Attaquant','1994-06-01',2010,2010,8,3,NULL,'Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Romain Davigny; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0251','Romain Dedola','Milieu',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Romain Dedola; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0160','Romain Jean-Baptiste','Gardien','2006-02-21',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Romain Jean-Baptiste; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0161','Romain Villard','Défenseur','1990-01-09',2006,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Romain Villard; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0162','Ruben Lomet','Milieu','2008-08-20',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ruben Lomet; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0163','Rudy Matondo','Milieu','2008-03-13',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Rudy Matondo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0214','Ryan Bidounga','Défenseur',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Ryan Bidounga; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0164','Rémy Riou','Gardien','1987-08-06',2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Rémy Riou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0285','Samba Kanouté','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Samba Kanouté; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0165','Sami Wattel','Milieu','2006-01-15',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Sami Wattel; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0166','Samir Nasri','Attaquant',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Samir Nasri; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0167','Samuel Atrous','Gardien','1990-02-15',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Samuel Atrous; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0168','Samuel Umtiti','Défenseur','1993-11-14',2010,2010,7,0,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Samuel Umtiti; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0169','Sanah Camara','Milieu','2008-04-08',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Sanah Camara; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0170','Saël Kumbedi','Défenseur',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Saël Kumbedi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0171','Saïd Mehamha','Milieu','1990-09-04',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Saïd Mehamha; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0172','Saïmon Bouabré','Milieu','2006-06-01',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Saïmon Bouabré; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0173','Seny Koumbassa','Défenseur','2007-06-20',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Seny Koumbassa; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0174','Serge Akakpo','Défenseur',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Serge Akakpo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0175','Soan Ameline','Milieu','2008-05-29',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Soan Ameline; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0348','Sonny Laiton','Gardien',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Sonny Laiton; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0176','Soualiho Meïté','Milieu','1994-03-17',2010,2010,13,1,'2010-10-27','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Soualiho Meïté; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0325','Stanley Nsoki','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Stanley Nsoki; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0177','Steven Thicot','Défenseur','1987-02-14',2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Steven Thicot; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0178','Stéphane Marseille','Milieu',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Stéphane Marseille; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0215','Sylvain Deslandes','Défenseur',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Sylvain Deslandes; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0272','Sébastien Faure','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Sébastien Faure; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0364','Tanguy Nianzou',NULL,NULL,2017,2017,26,3,'2017-11-02','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Tanguy Nianzou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0211','Teddy Okou','Attaquant',NULL,2014,2014,NULL,NULL,NULL,NULL,'À compléter',NULL,'Teddy Okou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2014'),
('U17P-0300','Terence Makengo','Attaquant',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Terence Makengo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0179','Thibault Bourgeois','Attaquant','1990-01-05',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Thibault Bourgeois; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0257','Thibaut Bourgeois','Attaquant',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Thibaut Bourgeois; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0212','Thierry Ambrose','Attaquant',NULL,2013,2013,NULL,NULL,NULL,NULL,'À compléter',NULL,'Thierry Ambrose; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2013'),
('U17P-0180','Thomas Mangani','Défenseur',NULL,2004,2004,NULL,NULL,NULL,NULL,'À compléter',NULL,'Thomas Mangani; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2004; 2004'),
('U17P-0282','Thomas Monconduit','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Thomas Monconduit; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0350','Théo Barbet','Défenseur',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Théo Barbet; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0313','Théo Louis','Gardien',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Théo Louis; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0181','Théodore Pouille','Attaquant','1994-12-03',2010,2010,3,0,'2010-08-24','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Théodore Pouille; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0182','Tidiam Gomis','Attaquant','2006-08-08',2023,2023,21,3,'2022-09-28','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Tidiam Gomis; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0183','Tidiane Diallo','Attaquant','2006-05-28',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Tidiane Diallo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0184','Timothé Cognat','Milieu',NULL,2014,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Timothé Cognat; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015; 2015'),
('U17P-0264','Timothée Kolodziejczak','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Timothée Kolodziejczak; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0360','Titouan Thomas','Milieu',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Titouan Thomas; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0185','Tom Raiani','Défenseur','2008-04-15',2025,2025,NULL,NULL,NULL,NULL,'À compléter',NULL,'Tom Raiani; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2025; 2025'),
('U17P-0186','Tom Saettel','Attaquant',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Tom Saettel; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0371','Valentin Atangana',NULL,NULL,2021,2021,21,1,'2021-08-18','Transfermarkt','Source secondaire — record historique','https://www.transfermarkt.fr/frankreich-u17/rekordnationalspieler/verein/10831','Valentin Atangana; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2021'),
('U17P-0187','Valentin Atangana Edoa','Milieu',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Valentin Atangana Edoa; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0188','Vincent Acapandié','Milieu / Défenseur','1990-02-09',2006,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Vincent Acapandié; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0233','Vincent Degré','Gardien',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Vincent Degré; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0189','Vincent Le Roux','Milieu','1993-01-19',2010,2010,6,0,NULL,'Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Vincent Le Roux; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0190','Warren Zaïre-Emery','Milieu',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Warren Zaïre-Emery; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022'),
('U17P-0191','Wesley Yamnaine','Défenseur','1993-07-07',2010,2010,14,0,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Wesley Yamnaine; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0192','William Le Pogam','Défenseur','1993-03-03',2010,2010,9,0,'2009-09-22','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','William Le Pogam; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0265','William Rémy','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'William Rémy; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0193','Willsem Boussaid','Attaquant','2006-01-30',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Willsem Boussaid; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0267','Willy Boly','Défenseur',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Willy Boly; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0255','Yacine Brahimi','Attaquant',NULL,2006,2006,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yacine Brahimi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2006'),
('U17P-0349','Yahia Fofana','Gardien',NULL,2017,2017,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yahia Fofana; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2017'),
('U17P-0329','Yan Valery','Défenseur',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yan Valery; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0194','Yanis Addich','Milieu','2009-02-23',2026,2026,14,0,'2025-09-17','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Yanis Addich; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0195','Yanis Issoufou','Attaquant','2006-10-28',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yanis Issoufou; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0341','Yann Karamoh','Attaquant',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yann Karamoh; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0196','Yann M''Vila','Milieu','1990-06-29',2007,2007,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yann M''Vila; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2007; 2007'),
('U17P-0308','Yannick Moussa','Défenseur',NULL,2010,2010,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yannick Moussa; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010'),
('U17P-0296','Yannis Salibur','Attaquant',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yannis Salibur; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0290','Yannis Tafer','Milieu',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yannis Tafer; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0347','Yassin Fortuné','Attaquant',NULL,2015,2015,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yassin Fortuné; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2015'),
('U17P-0197','Yaya Sanogo','Attaquant','1993-01-27',2010,2010,16,9,'2009-08-25','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Yaya Sanogo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0198','Yaël Thebault','Milieu','2007-02-26',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yaël Thebault; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0298','Yeni Ngbakoto','Attaquant',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yeni Ngbakoto; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0199','Yoann Becker','Défenseur','2009-01-12',2026,2026,6,0,'2026-02-18','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831','Yoann Becker; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2026; 2026'),
('U17P-0200','Yoram Zague','Défenseur','2006-05-15',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yoram Zague; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0201','Youssouf Sabaly','Défenseur','1993-03-05',2010,2010,11,0,'2009-12-08','Source secondaire','Source secondaire','https://www.transfermarkt.fr/france-u17/kader/verein/10831/saison_id/2010/plus/1','Youssouf Sabaly; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2010; 2010'),
('U17P-0202','Yvann Titi','Défenseur','2006-05-05',2023,2023,NULL,NULL,NULL,NULL,'À compléter',NULL,'Yvann Titi; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2023; 2023'),
('U17P-0259','Zacharie Boucher','Gardien',NULL,2008,2008,NULL,NULL,NULL,NULL,'À compléter',NULL,'Zacharie Boucher; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2008'),
('U17P-0203','Zoumana Diallo','Attaquant',NULL,2022,2022,NULL,NULL,NULL,NULL,'À compléter',NULL,'Zoumana Diallo; France U17; U17 masculine; Bleuets; équipe de France jeunes; 2022; 2022');

-- Complète le nom normalisé des joueurs historiques si nécessaire.
update public.players set name_normalized=pg_temp.b3k_norm(display_name)
where gender='M' and (name_normalized is null or btrim(name_normalized)='');

-- Création UNIQUEMENT lorsque le joueur n'existe pas déjà de façon non ambiguë.
with resolved as (
  select i.*,
    (select p.id from public.players p
      where p.gender='M' and pg_temp.b3k_norm(p.display_name)=pg_temp.b3k_norm(i.display_name)
      order by case when i.birth_date is not null and p.birth_date=i.birth_date then 0 else 1 end,
               case when p.birth_date is null then 1 else 0 end,p.created_at
      limit 1) existing_id
  from b3k_u17_import i
)
insert into public.players(display_name,last_name,gender,birth_date,primary_position,secondary_positions,legacy_key,profile_slug,name_normalized,data_status,active_source,keywords,external_ids)
select r.display_name,
       regexp_replace(r.display_name,'^.*\s',''),
       'M',r.birth_date,
       nullif(btrim(split_part(coalesce(r.positions,''),'/',1)),''),
       case when position('/' in coalesce(r.positions,''))>0 then array[nullif(btrim(split_part(r.positions,'/',2)),'')]::text[] else '{}'::text[] end,
       'U17M-'||r.source_id,
       'u17m-'||lower(regexp_replace(r.source_id,'[^A-Za-z0-9]+','-','g')),
       pg_temp.b3k_norm(r.display_name),
       case when r.source_status='À compléter' then 'partial' else 'verified_source' end,
       true,
       array_remove(string_to_array(coalesce(r.keywords_text,''),';'),''),
       jsonb_build_object('u17_source_id',r.source_id,'u17_source_url',r.source_url)
from resolved r where r.existing_id is null
on conflict do nothing;

-- Ajout des mots-clés/source U17 aux profils globaux déjà connus, sans écraser leurs autres données.
update public.players p set
  keywords=(select array_agg(distinct btrim(x)) from unnest(coalesce(p.keywords,'{}'::text[]) || array_remove(string_to_array(coalesce(i.keywords_text,''),';'),'')) x where btrim(x)<>''),
  external_ids=coalesce(p.external_ids,'{}'::jsonb)||jsonb_build_object('u17_source_id',i.source_id,'u17_source_url',i.source_url),
  birth_date=coalesce(p.birth_date,i.birth_date),
  primary_position=coalesce(p.primary_position,nullif(btrim(split_part(coalesce(i.positions,''),'/',1)),'')),
  updated_at=now()
from b3k_u17_import i
where p.gender='M' and pg_temp.b3k_norm(p.display_name)=pg_temp.b3k_norm(i.display_name)
  and (i.birth_date is null or p.birth_date is null or p.birth_date=i.birth_date);

-- Une seule ligne de stats U17 par joueur global.
insert into public.player_selection_stats(player_id,selection_id,selections,goals,first_year,last_year,first_selection_date,source_rank,data_status,source_quality)
select p.id,s.id,i.selections,i.goals,i.first_year,i.last_year,i.first_selection_date,
       case when i.source_name ilike 'FFF%' then 1 else 2 end,
       case when i.selections is null and i.goals is null then 'partial' else 'sourced' end,
       i.source_status
from b3k_u17_import i
join public.players p on p.gender='M' and pg_temp.b3k_norm(p.display_name)=pg_temp.b3k_norm(i.display_name)
join public.selection_teams s on s.code='FRA-U17-M'
on conflict(player_id,selection_id) do update set
  selections=coalesce(excluded.selections,public.player_selection_stats.selections),
  goals=coalesce(excluded.goals,public.player_selection_stats.goals),
  first_year=coalesce(excluded.first_year,public.player_selection_stats.first_year),
  last_year=coalesce(excluded.last_year,public.player_selection_stats.last_year),
  first_selection_date=coalesce(excluded.first_selection_date,public.player_selection_stats.first_selection_date),
  source_rank=coalesce(excluded.source_rank,public.player_selection_stats.source_rank),
  data_status=excluded.data_status,source_quality=excluded.source_quality,updated_at=now();

-- Tag cliquable U17 Masculin sur chaque joueur. GENERAL reste le contexte agrégé calculé par l'interface.
insert into public.entity_tags(entity_type,entity_id,tag_id)
select 'player',ps.player_id,t.id
from public.player_selection_stats ps
join public.selection_teams s on s.id=ps.selection_id and s.code='FRA-U17-M'
join public.tags t on t.slug='u17'
on conflict do nothing;

-- Contrôle post-import : attendu 376 lignes U17 pour ce référentiel.
select count(*) as u17_players_imported,
       count(*) filter(where ps.selections is not null or ps.goals is not null) as with_stats
from public.player_selection_stats ps join public.selection_teams s on s.id=ps.selection_id
where s.code='FRA-U17-M';


-- === MIGRATION_V1.1.30_CALENDRIER.sql ============================================================

-- Bleus 3000 V1.1.30 — Calendrier relationnel
-- Réutilise public.matches comme source unique : historique + futurs matchs API.

alter table public.matches
  add column if not exists broadcast_text text,
  add column if not exists broadcast_url text,
  add column if not exists provider text,
  add column if not exists provider_fixture_id text,
  add column if not exists provider_updated_at timestamptz,
  add column if not exists data_state text not null default 'verified',
  add column if not exists api_payload jsonb not null default '{}'::jsonb;

create unique index if not exists matches_provider_fixture_uidx
  on public.matches(provider, provider_fixture_id)
  where provider is not null and provider_fixture_id is not null;
create index if not exists matches_calendar_date_idx on public.matches(match_date desc);
create index if not exists matches_calendar_selection_idx on public.matches(selection_team_id, match_date desc);

alter table public.matches drop constraint if exists matches_data_state_check;
alter table public.matches add constraint matches_data_state_check
  check (data_state in ('api','verified','locked'));

-- Les données historiques déjà présentes sont considérées comme vérifiées.
update public.matches set data_state='verified' where data_state is null or data_state='';

-- Lecture publique, édition manuelle réservée aux éditeurs/admins déjà définis par Bleus 3000.
alter table public.matches enable row level security;
drop policy if exists matches_read on public.matches;
drop policy if exists matches_write on public.matches;
create policy matches_read on public.matches for select to anon,authenticated using(true);
create policy matches_write on public.matches for all to authenticated using(public.can_edit()) with check(public.can_edit());

grant select on table public.matches to anon, authenticated;
grant insert, update, delete on table public.matches to authenticated;

-- Les référentiels reliés doivent être lisibles pour composer la liste calendrier.
grant select on table public.opponents, public.competitions, public.places, public.selection_teams to anon, authenticated;


-- === MIGRATION_V1.1.35_THESPORTSDB_CALENDRIER.sql ============================================================

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


-- === MIGRATION_V1.1.36_TAGS_DRAPEAUX.sql ============================================================

-- Bleus 3000 V1.1.36
-- Tags de sections + tags de compétitions.
-- Les corrections de tag par match restent dans matches.manual_overrides.

alter table public.competitions
  add column if not exists tag_id uuid references public.tags(id) on delete set null;

create index if not exists competitions_tag_id_idx on public.competitions(tag_id);

-- Catalogue des sections Bleus 3000.
insert into public.tags
  (slug, kind, label_text, icon_text, aliases, appearance, color_start, color_end, text_color, border_color, gradient_angle, border_radius, border_width, created_by, is_active)
values
  ('international','tag','INTERNATIONAL','🇫🇷',array['France A','France A M','A Masculin'],'gradient','#00329e','#ff0000','#ffffff','#000000',135,8,1,null,true),
  ('espoirs','tag','ESPOIRS','🇫🇷',array['France Espoirs','France U21','France U23','Espoirs/U21'],'gradient','#2563eb','#0ea5c6','#ffffff','#feb500',135,8,1,null,true),
  ('u20','tag','U20','🇫🇷',array['France U20','U20M'],'gradient','#2563eb','#082654','#ffffff','#082654',135,8,1,null,true),
  ('u19','tag','U19','🇫🇷',array['France U19','U19M'],'gradient','#2563eb','#082654','#ffffff','#082654',135,8,1,null,true),
  ('u18','tag','U18','🇫🇷',array['France U18','U18M'],'gradient','#2563eb','#082654','#ffffff','#082654',135,8,1,null,true),
  ('u17','tag','U17','🇫🇷',array['France U17','U17M'],'gradient','#2563eb','#000000','#ffffff','#000000',135,8,1,null,true),
  ('u16','tag','U16','🇫🇷',array['France U16','U16M'],'gradient','#2563eb','#082654','#ffffff','#082654',135,8,1,null,true),
  ('internationale-f','tag','INTERNATIONALE F','🇫🇷',array['France A F','France A Féminine','Internationale féminine'],'gradient','#ffffff','#4d9aff','#ffffff','#ed9cdb',135,8,1,null,true),
  ('espoirs-f','tag','ESPOIRS F','🇫🇷',array['France U23 F','Espoirs Féminine','France Espoirs Féminine'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true),
  ('u20-feminin','tag','U20 F','🇫🇷',array['France U20 F','France U20 Féminine','U20F'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true),
  ('u19-feminin','tag','U19 F','🇫🇷',array['France U19 F','France U19 Féminine','U19F'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true),
  ('u18-feminin','tag','U18 F','🇫🇷',array['France U18 F','France U18 Féminine','U18F'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true),
  ('u17-feminin','tag','U17 F','🇫🇷',array['France U17 F','France U17 Féminine','U17F'],'gradient','#2563eb','#a9f0fe','#ffffff','#000000',135,8,1,null,true),
  ('u16-feminin','tag','U16 F','🇫🇷',array['France U16 F','France U16 Féminine','U16F'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true)
on conflict (slug) do update
set label_text = excluded.label_text,
    aliases = excluded.aliases,
    is_active = true,
    updated_at = now();

with mapping(code, slug) as (
  values
    ('FRA-A-M','international'),
    ('FRA-ESP-M','espoirs'),
    ('FRA-U20-M','u20'),
    ('FRA-U19-M','u19'),
    ('FRA-U18-M','u18'),
    ('FRA-U17-M','u17'),
    ('FRA-U16-M','u16'),
    ('FRA-A-F','internationale-f'),
    ('FRA-U23-F','espoirs-f'),
    ('FRA-U20-F','u20-feminin'),
    ('FRA-U19-F','u19-feminin'),
    ('FRA-U18-F','u18-feminin'),
    ('FRA-U17-F','u17-feminin'),
    ('FRA-U16-F','u16-feminin')
)
update public.selection_teams s
set team_tag_id = t.id,
    updated_at = now()
from mapping m
join public.tags t on t.slug=m.slug
where s.code=m.code
  and s.team_tag_id is distinct from t.id;

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select s.team_tag_id,'selection',s.id,'membership',null
from public.selection_teams s
where s.team_tag_id is not null
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;

-- Une compétition = un tag global modifiable depuis le menu Profil > Tags & étiquettes.
insert into public.tags
  (slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active)
select
  'competition-' || left(replace(c.id::text,'-',''),12),
  'tag',
  left(c.name,40),
  '🏆',
  array_remove(array[c.name,c.edition],null),
  'gradient',
  '#eef4fb','#dce8f6','#18304e','#c5d4e6',135,16,1,null,true
from public.competitions c
on conflict (slug) do update
set aliases=excluded.aliases,
    is_active=true,
    updated_at=now();

update public.competitions c
set tag_id=t.id,
    updated_at=now()
from public.tags t
where t.slug='competition-' || left(replace(c.id::text,'-',''),12)
  and c.tag_id is distinct from t.id;

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select c.tag_id,'competition',c.id,'membership',null
from public.competitions c
where c.tag_id is not null
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;


-- === MIGRATION_V1.1.37_REBRAND_MENTIONS_TAG_AMICAL.sql ============================================================

-- 3615 Bleus V1.1.37
-- Regroupement de toutes les compétitions amicales sous un tag unique « Match Amical ».
-- La partie rebranding / mentions légales est purement frontend et ne renomme aucune base technique.

insert into public.tags
  (slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active)
values
  ('match-amical','tag','Match Amical','⚽',
   array['Amical','Match amical','Matchs amicaux','International Friendlies','International Friendly'],
   'gradient','#eef4fb','#dce8f6','#18304e','#c5d4e6',135,16,1,null,true)
on conflict (slug) do update
set label_text='Match Amical',
    aliases=excluded.aliases,
    is_active=true,
    updated_at=now();

-- Si un match avait une correction manuelle pointant vers l'ancien tag automatique
-- de sa compétition amicale, bascule cette correction vers le nouveau tag partagé.
with match_tag as (
  select id from public.tags where slug='match-amical' limit 1
),
friendly_tags as (
  select distinct c.tag_id as id
  from public.competitions c
  where c.tag_id is not null
    and (c.name ilike '%amic%' or c.name ilike '%friendl%')
)
update public.matches m
set manual_overrides=jsonb_set(m.manual_overrides,'{competition_tag_id}',to_jsonb((select id::text from match_tag)),true),
    updated_at=now()
where m.manual_overrides ? 'competition_tag_id'
  and (m.manual_overrides->>'competition_tag_id') in (select id::text from friendly_tags)
  and exists (select 1 from match_tag);

-- Nettoie les anciennes liaisons spécifiques à chaque année / compétition amicale.
delete from public.tag_reference_links l
using public.competitions c
where l.reference_type='competition'
  and l.reference_id=c.id
  and (c.name ilike '%amic%' or c.name ilike '%friendl%');

-- Toutes les compétitions amicales utilisent désormais un même tag.
update public.competitions c
set tag_id=(select id from public.tags where slug='match-amical' limit 1),
    updated_at=now()
where c.name ilike '%amic%' or c.name ilike '%friendl%';

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select t.id,'competition',c.id,'membership',null
from public.competitions c
cross join public.tags t
where t.slug='match-amical'
  and (c.name ilike '%amic%' or c.name ilike '%friendl%')
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;

-- Supprime les anciens tags annuels / automatiques devenus orphelins.
delete from public.tags t
where t.slug like 'competition-%'
  and (t.label_text ilike '%amic%' or t.label_text ilike '%friendl%')
  and not exists (select 1 from public.competitions c where c.tag_id=t.id)
  and not exists (select 1 from public.entity_tags e where e.tag_id=t.id)
  and not exists (select 1 from public.tag_reference_links l where l.tag_id=t.id);


-- === MIGRATION_V1.1.38_CALENDAR_CREATE_TAG_GRADIENTS.sql ============================================================

-- 3615 Bleus V1.1.38
-- Dégradés de tags jusqu'à 5 couleurs.
-- La création de matchs réutilise le schéma relationnel existant et ne nécessite pas de nouvelle table.

alter table public.tags
  add column if not exists gradient_colors text[] not null default '{}'::text[];

update public.tags
set gradient_colors = case
  when appearance = 'solid' then array[color_start]
  else array[color_start, color_end]
end
where cardinality(gradient_colors)=0;

alter table public.tags
  drop constraint if exists tags_gradient_colors_check;

alter table public.tags
  add constraint tags_gradient_colors_check
  check (cardinality(gradient_colors) between 0 and 5);


-- === MIGRATION_V1.1.39_COMPETITION_FAMILIES_STATS.sql ============================================================

-- 3615 Bleus V1.1.39
-- Familles de compétitions + création automatique du contexte statistique lors d'une association de tag de sélection.

insert into public.tags
  (slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active)
values
  ('euro-u21','tag','Euro U21','🏆',array['Euro U21','UEFA European Under-21 Championship'],'gradient','#0b2f6b','#2d6cdf',array['#0b2f6b','#2d6cdf'],'#ffffff','#0b2f6b',135,16,1,null,true),
  ('qualif-euro-u21','tag','Qualif EURO U21','🎯',array['Qualification Euro U21','Qualifications Euro U21','UEFA U21 Championship Qualification','Qualification Coupe Europe'],'gradient','#172554','#2563eb',array['#172554','#2563eb'],'#ffffff','#172554',135,16,1,null,true),
  ('coupe-du-monde-u17','tag','Coupe du monde U17','🌍',array['FIFA U-17 World Cup','Mondial U17'],'gradient','#081f4d','#1677ff',array['#081f4d','#1677ff'],'#ffffff','#081f4d',135,16,1,null,true),
  ('coupe-du-monde-u17-f','tag','Coupe du monde U17 F','🌍',array['FIFA Womens U17 World Cup','Mondial U17 féminin'],'gradient','#182a70','#6ca9ff',array['#182a70','#6ca9ff'],'#ffffff','#182a70',135,16,1,null,true),
  ('ligue-des-nations','tag','Ligue des Nations','🏆',array['UEFA Nations League'],'gradient','#081f4d','#315fc9',array['#081f4d','#315fc9'],'#ffffff','#081f4d',135,16,1,null,true)
on conflict (slug) do update
set label_text=excluded.label_text, aliases=excluded.aliases, is_active=true, updated_at=now();

-- Editions finales historiques de l'Euro U21.
update public.competitions c
set tag_id=(select id from public.tags where slug='euro-u21'), updated_at=now()
where c.name ~* '^Euro U21 [0-9]{4}';

-- Qualifications Euro U21, y compris les anciennes dénominations et le libellé générique TheSportsDB actuellement utilisé pour les éliminatoires.
update public.competitions c
set tag_id=(select id from public.tags where slug='qualif-euro-u21'), updated_at=now()
where c.name ilike '%qualif%u21%'
   or c.name ilike 'Qualification Coupe Europe%'
   or c.name ilike 'UEFA U21 Championship Qualification%'
   or (c.name='UEFA European Under-21 Championship' and c.selection_category='Espoirs/U21');

update public.competitions c
set tag_id=(select id from public.tags where slug='coupe-du-monde-u17'), updated_at=now()
where c.name ilike 'FIFA U-17 World Cup%';

update public.competitions c
set tag_id=(select id from public.tags where slug='coupe-du-monde-u17-f'), updated_at=now()
where c.name ilike 'FIFA Womens U17 World Cup%';

update public.competitions c
set tag_id=(select id from public.tags where slug='ligue-des-nations'), updated_at=now()
where c.name ilike 'UEFA Nations League%';

-- Répare les associations référentielles après regroupement.
delete from public.tag_reference_links l
using public.competitions c
where l.reference_type='competition'
  and l.reference_id=c.id
  and l.relation_kind='membership'
  and l.tag_id is distinct from c.tag_id;

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select c.tag_id,'competition',c.id,'membership',null
from public.competitions c
where c.tag_id is not null
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;

-- Nettoie uniquement les tags automatiques de compétition devenus orphelins.
delete from public.tags t
where t.slug like 'competition-%'
  and not exists (select 1 from public.competitions c where c.tag_id=t.id)
  and not exists (select 1 from public.selection_teams s where s.team_tag_id=t.id)
  and not exists (select 1 from public.entity_tags e where e.tag_id=t.id)
  and not exists (select 1 from public.tag_reference_links l where l.tag_id=t.id);

-- Toute association d'un tag de sélection à un joueur crée son contexte de statistiques.
create or replace function public.ensure_player_selection_stats_from_tag()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_selection_id uuid;
begin
  if new.entity_type <> 'player' then
    return new;
  end if;

  select id into v_selection_id
  from public.selection_teams
  where team_tag_id = new.tag_id and active = true
  limit 1;

  if v_selection_id is not null then
    insert into public.player_selection_stats(
      player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,
      appearance_status,data_status,updated_at
    ) values (
      new.entity_id,v_selection_id,0,0,0,0,0,0,0,
      'capped','manual_pending',now()
    )
    on conflict (player_id,selection_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_entity_tag_player_selection_stats on public.entity_tags;
create trigger trg_entity_tag_player_selection_stats
after insert or update of entity_type,entity_id,tag_id on public.entity_tags
for each row execute function public.ensure_player_selection_stats_from_tag();

-- Backfill sans écraser les statistiques existantes.
insert into public.player_selection_stats(
  player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,
  appearance_status,data_status,updated_at
)
select et.entity_id,st.id,0,0,0,0,0,0,0,'capped','manual_pending',now()
from public.entity_tags et
join public.selection_teams st on st.team_tag_id=et.tag_id and st.active=true
left join public.player_selection_stats ps on ps.player_id=et.entity_id and ps.selection_id=st.id
where et.entity_type='player' and ps.id is null
on conflict (player_id,selection_id) do nothing;


-- === MIGRATION_V1.1.40_TAG_SCOPE_CALENDAR.sql ============================================================

-- 3615 Bleus V1.1.40
-- Portée explicite des tags pour garantir leur disponibilité dans les formulaires Calendrier.

alter table public.tags
  add column if not exists reference_scope text;

alter table public.tags
  drop constraint if exists tags_reference_scope_check;

alter table public.tags
  add constraint tags_reference_scope_check
  check (reference_scope is null or reference_scope in ('selection','competition','general'));

update public.tags t
set reference_scope='selection'
where exists (select 1 from public.selection_teams s where s.team_tag_id=t.id)
   or exists (select 1 from public.tag_reference_links l where l.tag_id=t.id and l.reference_type='selection');

update public.tags t
set reference_scope='competition'
where exists (select 1 from public.competitions c where c.tag_id=t.id)
   or exists (select 1 from public.tag_reference_links l where l.tag_id=t.id and l.reference_type='competition');

update public.tags
set reference_scope='general'
where slug='general';


-- === MIGRATION_V1.1.41_DIFFUSIONS.sql ============================================================

-- 3615 Bleus V1.1.41 — entités de chaînes de diffusion et tags/logo
alter table public.tags drop constraint if exists tags_reference_scope_check;
alter table public.tags add constraint tags_reference_scope_check
check (reference_scope is null or reference_scope in ('selection','competition','broadcast','general'));

alter table public.tag_reference_links drop constraint if exists tag_reference_links_reference_type_check;
alter table public.tag_reference_links add constraint tag_reference_links_reference_type_check
check (reference_type in ('selection','competition','opponent','place','personnel','equipment','bibliography','match','callup','broadcast'));

create table if not exists public.broadcast_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  aliases text[] not null default '{}'::text[],
  tag_id uuid references public.tags(id) on delete set null,
  website_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_broadcast_channels (
  match_id uuid not null references public.matches(id) on delete cascade,
  broadcast_channel_id uuid not null references public.broadcast_channels(id) on delete cascade,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (match_id,broadcast_channel_id)
);

alter table public.broadcast_channels enable row level security;
alter table public.match_broadcast_channels enable row level security;

drop policy if exists broadcast_channels_read on public.broadcast_channels;
create policy broadcast_channels_read on public.broadcast_channels for select to anon,authenticated using (active=true);
drop policy if exists broadcast_channels_write on public.broadcast_channels;
create policy broadcast_channels_write on public.broadcast_channels for all to authenticated
using ((select public.can_edit())) with check ((select public.can_edit()));

drop policy if exists match_broadcast_channels_read on public.match_broadcast_channels;
create policy match_broadcast_channels_read on public.match_broadcast_channels for select to anon,authenticated using (true);
drop policy if exists match_broadcast_channels_write on public.match_broadcast_channels;
create policy match_broadcast_channels_write on public.match_broadcast_channels for all to authenticated
using ((select public.can_edit())) with check ((select public.can_edit()));

grant select on public.broadcast_channels to anon,authenticated;
grant insert,update,delete on public.broadcast_channels to authenticated;
grant select on public.match_broadcast_channels to anon,authenticated;
grant insert,update,delete on public.match_broadcast_channels to authenticated;
grant select,insert,update,delete on public.broadcast_channels,public.match_broadcast_channels to service_role;

-- Nettoyage sûr des noms d'adversaires : la section est portée par le tag de sélection,
-- pas par le nom du pays. Les doublons sont fusionnés avant suppression de l'ancienne ligne.
do $$
declare
  r record;
  target_id uuid;
  base_name text;
begin
  for r in
    select id,name from public.opponents
    where name ~* '\s+(Women\s+)?U(16|17|18|19|20|21|23)$'
       or name ~* '\s+(Women|Woman|Féminine|Feminine|Espoirs)$'
  loop
    base_name := trim(regexp_replace(r.name,'\s+(Women\s+)?U(16|17|18|19|20|21|23)$','','i'));
    base_name := trim(regexp_replace(base_name,'\s+(Women|Woman|Féminine|Feminine|Espoirs)$','','i'));
    if base_name = '' or base_name = r.name then continue; end if;
    select id into target_id from public.opponents where lower(name)=lower(base_name) and id<>r.id limit 1;
    if target_id is not null then
      update public.matches set opponent_id=target_id,updated_at=now() where opponent_id=r.id;
      delete from public.opponents where id=r.id;
    else
      update public.opponents set name=base_name where id=r.id;
    end if;
    target_id := null;
  end loop;
end $$;


-- === MIGRATION_V1.1.42_CALENDAR_FEATURE_FRAMES.sql ============================================================

-- 3615 Bleus V1.1.42 — cadres de mise en avant du calendrier
alter table public.matches
  add column if not exists feature_frame_mode text not null default 'auto';

alter table public.matches
  drop constraint if exists matches_feature_frame_mode_check;

alter table public.matches
  add constraint matches_feature_frame_mode_check
  check (feature_frame_mode in ('auto','on','off'));

create table if not exists public.calendar_feature_styles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_text text not null,
  gradient_colors text[] not null default array['#123b8f','#2563eb','#ef3340']::text[],
  gradient_angle integer not null default 135 check (gradient_angle between 0 and 360),
  border_width integer not null default 2 check (border_width between 1 and 8),
  border_radius integer not null default 12 check (border_radius between 0 and 32),
  glow_color text not null default '#2563eb',
  glow_strength integer not null default 12 check (glow_strength between 0 and 40),
  is_default boolean not null default false,
  active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_feature_styles_colors_check check (cardinality(gradient_colors) between 1 and 5)
);

alter table public.calendar_feature_styles enable row level security;

drop policy if exists calendar_feature_styles_read on public.calendar_feature_styles;
create policy calendar_feature_styles_read
on public.calendar_feature_styles for select to anon,authenticated
using (active=true);

drop policy if exists calendar_feature_styles_write on public.calendar_feature_styles;
create policy calendar_feature_styles_write
on public.calendar_feature_styles for all to authenticated
using ((select public.can_edit()))
with check ((select public.can_edit()));

grant select on public.calendar_feature_styles to anon,authenticated;
grant insert,update,delete on public.calendar_feature_styles to authenticated;
grant select,insert,update,delete on public.calendar_feature_styles to service_role;

insert into public.calendar_feature_styles
(slug,label_text,gradient_colors,gradient_angle,border_width,border_radius,glow_color,glow_strength,is_default,active)
values
('international','Affiche internationale',array['#123b8f','#2563eb','#ffffff','#ef3340']::text[],135,2,12,'#2563eb',12,true,true)
on conflict (slug) do update set is_default=true,active=true,updated_at=now();


-- === MIGRATION_V1.1.45_OLYMPIQUE_U23.sql ============================================================

-- 3615 Bleus V1.1.45 — tag de section OLYMPIQUE U23
insert into public.tags
(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope)
values
('olympique-u23','tag','OLYMPIQUE U23','🥇',
 array['France U23','France Olympique','Équipe de France Olympique','Olympics U23','Olympique U23'],
 'gradient','#082654','#2563eb',array['#082654','#2563eb','#ffffff','#ef3340'],
 '#ffffff','#082654',135,10,1,null,true,'selection')
on conflict (slug) do update
set label_text='OLYMPIQUE U23', aliases=excluded.aliases, is_active=true, reference_scope='selection', updated_at=now();

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select t.id,'selection',s.id,'membership',null
from public.tags t
join public.selection_teams s on s.code='FRA-ESP-M'
where t.slug='olympique-u23'
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;


-- === MIGRATION_V1.1.46_JEUX_OLYMPIQUES_2024.sql ============================================================

-- 3615 Bleus V1.1.46 — Jeux Olympiques 2024
insert into public.tags
(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope)
values
('jeux-olympiques','tag','JEUX OLYMPIQUES','🥇',
 array['Jeux Olympiques','Olympics Soccer','Olympic Games','JO'],
 'gradient','#082654','#2563eb',array['#082654','#2563eb','#ffffff','#ef3340'],
 '#ffffff','#082654',135,10,1,null,true,'competition')
on conflict (slug) do update
set label_text='JEUX OLYMPIQUES', aliases=excluded.aliases, reference_scope='competition', is_active=true, updated_at=now();

insert into public.competitions
(name,edition,organizer,competition_type,gender,selection_category,start_date,end_date,host_country,status,external_ids,tag_id)
select
  'Jeux Olympiques 2024','Paris 2024','CIO / FIFA','Tournoi olympique','M','Espoirs/U21',
  '2024-07-24'::date,'2024-08-09'::date,'France','finished',
  jsonb_build_object('thesportsdb_league_id','5039','thesportsdb_season','2024'),t.id
from public.tags t
where t.slug='jeux-olympiques'
  and not exists (select 1 from public.competitions c where c.name='Jeux Olympiques 2024' and coalesce(c.edition,'')='Paris 2024');

update public.competitions c
set tag_id=t.id,
    external_ids=coalesce(c.external_ids,'{}'::jsonb) || jsonb_build_object('thesportsdb_league_id','5039','thesportsdb_season','2024'),
    updated_at=now()
from public.tags t
where t.slug='jeux-olympiques' and c.name='Jeux Olympiques 2024' and coalesce(c.edition,'')='Paris 2024';

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select t.id,'competition',c.id,'membership',null
from public.tags t
join public.competitions c on c.name='Jeux Olympiques 2024' and coalesce(c.edition,'')='Paris 2024'
where t.slug='jeux-olympiques'
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;


-- === MIGRATION_V1.1.48_OLYMPIC_TAG_CLEANUP.sql ============================================================

-- 3615 Bleus V1.1.48 — suppression du doublon d'affichage "OLYMPIQUE U23"
-- Le tag canonique pour les matchs des JO reste le tag de compétition "JEUX OLYMPIQUES".

do $$
declare
  old_tag_id uuid;
  espoirs_tag_id uuid;
begin
  select id into old_tag_id from public.tags where slug='olympique-u23' limit 1;
  select id into espoirs_tag_id from public.tags where slug='espoirs' limit 1;

  if old_tag_id is not null then
    -- Supprime les éventuelles corrections manuelles qui forçaient l'ancien tag sur les matchs.
    update public.matches
    set manual_overrides = coalesce(manual_overrides,'{}'::jsonb) - 'selection_tag_id',
        updated_at = now()
    where manual_overrides->>'selection_tag_id' = old_tag_id::text;

    -- Si l'ancien tag avait été appliqué directement à la sélection Espoirs, restaure le tag Espoirs.
    if espoirs_tag_id is not null then
      update public.selection_teams
      set team_tag_id=espoirs_tag_id, updated_at=now()
      where code='FRA-ESP-M' and team_tag_id=old_tag_id;
    end if;

    delete from public.tag_reference_links where tag_id=old_tag_id;
    update public.tags
    set is_active=false, updated_at=now()
    where id=old_tag_id;
  end if;
end $$;

-- Le tag de compétition JO reste actif et est la seule étiquette olympique affichée.
update public.tags
set is_active=true, reference_scope='competition', updated_at=now()
where slug='jeux-olympiques';


-- === MIGRATION_V1.1.51_REFERENCE_PHOTOS_MATCH_SHEETS.sql ============================================================

-- 3615 Bleus V1.1.51 — photos et bordures des tuiles Staff / Arbitres / Stades
-- Les feuilles de match utilisent la table match_appearances déjà existante : aucune duplication de données.

alter table public.personnel
  add column if not exists photo_path text,
  add column if not exists tile_border_appearance text not null default 'gradient',
  add column if not exists tile_border_color_start text not null default '#123B8F',
  add column if not exists tile_border_color_end text not null default '#2F6DFF',
  add column if not exists tile_border_gradient_angle integer not null default 135,
  add column if not exists tile_border_width integer not null default 3,
  add column if not exists tile_border_radius integer not null default 14;

alter table public.places
  add column if not exists photo_path text,
  add column if not exists tile_border_appearance text not null default 'gradient',
  add column if not exists tile_border_color_start text not null default '#123B8F',
  add column if not exists tile_border_color_end text not null default '#2F6DFF',
  add column if not exists tile_border_gradient_angle integer not null default 135,
  add column if not exists tile_border_width integer not null default 3,
  add column if not exists tile_border_radius integer not null default 14;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('reference-photos','reference-photos',true,5242880,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists reference_photos_insert on storage.objects;
drop policy if exists reference_photos_update on storage.objects;
drop policy if exists reference_photos_delete on storage.objects;

create policy reference_photos_insert on storage.objects
for insert to authenticated
with check(bucket_id='reference-photos' and public.can_edit());

create policy reference_photos_update on storage.objects
for update to authenticated
using(bucket_id='reference-photos' and (owner=auth.uid() or public.can_edit()))
with check(bucket_id='reference-photos' and (owner=auth.uid() or public.can_edit()));

create policy reference_photos_delete on storage.objects
for delete to authenticated
using(bucket_id='reference-photos' and (owner=auth.uid() or public.can_edit()));


-- === MIGRATION_V1.1.53_MATCH_SHEET_EVENTS.sql ============================================================

-- 3615 Bleus V1.1.53 — feuilles de match éditables + faits de jeu détaillés
-- Réutilise match_appearances et match_goal_events existants, sans dupliquer les compositions.
-- Les 47 buts déjà présents dans match_goal_events restent intacts et sont affichés automatiquement.

alter table public.match_goal_events
  add column if not exists assist_player_id uuid references public.players(id) on delete set null,
  add column if not exists assist_name text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists match_goal_events_match_id_idx
  on public.match_goal_events(match_id);

create table if not exists public.match_card_events (
  id uuid primary key default gen_random_uuid(),
  source_card_id text unique,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  team_name text,
  card_type text not null default 'yellow'
    check (card_type in ('yellow','red','second_yellow')),
  minute_text text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_card_events_match_id_idx
  on public.match_card_events(match_id);

alter table public.match_card_events enable row level security;

drop policy if exists match_card_events_read on public.match_card_events;
drop policy if exists match_card_events_write on public.match_card_events;

create policy match_card_events_read on public.match_card_events
for select to anon, authenticated
using (true);

create policy match_card_events_write on public.match_card_events
for all to authenticated
using (public.can_edit())
with check (public.can_edit());

-- Complète uniquement les compteurs de buts encore NULL à partir des événements
-- détaillés déjà présents. Les valeurs déjà renseignées ne sont jamais écrasées.
with detailed_goals as (
  select match_id, player_id, count(*)::int as goals_count
  from public.match_goal_events
  where player_id is not null
  group by match_id, player_id
)
update public.match_appearances ma
set goals = dg.goals_count
from detailed_goals dg
where ma.match_id = dg.match_id
  and ma.player_id = dg.player_id
  and ma.goals is null;


-- === MIGRATION_V1.1.56_U18_FEMININES.sql ============================================================

-- 3615 Bleus V1.1.56 — U18 Féminines 1997-2026
-- Source d'entrée : fichier utilisateur 3615_Bleus_U18_Feminines_1997_2026.xlsx
-- Le fichier source ne contient que les noms : aucune statistique de sélection n'est inventée.
-- Les joueuses déjà présentes sont réutilisées ; les nouvelles tuiles sont créées.
-- Toutes les 105 joueuses reçoivent le tag U18 F et une liaison de sélection en statut "called_only".

with src(name) as (
values
  ('Rachael Adedini'),
  ('Camille Abily'),
  ('Sandra Anger-Matute'),
  ('Zoé Avner'),
  ('Ludivine Bardet'),
  ('Julie Bayol'),
  ('Aurélie Beal'),
  ('Médina Belaïd'),
  ('Féérine Belhadj'),
  ('Louna Belhout-Achi'),
  ('Aude Bizet'),
  ('Solenn Bodenan'),
  ('Lola Boisset'),
  ('Sonia Bompastor'),
  ('Charlotte Bouffandeau'),
  ('Emeline Bouquey'),
  ('Stéphanie Bour'),
  ('Lucie Calba'),
  ('Agathe Calvié'),
  ('Anne-Laure Casseleux'),
  ('Sarah Charlet'),
  ('Lauryne Chevray'),
  ('Shana Chossenotte'),
  ('Marie Cizac'),
  ('Charline Coutel'),
  ('Aude Defer'),
  ('Virginie Dessalle'),
  ('Lydie Devaud'),
  ('Céline Deville'),
  ('Tanté Diakité'),
  ('Ludivine Diguelman'),
  ('Sofia Djoubri'),
  ('Valérie Dodille'),
  ('Émilie Dos Santos'),
  ('Sarah Dragon'),
  ('Elia Dubuisson'),
  ('Jeanne Dumets'),
  ('Nina Dumans'),
  ('Laure Dupont'),
  ('Sandrine Dusang'),
  ('Chancelle Effa Effa'),
  ('Tara Elimbi Gilbert'),
  ('Maïssa Fathallah'),
  ('Noémie Fatier'),
  ('Agathe Felden'),
  ('Thaïs Gallais'),
  ('Lya Galodé'),
  ('Laurence Garbil'),
  ('Laura Georges'),
  ('Séverine Goulois'),
  ('Stella Grondin'),
  ('Nelly Guilbert'),
  ('Jeanne Haag'),
  ('Sonia Haziraj'),
  ('Taeryne Job'),
  ('Bouchra Kharafi'),
  ('Marie-Ange Kramo'),
  ('Marie Kubiak'),
  ('Luna Laboucarie'),
  ('Alexane Lambert'),
  ('Léocadie Le Corre-Cahoreau'),
  ('Isabelle Le Denmat'),
  ('Gabrielle Le Roux'),
  ('Fiona Liaigre'),
  ('Alice Mallard Ventura'),
  ('Alice Marques'),
  ('Camille Marmillot'),
  ('Louise Martineau'),
  ('Gaëlle Maugeais'),
  ('Ophélie Meilleroux'),
  ('Stéphanie Mellec'),
  ('Mélinda Mendy'),
  ('Valérie Mercadal'),
  ('Aurélie Meynard'),
  ('Claire Morel'),
  ('Léa Morissaint'),
  ('Eléna Moreira Da Rocha'),
  ('Océane Moreau Tranchant'),
  ('Virginie Mortel'),
  ('Juliette Mossard'),
  ('Sémy Neves Magalhaes'),
  ('Karine Noilhan'),
  ('Laureen Oillic'),
  ('Jennifer Orban'),
  ('Wassilah Pacaud'),
  ('Emmanuelle Podence'),
  ('Ellen Pogeant'),
  ('Nell Poye'),
  ('Élodie Ramos'),
  ('Alexandra Rey'),
  ('Aurore Rougeon'),
  ('Fanny Rossi'),
  ('Sandrine Rouquet'),
  ('Lou Ruffien'),
  ('Bérangère Sapowicz'),
  ('Talila Seika'),
  ('Assa Sidibé'),
  ('Oumou Sidibé'),
  ('Céline Suc'),
  ('Laetitia Tonazzi'),
  ('Imane Touriss'),
  ('Émilie Trimoreau'),
  ('Emma Troter'),
  ('Jennifer Vaucelle'),
  ('Sabrina Viguier')
),
normalized as (
  select name, lower(translate(name,'ÀÁÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒÆàáâäãåçéèêëíìîïñóòôöõúùûüýÿœæ','AAAAAACEEEEIIIINOOOOOUUUUYYOEAEaaaaaaceeeeiiiinooooouuuuyyoeae')) as n
  from src
)
insert into public.players(first_name,last_name,display_name,gender,keywords,name_normalized,data_status,active_source)
select
  split_part(s.name,' ',1),
  regexp_replace(s.name,'^[^ ]+\s+',''),
  s.name,
  'F',
  array['France U18 Féminine','U18 F','U18 Féminine'],
  s.n,
  'source_list',
  false
from normalized s
where not exists (
  select 1
  from public.players p
  where p.gender='F'
    and lower(translate(coalesce(p.name_normalized,p.display_name),'ÀÁÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒÆàáâäãåçéèêëíìîïñóòôöõúùûüýÿœæ','AAAAAACEEEEIIIINOOOOOUUUUYYOEAEaaaaaaceeeeiiiinooooouuuuyyoeae'))=s.n
);

with src(name) as (
values
  ('Rachael Adedini'),
  ('Camille Abily'),
  ('Sandra Anger-Matute'),
  ('Zoé Avner'),
  ('Ludivine Bardet'),
  ('Julie Bayol'),
  ('Aurélie Beal'),
  ('Médina Belaïd'),
  ('Féérine Belhadj'),
  ('Louna Belhout-Achi'),
  ('Aude Bizet'),
  ('Solenn Bodenan'),
  ('Lola Boisset'),
  ('Sonia Bompastor'),
  ('Charlotte Bouffandeau'),
  ('Emeline Bouquey'),
  ('Stéphanie Bour'),
  ('Lucie Calba'),
  ('Agathe Calvié'),
  ('Anne-Laure Casseleux'),
  ('Sarah Charlet'),
  ('Lauryne Chevray'),
  ('Shana Chossenotte'),
  ('Marie Cizac'),
  ('Charline Coutel'),
  ('Aude Defer'),
  ('Virginie Dessalle'),
  ('Lydie Devaud'),
  ('Céline Deville'),
  ('Tanté Diakité'),
  ('Ludivine Diguelman'),
  ('Sofia Djoubri'),
  ('Valérie Dodille'),
  ('Émilie Dos Santos'),
  ('Sarah Dragon'),
  ('Elia Dubuisson'),
  ('Jeanne Dumets'),
  ('Nina Dumans'),
  ('Laure Dupont'),
  ('Sandrine Dusang'),
  ('Chancelle Effa Effa'),
  ('Tara Elimbi Gilbert'),
  ('Maïssa Fathallah'),
  ('Noémie Fatier'),
  ('Agathe Felden'),
  ('Thaïs Gallais'),
  ('Lya Galodé'),
  ('Laurence Garbil'),
  ('Laura Georges'),
  ('Séverine Goulois'),
  ('Stella Grondin'),
  ('Nelly Guilbert'),
  ('Jeanne Haag'),
  ('Sonia Haziraj'),
  ('Taeryne Job'),
  ('Bouchra Kharafi'),
  ('Marie-Ange Kramo'),
  ('Marie Kubiak'),
  ('Luna Laboucarie'),
  ('Alexane Lambert'),
  ('Léocadie Le Corre-Cahoreau'),
  ('Isabelle Le Denmat'),
  ('Gabrielle Le Roux'),
  ('Fiona Liaigre'),
  ('Alice Mallard Ventura'),
  ('Alice Marques'),
  ('Camille Marmillot'),
  ('Louise Martineau'),
  ('Gaëlle Maugeais'),
  ('Ophélie Meilleroux'),
  ('Stéphanie Mellec'),
  ('Mélinda Mendy'),
  ('Valérie Mercadal'),
  ('Aurélie Meynard'),
  ('Claire Morel'),
  ('Léa Morissaint'),
  ('Eléna Moreira Da Rocha'),
  ('Océane Moreau Tranchant'),
  ('Virginie Mortel'),
  ('Juliette Mossard'),
  ('Sémy Neves Magalhaes'),
  ('Karine Noilhan'),
  ('Laureen Oillic'),
  ('Jennifer Orban'),
  ('Wassilah Pacaud'),
  ('Emmanuelle Podence'),
  ('Ellen Pogeant'),
  ('Nell Poye'),
  ('Élodie Ramos'),
  ('Alexandra Rey'),
  ('Aurore Rougeon'),
  ('Fanny Rossi'),
  ('Sandrine Rouquet'),
  ('Lou Ruffien'),
  ('Bérangère Sapowicz'),
  ('Talila Seika'),
  ('Assa Sidibé'),
  ('Oumou Sidibé'),
  ('Céline Suc'),
  ('Laetitia Tonazzi'),
  ('Imane Touriss'),
  ('Émilie Trimoreau'),
  ('Emma Troter'),
  ('Jennifer Vaucelle'),
  ('Sabrina Viguier')
),
normalized as (
  select name, lower(translate(name,'ÀÁÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒÆàáâäãåçéèêëíìîïñóòôöõúùûüýÿœæ','AAAAAACEEEEIIIINOOOOOUUUUYYOEAEaaaaaaceeeeiiiinooooouuuuyyoeae')) as n
  from src
),
resolved as (
  select distinct p.id as player_id
  from normalized s
  join public.players p
    on p.gender='F'
   and lower(translate(coalesce(p.name_normalized,p.display_name),'ÀÁÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒÆàáâäãåçéèêëíìîïñóòôöõúùûüýÿœæ','AAAAAACEEEEIIIINOOOOOUUUUYYOEAEaaaaaaceeeeiiiinooooouuuuyyoeae'))=s.n
),
sel as (
  select id as selection_id
  from public.selection_teams
  where code='FRA-U18-F'
  limit 1
)
insert into public.player_selection_stats(player_id,selection_id,appearance_status,data_status)
select r.player_id,sel.selection_id,'called_only','source_list'
from resolved r
cross join sel
on conflict (player_id,selection_id) do nothing;

with src(name) as (
values
  ('Rachael Adedini'),
  ('Camille Abily'),
  ('Sandra Anger-Matute'),
  ('Zoé Avner'),
  ('Ludivine Bardet'),
  ('Julie Bayol'),
  ('Aurélie Beal'),
  ('Médina Belaïd'),
  ('Féérine Belhadj'),
  ('Louna Belhout-Achi'),
  ('Aude Bizet'),
  ('Solenn Bodenan'),
  ('Lola Boisset'),
  ('Sonia Bompastor'),
  ('Charlotte Bouffandeau'),
  ('Emeline Bouquey'),
  ('Stéphanie Bour'),
  ('Lucie Calba'),
  ('Agathe Calvié'),
  ('Anne-Laure Casseleux'),
  ('Sarah Charlet'),
  ('Lauryne Chevray'),
  ('Shana Chossenotte'),
  ('Marie Cizac'),
  ('Charline Coutel'),
  ('Aude Defer'),
  ('Virginie Dessalle'),
  ('Lydie Devaud'),
  ('Céline Deville'),
  ('Tanté Diakité'),
  ('Ludivine Diguelman'),
  ('Sofia Djoubri'),
  ('Valérie Dodille'),
  ('Émilie Dos Santos'),
  ('Sarah Dragon'),
  ('Elia Dubuisson'),
  ('Jeanne Dumets'),
  ('Nina Dumans'),
  ('Laure Dupont'),
  ('Sandrine Dusang'),
  ('Chancelle Effa Effa'),
  ('Tara Elimbi Gilbert'),
  ('Maïssa Fathallah'),
  ('Noémie Fatier'),
  ('Agathe Felden'),
  ('Thaïs Gallais'),
  ('Lya Galodé'),
  ('Laurence Garbil'),
  ('Laura Georges'),
  ('Séverine Goulois'),
  ('Stella Grondin'),
  ('Nelly Guilbert'),
  ('Jeanne Haag'),
  ('Sonia Haziraj'),
  ('Taeryne Job'),
  ('Bouchra Kharafi'),
  ('Marie-Ange Kramo'),
  ('Marie Kubiak'),
  ('Luna Laboucarie'),
  ('Alexane Lambert'),
  ('Léocadie Le Corre-Cahoreau'),
  ('Isabelle Le Denmat'),
  ('Gabrielle Le Roux'),
  ('Fiona Liaigre'),
  ('Alice Mallard Ventura'),
  ('Alice Marques'),
  ('Camille Marmillot'),
  ('Louise Martineau'),
  ('Gaëlle Maugeais'),
  ('Ophélie Meilleroux'),
  ('Stéphanie Mellec'),
  ('Mélinda Mendy'),
  ('Valérie Mercadal'),
  ('Aurélie Meynard'),
  ('Claire Morel'),
  ('Léa Morissaint'),
  ('Eléna Moreira Da Rocha'),
  ('Océane Moreau Tranchant'),
  ('Virginie Mortel'),
  ('Juliette Mossard'),
  ('Sémy Neves Magalhaes'),
  ('Karine Noilhan'),
  ('Laureen Oillic'),
  ('Jennifer Orban'),
  ('Wassilah Pacaud'),
  ('Emmanuelle Podence'),
  ('Ellen Pogeant'),
  ('Nell Poye'),
  ('Élodie Ramos'),
  ('Alexandra Rey'),
  ('Aurore Rougeon'),
  ('Fanny Rossi'),
  ('Sandrine Rouquet'),
  ('Lou Ruffien'),
  ('Bérangère Sapowicz'),
  ('Talila Seika'),
  ('Assa Sidibé'),
  ('Oumou Sidibé'),
  ('Céline Suc'),
  ('Laetitia Tonazzi'),
  ('Imane Touriss'),
  ('Émilie Trimoreau'),
  ('Emma Troter'),
  ('Jennifer Vaucelle'),
  ('Sabrina Viguier')
),
normalized as (
  select name, lower(translate(name,'ÀÁÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒÆàáâäãåçéèêëíìîïñóòôöõúùûüýÿœæ','AAAAAACEEEEIIIINOOOOOUUUUYYOEAEaaaaaaceeeeiiiinooooouuuuyyoeae')) as n
  from src
),
resolved as (
  select distinct p.id as player_id
  from normalized s
  join public.players p
    on p.gender='F'
   and lower(translate(coalesce(p.name_normalized,p.display_name),'ÀÁÂÄÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒÆàáâäãåçéèêëíìîïñóòôöõúùûüýÿœæ','AAAAAACEEEEIIIINOOOOOUUUUYYOEAEaaaaaaceeeeiiiinooooouuuuyyoeae'))=s.n
),
tag as (
  select id as tag_id
  from public.tags
  where slug='u18-feminin' and is_active=true
  limit 1
)
insert into public.entity_tags(entity_type,entity_id,tag_id)
select 'player',r.player_id,tag.tag_id
from resolved r
cross join tag
on conflict (entity_type,entity_id,tag_id) do nothing;


-- === MIGRATION_V1.1.59_MAILLOTS.sql ============================================================

-- 3615 Bleus V1.1.59 — Référentiel Maillots
-- Exécuter dans Supabase SQL Editor sur une base existante.

create table if not exists public.jerseys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  season_label text,
  year_start integer,
  year_end integer,
  usage_type text not null default 'domicile',
  gender_scope text,
  manufacturer text,
  manufacturer_reference text,
  template_name text,
  primary_color text,
  secondary_color text,
  accent_colors text[] not null default '{}',
  collar_type text,
  sleeve_type text,
  pattern_description text,
  crest_description text,
  stars_count integer,
  number_font text,
  player_name_font text,
  material text,
  technology text,
  fit_type text,
  version_type text,
  first_worn_date date,
  last_worn_date date,
  launch_date date,
  notes_short text,
  description_long text,
  source_urls text[] not null default '{}',
  main_photo_path text,
  main_photo_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jersey_selection_teams (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  selection_team_id uuid not null references public.selection_teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (jersey_id, selection_team_id)
);

create table if not exists public.jersey_competitions (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (jersey_id, competition_id)
);

create table if not exists public.jersey_photos (
  id uuid primary key default gen_random_uuid(),
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  photo_path text,
  photo_url text,
  photo_type text not null default 'autre',
  caption text,
  credit text,
  source_url text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists jerseys_year_idx on public.jerseys(year_start,year_end);
create index if not exists jerseys_usage_idx on public.jerseys(usage_type);
create index if not exists jerseys_manufacturer_idx on public.jerseys(manufacturer);
create index if not exists jersey_photos_jersey_idx on public.jersey_photos(jersey_id,sort_order);
create index if not exists jersey_selection_teams_team_idx on public.jersey_selection_teams(selection_team_id);
create index if not exists jersey_competitions_comp_idx on public.jersey_competitions(competition_id);

alter table public.jerseys enable row level security;
alter table public.jersey_selection_teams enable row level security;
alter table public.jersey_competitions enable row level security;
alter table public.jersey_photos enable row level security;

drop policy if exists jerseys_public_read on public.jerseys;
create policy jerseys_public_read on public.jerseys for select using (true);
drop policy if exists jerseys_edit on public.jerseys;
create policy jerseys_edit on public.jerseys for all to authenticated
using (public.can_edit()) with check (public.can_edit());

drop policy if exists jersey_selection_teams_public_read on public.jersey_selection_teams;
create policy jersey_selection_teams_public_read on public.jersey_selection_teams for select using (true);
drop policy if exists jersey_selection_teams_edit on public.jersey_selection_teams;
create policy jersey_selection_teams_edit on public.jersey_selection_teams for all to authenticated
using (public.can_edit()) with check (public.can_edit());

drop policy if exists jersey_competitions_public_read on public.jersey_competitions;
create policy jersey_competitions_public_read on public.jersey_competitions for select using (true);
drop policy if exists jersey_competitions_edit on public.jersey_competitions;
create policy jersey_competitions_edit on public.jersey_competitions for all to authenticated
using (public.can_edit()) with check (public.can_edit());

drop policy if exists jersey_photos_public_read on public.jersey_photos;
create policy jersey_photos_public_read on public.jersey_photos for select using (true);
drop policy if exists jersey_photos_edit on public.jersey_photos;
create policy jersey_photos_edit on public.jersey_photos for all to authenticated
using (public.can_edit()) with check (public.can_edit());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('jersey-photos','jersey-photos',true,10485760,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists jersey_photos_storage_insert on storage.objects;
drop policy if exists jersey_photos_storage_update on storage.objects;
drop policy if exists jersey_photos_storage_delete on storage.objects;
create policy jersey_photos_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='jersey-photos' and public.can_edit());
create policy jersey_photos_storage_update on storage.objects for update to authenticated
using(bucket_id='jersey-photos' and (owner=auth.uid() or public.can_edit()))
with check(bucket_id='jersey-photos' and (owner=auth.uid() or public.can_edit()));
create policy jersey_photos_storage_delete on storage.objects for delete to authenticated
using(bucket_id='jersey-photos' and (owner=auth.uid() or public.can_edit()));


-- === MIGRATION_V1.1.60_NUMEROS_FLOCAGES.sql ============================================================

-- 3615 Bleus V1.1.60
-- Numéros portés par sélection + préparation liaison maillots / feuilles de match + préférence de flocage

alter table if exists public.match_appearances
  add column if not exists shirt_number smallint,
  add column if not exists jersey_id uuid references public.jerseys(id) on delete set null;

create index if not exists idx_match_appearances_shirt_number on public.match_appearances (player_id, selection_team_id, shirt_number);
create index if not exists idx_match_appearances_jersey_id on public.match_appearances (jersey_id);

-- V1.1.62 : user_display_preferences retirée ; les préférences sont centralisées dans public.user_preferences.
comment on column public.match_appearances.shirt_number is 'Numéro porté par le joueur lors de cette feuille de match, utilisé pour les vues par sélection.';
comment on column public.match_appearances.jersey_id is 'Maillot utilisé lors de cette apparition, quand il est connu.';


-- === MIGRATION_V1.1.60.3_MAILLOTS_MATCHS.sql ============================================================

-- 3615 Bleus V1.1.60.3 — relation Maillots ↔ Feuilles de match
-- Exécuter dans Supabase SQL Editor après la migration V1.1.59 Maillots.

create table if not exists public.match_jerseys (
  match_id uuid not null references public.matches(id) on delete cascade,
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  selection_team_id uuid references public.selection_teams(id) on delete set null,
  role text not null default 'outfield',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, jersey_id, role)
);

create index if not exists match_jerseys_match_idx on public.match_jerseys(match_id);
create index if not exists match_jerseys_jersey_idx on public.match_jerseys(jersey_id);
create index if not exists match_jerseys_selection_idx on public.match_jerseys(selection_team_id);

alter table public.match_jerseys enable row level security;

drop policy if exists match_jerseys_public_read on public.match_jerseys;
create policy match_jerseys_public_read on public.match_jerseys for select using (true);

drop policy if exists match_jerseys_edit on public.match_jerseys;
create policy match_jerseys_edit on public.match_jerseys for all to authenticated
using (public.can_edit()) with check (public.can_edit());

comment on table public.match_jerseys is 'Lien relationnel entre une feuille de match et le maillot France utilisé.';
comment on column public.match_jerseys.role is 'outfield par défaut ; permet ensuite gardien ou variantes si nécessaire.';


-- === MIGRATION_V1.1.61_RELATIONS_POSTES_COMPETITIONS.sql ============================================================

-- 3615 Bleus V1.1.61.0 — Postes relationnels + catalogue canonique des compétitions
-- Source : postes(1).txt + compet(1).txt fournis le 25/09/2026.
-- Conserve public.competitions comme couche brute et ajoute une couche canonique sans doublons.
begin;

alter table public.tags drop constraint if exists tags_reference_scope_check;
alter table public.tags add constraint tags_reference_scope_check
check (reference_scope is null or reference_scope=any(array['selection','competition','broadcast','general','position']::text[]));

create temp table _v161_selection_tags on commit drop as
select * from jsonb_to_recordset($S$[{"code":"A_M","slug":"international","label":"INTERNATIONAL","aliases":["#A_M","France A M","A Masculin"]},{"code":"OLYMPIQUE_M","slug":"olympique-u23","label":"OLYMPIQUE U23","aliases":["#OLYMPIQUE_M","France Olympique"]},{"code":"ESPOIRS_M","slug":"espoirs","label":"ESPOIRS","aliases":["#ESPOIRS_M","France U21"]},{"code":"U20_M","slug":"u20","label":"U20","aliases":["#U20_M"]},{"code":"U19_M","slug":"u19","label":"U19","aliases":["#U19_M"]},{"code":"U18_M","slug":"u18","label":"U18","aliases":["#U18_M"]},{"code":"U17_M","slug":"u17","label":"U17","aliases":["#U17_M"]},{"code":"U16_M","slug":"u16","label":"U16","aliases":["#U16_M"]},{"code":"AMATEURS_M","slug":"amateurs-m","label":"AMATEURS M","aliases":["#AMATEURS_M","France Amateurs"]},{"code":"A_F","slug":"internationale-f","label":"INTERNATIONALE F","aliases":["#A_F","France A F"]},{"code":"B_F","slug":"equipe-b-f","label":"ÉQUIPE B F","aliases":["#B_F","France B F","Équipe de France B féminine"]},{"code":"U23_F","slug":"espoirs-f","label":"U23 F","aliases":["#U23_F","France U23 F"]},{"code":"U20_F","slug":"u20-feminin","label":"U20 F","aliases":["#U20_F"]},{"code":"U19_F","slug":"u19-feminin","label":"U19 F","aliases":["#U19_F"]},{"code":"U18_F","slug":"u18-feminin","label":"U18 F","aliases":["#U18_F"]},{"code":"U17_F","slug":"u17-feminin","label":"U17 F","aliases":["#U17_F"]},{"code":"U16_F","slug":"u16-feminin","label":"U16 F","aliases":["#U16_F"]},{"code":"U21_M","slug":"u21-m-historique","label":"U21 M","aliases":["#U21_M","France U21 historique"]}]$S$::jsonb)
as x(code text,slug text,label text,aliases text[]);

create temp table _v161_positions on commit drop as
select * from jsonb_to_recordset($P$[{"slug":"gardien","label":"Gardien","aliases":["Gardienne","Gardien de but","Gardienne de but","Goalkeeper","GB"],"position_group":"gardien","sort_order":1},{"slug":"defenseur-central","label":"Défenseur central","aliases":["Défenseur central","Defenseur central","DC","Central defender"],"position_group":"defense","sort_order":2},{"slug":"stoppeur","label":"Stoppeur","aliases":["Stopper"],"position_group":"defense","sort_order":3},{"slug":"libero","label":"Libéro","aliases":["Libero"],"position_group":"defense","sort_order":4},{"slug":"lateral-droit","label":"Latéral droit","aliases":["Arrière droit","Arriere droit","Latéral D","Lateral droit","DD","Right back"],"position_group":"defense","sort_order":5},{"slug":"lateral-gauche","label":"Latéral gauche","aliases":["Arrière gauche","Arriere gauche","Latéral G","Lateral gauche","DG","Left back"],"position_group":"defense","sort_order":6},{"slug":"piston-droit","label":"Piston droit","aliases":["Wing-back droit","Right wing-back"],"position_group":"defense","sort_order":7},{"slug":"piston-gauche","label":"Piston gauche","aliases":["Wing-back gauche","Left wing-back"],"position_group":"defense","sort_order":8},{"slug":"milieu-defensif-6","label":"Milieu défensif /6","aliases":["Milieu défensif","Milieu defensif","6","MDC","Defensive midfielder"],"position_group":"milieu","sort_order":9},{"slug":"milieu-central-8","label":"Milieu central /8","aliases":["Milieu central","8","MC","Central midfielder"],"position_group":"milieu","sort_order":10},{"slug":"milieu-offensif-axial-10","label":"Milieu offensif axial /10","aliases":["Milieu offensif","10","MOC","Attacking midfielder"],"position_group":"milieu","sort_order":11},{"slug":"demi-droit","label":"Demi droit","aliases":["Right half"],"position_group":"milieu","sort_order":12},{"slug":"demi-centre","label":"Demi centre","aliases":["Centre half"],"position_group":"milieu","sort_order":13},{"slug":"demi-gauche","label":"Demi gauche","aliases":["Left half"],"position_group":"milieu","sort_order":14},{"slug":"inter-droit","label":"Inter droit","aliases":["Inside right"],"position_group":"milieu","sort_order":15},{"slug":"inter-gauche","label":"Inter gauche","aliases":["Inside left"],"position_group":"milieu","sort_order":16},{"slug":"avant-centre-9","label":"Avant-centre 9","aliases":["Avant-centre","Avant centre","9","Buteur","Centre forward"],"position_group":"attaque","sort_order":17},{"slug":"deuxieme-attaquant","label":"Deuxième attaquant","aliases":["Deuxieme attaquant","Second attaquant","Second striker"],"position_group":"attaque","sort_order":18},{"slug":"faux-neuf","label":"Faux neuf","aliases":["False nine"],"position_group":"attaque","sort_order":19},{"slug":"neuf-et-demi","label":"Neuf et demi","aliases":["9 et demi","9½"],"position_group":"attaque","sort_order":20},{"slug":"ailier-droit","label":"Ailier droit","aliases":["AD","Right winger"],"position_group":"attaque","sort_order":21},{"slug":"ailier-gauche","label":"Ailier gauche","aliases":["AG","Left winger"],"position_group":"attaque","sort_order":22}]$P$::jsonb)
as x(slug text,label text,aliases text[],position_group text,sort_order integer);

create temp table _v161_catalog on commit drop as
select * from jsonb_to_recordset($C$[{"slug":"coupe-du-monde-fifa-m","name":"Coupe du monde de la FIFA","aliases":["Coupe du monde","FIFA World Cup"],"gender":"M","ctype":"Phase finale","tag_slug":"competition-catalog-coupe-du-monde-fifa-m","years":[1930,1934,1938,1954,1958,1966,1978,1982,1986,1998,2002,2006,2010,2014,2018,2022,2026],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"qualifications-coupe-du-monde-m","name":"Qualifications pour la Coupe du monde","aliases":["Qualifications Coupe du monde","World Cup Qualification"],"gender":"M","ctype":"Qualifications","tag_slug":"competition-catalog-qualifications-coupe-du-monde-m","years":[1934,1950,1954,1958,1962,1966,1970,1974,1978,1982,1986,1990,1994,2006,2010,2014,2018,2022,2026],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"euro-m","name":"Championnat d'Europe / EURO","aliases":["Championnat d'Europe","EURO","UEFA European Championship"],"gender":"M","ctype":"Phase finale","tag_slug":"competition-catalog-euro-m","years":[1960,1984,1992,1996,2000,2004,2008,2012,2016,2020,2024],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"qualifications-euro-m","name":"Qualifications pour le Championnat d'Europe / EURO","aliases":["Qualifications EURO","Qualifications Championnat d'Europe"],"gender":"M","ctype":"Qualifications","tag_slug":"competition-catalog-qualifications-euro-m","years":[1960,1964,1968,1972,1976,1980,1988,1992,1996,2000,2004,2008,2012,2020,2024],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"ligue-des-nations-m","name":"Ligue des Nations de l'UEFA","aliases":["UEFA Nations League"],"gender":"M","ctype":"Ligue","tag_slug":"ligue-des-nations","years":[2018,2020,2022,2024],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"coupe-confederations","name":"Coupe des Confédérations de la FIFA","aliases":["FIFA Confederations Cup"],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-coupe-confederations","years":[2001,2003],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"artemio-franchi","name":"Coupe Artemio-Franchi / Coupe des champions CONMEBOL-UEFA","aliases":["Coupe Artemio-Franchi","Trophée Artemio-Franchi","Coupe des champions CONMEBOL-UEFA"],"gender":"M","ctype":"Finale intercontinentale","tag_slug":"competition-catalog-artemio-franchi","years":[1985],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"tournoi-france-m","name":"Tournoi de France – masculin","aliases":["Tournoi de France masculin"],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-tournoi-france-m","years":[1988,1997],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"tournoi-koweit","name":"Tournoi du Koweït","aliases":["Kuwait Tournament"],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-tournoi-koweit","years":[1990],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"kirin-cup","name":"Kirin Cup","aliases":[],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-kirin-cup","years":[1994],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"tournoi-hassan-ii","name":"Tournoi Hassan-II","aliases":["Tournoi Hassan II"],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-tournoi-hassan-ii","years":[1998,2000],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"nelson-mandela-challenge","name":"Nelson Mandela Challenge","aliases":[],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-nelson-mandela-challenge","years":[2000],"tags":["A_M"],"edition_tags":{},"notes":null},{"slug":"jeux-olympiques-m","name":"Jeux Olympiques – tournoi masculin","aliases":["Jeux Olympiques","Olympics Soccer","Olympic Games"],"gender":"M","ctype":"Tournoi olympique","tag_slug":"jeux-olympiques","years":[1908,1920,1924,1928,1948,1952,1960,1968,1976,1984,1996,2020,2024],"tags":["OLYMPIQUE_M"],"edition_tags":{},"notes":null},{"slug":"qualifications-olympiques-historiques","name":"Qualifications olympiques / Tournoi préolympique historique","aliases":["Tournoi préolympique","Qualifications olympiques"],"gender":"M","ctype":"Qualifications","tag_slug":"competition-catalog-qualifications-olympiques-historiques","years":[1960,1964,1968,1972,1976,1980,1984,1988],"tags":["OLYMPIQUE_M"],"edition_tags":{},"notes":null},{"slug":"euro-u21","name":"Championnat d'Europe Espoirs / EURO U21 – phase finale","aliases":["Euro U21","UEFA European Under-21 Championship","Championnat d'Europe Espoirs"],"gender":"M","ctype":"Phase finale","tag_slug":"euro-u21","years":[1982,1984,1986,1988,1994,1996,2002,2006,2019,2021,2023,2025],"tags":["ESPOIRS_M"],"edition_tags":{},"notes":null},{"slug":"qualifications-euro-u21","name":"Qualifications EURO U21","aliases":["Qualification Euro U21","UEFA U21 Championship Qualification","Qualification Coupe Europe"],"gender":"M","ctype":"Qualifications","tag_slug":"qualif-euro-u21","years":[1978,1980,1982,1984,1986,1988,1990,1992,1994,1996,1998,2000,2002,2004,2006,2007,2009,2011,2013,2015,2017,2019,2021,2023,2025,2027],"tags":["ESPOIRS_M"],"edition_tags":{},"notes":null},{"slug":"coupe-du-monde-u20-m","name":"Coupe du monde U20 de la FIFA","aliases":["FIFA U-20 World Cup","Mondial U20"],"gender":"M","ctype":"Phase finale","tag_slug":"competition-catalog-coupe-du-monde-u20-m","years":[1977,1997,2001,2011,2013,2017,2019,2023,2025],"tags":["U20_M"],"edition_tags":{},"notes":null},{"slug":"euro-u19-m","name":"Championnat d'Europe U19 / EURO U19 – phase finale","aliases":["EURO U19","Championnat d'Europe U19"],"gender":"M","ctype":"Phase finale","tag_slug":"competition-catalog-euro-u19-m","years":[2003,2005,2007,2009,2010,2012,2013,2015,2016,2018,2019,2022,2024],"tags":["U19_M"],"edition_tags":{},"notes":null},{"slug":"qualifications-euro-u19-m","name":"Qualifications EURO U19","aliases":["Qualifications U19","Qualifications EURO U19 2027"],"gender":"M","ctype":"Qualifications","tag_slug":"competition-catalog-qualifications-euro-u19-m","years":[2002,2003,2004,2005,2006,2007,2008,2009,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2022,2023,2024,2025,2026,2027],"tags":["U19_M"],"edition_tags":{"2027":["U18_M"]},"notes":null},{"slug":"limoges-lafarge","name":"Tournoi international de Limoges / Lafarge Foot Avenir","aliases":["Lafarge Foot Avenir","Tournoi Lafarge","Tournoi international de Limoges","LIMOGES"],"gender":"M","ctype":"Tournoi","tag_slug":"tournoi-international-de-limoges","years":[2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2021,2022,2023,2024,2025,2026],"tags":["U18_M"],"edition_tags":{},"notes":null},{"slug":"tournoi-porto-u18","name":"Tournoi international de Porto","aliases":["Tournoi international de Porto U18"],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-tournoi-porto-u18","years":[2017,2018,2019,2025],"tags":["U18_M"],"edition_tags":{},"notes":"Historique antérieur à vérifier."},{"slug":"uefa-friendship-cup","name":"UEFA Friendship Cup","aliases":[],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-uefa-friendship-cup","years":[2025],"tags":["U18_M"],"edition_tags":{},"notes":null},{"slug":"euro-u17-m","name":"Championnat d'Europe U17 / EURO U17 – phase finale","aliases":["EURO U17","Championnat d'Europe U17"],"gender":"M","ctype":"Phase finale","tag_slug":"competition-catalog-euro-u17-m","years":[2002,2004,2007,2008,2009,2010,2011,2012,2015,2016,2017,2019,2022,2023,2024,2025,2026],"tags":["U17_M"],"edition_tags":{},"notes":null},{"slug":"qualifications-euro-u17-m","name":"Qualifications EURO U17","aliases":["Qualifications U17"],"gender":"M","ctype":"Qualifications","tag_slug":"competition-catalog-qualifications-euro-u17-m","years":[2002,2003,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2022,2023,2024,2025,2026],"tags":["U17_M"],"edition_tags":{},"notes":null},{"slug":"coupe-du-monde-u17-m","name":"Coupe du monde U17 de la FIFA","aliases":["FIFA U-17 World Cup","Mondial U17"],"gender":"M","ctype":"Phase finale","tag_slug":"coupe-du-monde-u17","years":[1987,2001,2007,2011,2015,2017,2019,2023,2025],"tags":["U17_M"],"edition_tags":{},"notes":null},{"slug":"mondial-montaigu-m","name":"Mondial de Montaigu / Challenge des Nations","aliases":["Mondial de Montaigu","Tournoi de Montaigu","Mondial Football Montaigu","Challenge des Nations"],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-mondial-montaigu-m","years":[1976,1977,1978,1979,1980,1981,1982,1983,1984,1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2021,2022,2023,2024,2025,2026],"tags":["U16_M"],"edition_tags":{},"notes":null},{"slug":"val-de-marne","name":"Tournoi international du Val-de-Marne","aliases":["Tournoi du Val-de-Marne"],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-val-de-marne","years":[1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2021,2022,2023,2024,2025],"tags":["U16_M"],"edition_tags":{},"notes":null},{"slug":"dream-cup","name":"Dream Cup","aliases":[],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-dream-cup","years":[2015,2025,2026],"tags":["U16_M"],"edition_tags":{},"notes":null},{"slug":"aegean-cup","name":"Aegean Cup","aliases":[],"gender":"M","ctype":"Tournoi","tag_slug":"competition-catalog-aegean-cup","years":[2009,2010,2011,2012,2013,2014,2015],"tags":["U16_M"],"edition_tags":{},"notes":null},{"slug":"maurice-revello","name":"Tournoi Maurice-Revello","aliases":["Tournoi de Toulon","Festival International Espoirs","Festival International Espoirs de Toulon"],"gender":"M","ctype":"Tournoi multi-catégories","tag_slug":"competition-catalog-maurice-revello","years":[1975,1976,1977,1978,1979,1980,1981,1982,1983,1984,1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2001,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2022,2023,2024,2025],"tags":["U20_M","U21_M","ESPOIRS_M","OLYMPIQUE_M"],"edition_tags":{"2025":["U20_M"]},"notes":"Catégorie réelle à renseigner édition par édition ; seules les associations explicitement confirmées sont préremplies."},{"slug":"jeux-mediterraneens-m","name":"Jeux Méditerranéens – football masculin","aliases":["Jeux Méditerranéens","Mediterranean Games football"],"gender":"M","ctype":"Tournoi multi-catégories","tag_slug":"competition-catalog-jeux-mediterraneens-m","years":[1955,1967,1971,1975,1979,1983,1987,1993,1997,2001,2009,2018,2022],"tags":["AMATEURS_M","ESPOIRS_M","U21_M","U20_M","U18_M","OLYMPIQUE_M"],"edition_tags":{"1993":["U21_M","ESPOIRS_M"],"2018":["U18_M"],"2022":["U18_M"]},"notes":"Tags exacts de certaines éditions anciennes à consolider."},{"slug":"coupe-du-monde-fifa-f","name":"Coupe du monde féminine de la FIFA","aliases":["FIFA Women's World Cup","Coupe du monde féminine"],"gender":"F","ctype":"Phase finale","tag_slug":"competition-catalog-coupe-du-monde-fifa-f","years":[2003,2011,2015,2019,2023],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"qualifications-coupe-du-monde-f","name":"Qualifications pour la Coupe du monde féminine","aliases":["Qualifications Coupe du monde féminine"],"gender":"F","ctype":"Qualifications","tag_slug":"competition-catalog-qualifications-coupe-du-monde-f","years":[1999,2003,2007,2011,2015,2023,2027],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"euro-f","name":"Championnat d'Europe féminin / EURO féminin","aliases":["EURO féminin","UEFA Women's EURO"],"gender":"F","ctype":"Phase finale","tag_slug":"competition-catalog-euro-f","years":[1997,2001,2005,2009,2013,2017,2022,2025],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"qualifications-euro-f","name":"Qualifications EURO féminin","aliases":["Qualifications Championnat d'Europe féminin"],"gender":"F","ctype":"Qualifications","tag_slug":"competition-catalog-qualifications-euro-f","years":[1984,1987,1989,1991,1993,1995,1997,2001,2005,2009,2013,2017,2022,2025],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"ligue-des-nations-f","name":"Ligue des Nations féminine de l'UEFA","aliases":["UEFA Women's Nations League"],"gender":"F","ctype":"Ligue","tag_slug":"competition-catalog-ligue-des-nations-f","years":[2023,2025],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"jeux-olympiques-f","name":"Jeux Olympiques – tournoi féminin","aliases":["Olympic Games Women","Jeux Olympiques féminin"],"gender":"F","ctype":"Tournoi olympique","tag_slug":"competition-catalog-jeux-olympiques-f","years":[2012,2016,2024],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"tournoi-france-f","name":"Tournoi de France – féminin","aliases":["Tournoi de France féminin"],"gender":"F","ctype":"Tournoi","tag_slug":"competition-catalog-tournoi-france-f","years":[2020,2022,2023],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"shebelieves-cup","name":"SheBelieves Cup","aliases":[],"gender":"F","ctype":"Tournoi","tag_slug":"competition-catalog-shebelieves-cup","years":[2016,2017,2018],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"algarve-cup","name":"Algarve Cup","aliases":[],"gender":"F","ctype":"Tournoi","tag_slug":"competition-catalog-algarve-cup","years":[2003,2004,2005,2006,2007,2015],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"cyprus-womens-cup","name":"Cyprus Women's Cup / Coupe de Chypre","aliases":["Cyprus Women's Cup","Cyprus Cup","Coupe de Chypre féminine"],"gender":"F","ctype":"Tournoi","tag_slug":"competition-catalog-cyprus-womens-cup","years":[2009,2012,2014],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"mundialito-f","name":"Mundialito féminin","aliases":[],"gender":"F","ctype":"Tournoi","tag_slug":"competition-catalog-mundialito-f","years":[1988],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"four-nations-f","name":"Four Nations Tournament","aliases":[],"gender":"F","ctype":"Tournoi","tag_slug":"competition-catalog-four-nations-f","years":[2006],"tags":["A_F"],"edition_tags":{},"notes":null},{"slug":"istria-cup","name":"Istria Cup","aliases":[],"gender":"F","ctype":"Tournoi","tag_slug":"competition-catalog-istria-cup","years":[2015],"tags":["B_F"],"edition_tags":{},"notes":null},{"slug":"sud-ladies-cup","name":"Sud Ladies Cup","aliases":[],"gender":"F","ctype":"Tournoi multi-catégories","tag_slug":"competition-catalog-sud-ladies-cup","years":[2018,2019,2022,2023,2024,2025],"tags":["U19_F","U20_F","U23_F"],"edition_tags":{"2018":["U20_F"],"2019":["U20_F"],"2022":["U20_F"],"2023":["U19_F"],"2024":["U20_F"],"2025":["U23_F"]},"notes":null},{"slug":"coupe-du-monde-u20-f","name":"Coupe du monde féminine U20 de la FIFA","aliases":["FIFA U-20 Women's World Cup","ancienne appellation U19"],"gender":"F","ctype":"Phase finale","tag_slug":"competition-catalog-coupe-du-monde-u20-f","years":[2002,2006,2008,2010,2014,2016,2018,2022,2024,2026],"tags":["U20_F","U19_F"],"edition_tags":{"2002":["U19_F"],"2006":["U20_F"],"2008":["U20_F"],"2010":["U20_F"],"2014":["U20_F"],"2016":["U20_F"],"2018":["U20_F"],"2022":["U20_F"],"2024":["U20_F"],"2026":["U20_F"]},"notes":null},{"slug":"nike-international-friendlies-f","name":"Nike International Friendlies","aliases":[],"gender":"F","ctype":"Tournoi","tag_slug":"competition-catalog-nike-international-friendlies-f","years":[2019],"tags":["U20_F"],"edition_tags":{},"notes":null},{"slug":"euro-u19-f","name":"Championnat d'Europe féminin U19 / EURO U19 féminin","aliases":["EURO U19 féminin","ancienne période U18"],"gender":"F","ctype":"Phase finale","tag_slug":"competition-catalog-euro-u19-f","years":[1998,2000,2002,2003,2004,2005,2006,2007,2008,2009,2010,2013,2015,2016,2017,2018,2019,2022,2023,2024,2025],"tags":["U18_F","U19_F"],"edition_tags":{"1998":["U18_F"],"2000":["U18_F"],"2002":["U19_F"],"2003":["U19_F"],"2004":["U19_F"],"2005":["U19_F"],"2006":["U19_F"],"2007":["U19_F"],"2008":["U19_F"],"2009":["U19_F"],"2010":["U19_F"],"2013":["U19_F"],"2015":["U19_F"],"2016":["U19_F"],"2017":["U19_F"],"2018":["U19_F"],"2019":["U19_F"],"2022":["U19_F"],"2023":["U19_F"],"2024":["U19_F"],"2025":["U19_F"]},"notes":null},{"slug":"qualifications-euro-u19-f","name":"Qualifications EURO U19 féminin","aliases":[],"gender":"F","ctype":"Qualifications","tag_slug":"competition-catalog-qualifications-euro-u19-f","years":[2002,2003,2004,2005,2006,2007,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2022,2023,2024,2025,2026],"tags":["U19_F"],"edition_tags":{},"notes":null},{"slug":"euro-u17-f","name":"Championnat d'Europe féminin U17 / EURO U17 féminin","aliases":["EURO U17 féminin"],"gender":"F","ctype":"Phase finale","tag_slug":"competition-catalog-euro-u17-f","years":[2008,2009,2011,2012,2014,2015,2017,2022,2023,2024,2025,2026],"tags":["U17_F"],"edition_tags":{},"notes":null},{"slug":"qualifications-euro-u17-f","name":"Qualifications EURO U17 féminin","aliases":[],"gender":"F","ctype":"Qualifications","tag_slug":"competition-catalog-qualifications-euro-u17-f","years":[2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2022,2023,2024,2025,2026],"tags":["U17_F"],"edition_tags":{},"notes":null},{"slug":"coupe-du-monde-u17-f","name":"Coupe du monde féminine U17 de la FIFA","aliases":["FIFA Womens U17 World Cup","FIFA Women's U-17 World Cup"],"gender":"F","ctype":"Phase finale","tag_slug":"coupe-du-monde-u17-f","years":[2008,2012,2022,2025],"tags":["U17_F"],"edition_tags":{},"notes":null},{"slug":"mondial-montaigu-f","name":"Mondial de Montaigu féminin","aliases":["Challenge des Nations féminin du Mondial de Montaigu"],"gender":"F","ctype":"Tournoi","tag_slug":"competition-catalog-mondial-montaigu-f","years":[2019,2022,2023,2024,2025,2026],"tags":["U16_F"],"edition_tags":{},"notes":null}]$C$::jsonb)
as x(slug text,name text,aliases text[],gender text,ctype text,tag_slug text,years jsonb,tags jsonb,edition_tags jsonb,notes text);

insert into public.tags(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope)
select slug,'tag',label,'⚽',aliases,'gradient','#0b2f6b','#2d6cdf',array['#0b2f6b','#2d6cdf'],'#ffffff','#0b2f6b',135,16,1,null::uuid,true,'selection'
from _v161_selection_tags
on conflict(slug) do update set
 aliases=(select coalesce(array_agg(distinct v order by v),array[]::text[]) from unnest(coalesce(public.tags.aliases,array[]::text[])||excluded.aliases) v),
 is_active=true,updated_at=now();

insert into public.tags(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope)
select 'position-'||slug,'tag',label,'•',aliases,'solid','#123b8f','#123b8f',array['#123b8f'],'#ffffff','#123b8f',0,16,1,null::uuid,true,'position'
from _v161_positions
on conflict(slug) do update set label_text=excluded.label_text,aliases=excluded.aliases,reference_scope='position',is_active=true,updated_at=now();

create table if not exists public.football_positions(
 id uuid primary key default gen_random_uuid(),slug text not null unique,label_text text not null unique,aliases text[] not null default '{}',
 position_group text not null,sort_order integer not null default 0,tag_id uuid not null unique references public.tags(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.football_positions enable row level security;
drop policy if exists football_positions_public_read on public.football_positions;
create policy football_positions_public_read on public.football_positions for select to anon,authenticated using(true);
drop policy if exists football_positions_edit on public.football_positions;
create policy football_positions_edit on public.football_positions for all to authenticated using(public.can_edit()) with check(public.can_edit());
grant select on public.football_positions to anon,authenticated;
grant insert,update,delete on public.football_positions to authenticated;

insert into public.football_positions(slug,label_text,aliases,position_group,sort_order,tag_id)
select s.slug,s.label,s.aliases,s.position_group,s.sort_order,t.id from _v161_positions s join public.tags t on t.slug='position-'||s.slug
on conflict(slug) do update set label_text=excluded.label_text,aliases=excluded.aliases,position_group=excluded.position_group,sort_order=excluded.sort_order,tag_id=excluded.tag_id,updated_at=now();

alter table public.match_appearances add column if not exists position_id uuid references public.football_positions(id) on delete set null;
create index if not exists match_appearances_position_idx on public.match_appearances(position_id);
create index if not exists match_appearances_player_position_idx on public.match_appearances(player_id,position_id);

create or replace function public.football_position_key(p_value text) returns text language sql immutable parallel safe as $$
 select regexp_replace(translate(lower(coalesce(p_value,'')),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g')
$$;

create or replace function public.normalize_match_appearance_position() returns trigger language plpgsql security invoker set search_path=public as $$
declare v_id uuid;v_label text;
begin
 if new.position_id is not null then select id,label_text into v_id,v_label from public.football_positions where id=new.position_id;
 elsif nullif(trim(coalesce(new.position,'')),'') is not null then
  select fp.id,fp.label_text into v_id,v_label from public.football_positions fp
  where public.football_position_key(fp.label_text)=public.football_position_key(new.position)
     or exists(select 1 from unnest(fp.aliases) a where public.football_position_key(a)=public.football_position_key(new.position))
  order by fp.sort_order limit 1;
 end if;
 if v_id is not null then new.position_id:=v_id;new.position:=v_label;
 elsif nullif(trim(coalesce(new.position,'')),'') is null then new.position_id:=null;new.position:=null;
 end if;return new;
end $$;
drop trigger if exists trg_match_appearance_normalize_position on public.match_appearances;
create trigger trg_match_appearance_normalize_position before insert or update of position,position_id on public.match_appearances
for each row execute function public.normalize_match_appearance_position();

create or replace function public.sync_player_position_tags(p_player_id uuid) returns void language plpgsql security invoker set search_path=public as $$
begin
 if p_player_id is null then return;end if;
 insert into public.entity_tags(entity_type,entity_id,tag_id,added_by)
 select 'player',p_player_id,fp.tag_id,null::uuid from public.match_appearances ma join public.football_positions fp on fp.id=ma.position_id
 where ma.player_id=p_player_id group by fp.tag_id on conflict(entity_type,entity_id,tag_id) do nothing;
 delete from public.entity_tags et using public.tags t
 where et.entity_type='player' and et.entity_id=p_player_id and et.tag_id=t.id and t.reference_scope='position'
 and not exists(select 1 from public.match_appearances ma join public.football_positions fp on fp.id=ma.position_id where ma.player_id=p_player_id and fp.tag_id=et.tag_id)
 and not exists(
  select 1 from public.players p join public.football_positions fp on fp.tag_id=et.tag_id where p.id=p_player_id and (
   public.football_position_key(p.primary_position)=public.football_position_key(fp.label_text)
   or exists(select 1 from unnest(fp.aliases) a where public.football_position_key(p.primary_position)=public.football_position_key(a))
   or exists(select 1 from unnest(coalesce(p.secondary_positions,array[]::text[])) sp where public.football_position_key(sp)=public.football_position_key(fp.label_text)
      or exists(select 1 from unnest(fp.aliases) a where public.football_position_key(sp)=public.football_position_key(a)))
  )
 );
end $$;
create or replace function public.sync_player_position_tags_trigger() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_op='DELETE' then perform public.sync_player_position_tags(old.player_id);return old;end if;
 perform public.sync_player_position_tags(new.player_id);
 if tg_op='UPDATE' and old.player_id is distinct from new.player_id then perform public.sync_player_position_tags(old.player_id);end if;
 return new;
end $$;
drop trigger if exists trg_match_appearance_sync_position_tags on public.match_appearances;
create trigger trg_match_appearance_sync_position_tags after insert or update of player_id,position_id,position or delete on public.match_appearances
for each row execute function public.sync_player_position_tags_trigger();

insert into public.entity_tags(entity_type,entity_id,tag_id,added_by)
select distinct 'player',p.id,fp.tag_id,null::uuid from public.players p join public.football_positions fp
on public.football_position_key(p.primary_position)=public.football_position_key(fp.label_text)
or exists(select 1 from unnest(fp.aliases) a where public.football_position_key(p.primary_position)=public.football_position_key(a))
where nullif(trim(coalesce(p.primary_position,'')),'') is not null on conflict do nothing;
insert into public.entity_tags(entity_type,entity_id,tag_id,added_by)
select distinct 'player',p.id,fp.tag_id,null::uuid from public.players p cross join lateral unnest(coalesce(p.secondary_positions,array[]::text[])) sp
join public.football_positions fp on public.football_position_key(sp)=public.football_position_key(fp.label_text)
or exists(select 1 from unnest(fp.aliases) a where public.football_position_key(sp)=public.football_position_key(a))
on conflict do nothing;

create table if not exists public.competition_entities(
 id uuid primary key default gen_random_uuid(),slug text not null unique,name text not null,aliases text[] not null default '{}',
 gender text,competition_type text,competition_tag_id uuid not null references public.tags(id) on delete restrict,notes text,icon_text text,logo_path text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.competition_entities add column if not exists icon_text text;
alter table public.competition_entities add column if not exists logo_path text;
alter table public.competition_editions add column if not exists logo_path text;
create table if not exists public.competition_editions(
 id uuid primary key default gen_random_uuid(),competition_entity_id uuid not null references public.competition_entities(id) on delete cascade,
 edition_year integer not null,edition_label text,notes text,logo_path text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(competition_entity_id,edition_year)
);
create table if not exists public.competition_entity_tags(
 competition_entity_id uuid not null references public.competition_entities(id) on delete cascade,tag_id uuid not null references public.tags(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(competition_entity_id,tag_id)
);
create table if not exists public.competition_edition_tags(
 competition_edition_id uuid not null references public.competition_editions(id) on delete cascade,tag_id uuid not null references public.tags(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(competition_edition_id,tag_id)
);
create index if not exists competition_editions_year_idx on public.competition_editions(edition_year);
create index if not exists competition_entity_tags_tag_idx on public.competition_entity_tags(tag_id);
create index if not exists competition_edition_tags_tag_idx on public.competition_edition_tags(tag_id);

alter table public.competition_entities enable row level security;
alter table public.competition_editions enable row level security;
alter table public.competition_entity_tags enable row level security;
alter table public.competition_edition_tags enable row level security;
drop policy if exists competition_entities_public_read on public.competition_entities;
create policy competition_entities_public_read on public.competition_entities for select to anon,authenticated using(true);
drop policy if exists competition_entities_edit on public.competition_entities;
create policy competition_entities_edit on public.competition_entities for all to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists competition_editions_public_read on public.competition_editions;
create policy competition_editions_public_read on public.competition_editions for select to anon,authenticated using(true);
drop policy if exists competition_editions_edit on public.competition_editions;
create policy competition_editions_edit on public.competition_editions for all to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists competition_entity_tags_public_read on public.competition_entity_tags;
create policy competition_entity_tags_public_read on public.competition_entity_tags for select to anon,authenticated using(true);
drop policy if exists competition_entity_tags_edit on public.competition_entity_tags;
create policy competition_entity_tags_edit on public.competition_entity_tags for all to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists competition_edition_tags_public_read on public.competition_edition_tags;
create policy competition_edition_tags_public_read on public.competition_edition_tags for select to anon,authenticated using(true);
drop policy if exists competition_edition_tags_edit on public.competition_edition_tags;
create policy competition_edition_tags_edit on public.competition_edition_tags for all to authenticated using(public.can_edit()) with check(public.can_edit());
grant select on public.competition_entities,public.competition_editions,public.competition_entity_tags,public.competition_edition_tags to anon,authenticated;
grant insert,update,delete on public.competition_entities,public.competition_editions,public.competition_entity_tags,public.competition_edition_tags to authenticated;

insert into public.tags(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope)
select distinct s.tag_slug,'tag',left(s.name,40),'🏆',array_prepend(s.name,s.aliases),'gradient','#081f4d','#315fc9',array['#081f4d','#315fc9'],'#ffffff','#081f4d',135,16,1,null::uuid,true,'competition'
from _v161_catalog s
on conflict(slug) do update set
 aliases=(select coalesce(array_agg(distinct v order by v),array[]::text[]) from unnest(coalesce(public.tags.aliases,array[]::text[])||excluded.aliases) v),
 reference_scope='competition',is_active=true,updated_at=now();

insert into public.competition_entities(slug,name,aliases,gender,competition_type,competition_tag_id,notes)
select s.slug,s.name,s.aliases,s.gender,s.ctype,t.id,s.notes from _v161_catalog s join public.tags t on t.slug=s.tag_slug
on conflict(slug) do update set name=excluded.name,aliases=excluded.aliases,gender=excluded.gender,competition_type=excluded.competition_type,competition_tag_id=excluded.competition_tag_id,notes=excluded.notes,updated_at=now();

insert into public.competition_editions(competition_entity_id,edition_year,edition_label,notes)
select ce.id,y::integer,y,
 case when s.slug='jeux-mediterraneens-m' and y::integer not in(1993,2018,2022) then 'Catégorie française exacte à consolider pour cette édition.'
      when s.slug='maurice-revello' and y::integer<>2025 then 'Catégorie française exacte à conserver édition par édition ; non affirmée par le référentiel fourni.'
      else null end
from _v161_catalog s cross join lateral jsonb_array_elements_text(s.years) y
join public.competition_entities ce on ce.slug=s.slug
on conflict(competition_entity_id,edition_year) do update set edition_label=excluded.edition_label,notes=excluded.notes,updated_at=now();

delete from public.competition_entity_tags cet using public.competition_entities ce,_v161_catalog s
where cet.competition_entity_id=ce.id and ce.slug=s.slug;
delete from public.competition_edition_tags cet using public.competition_editions ed,public.competition_entities ce,_v161_catalog s
where cet.competition_edition_id=ed.id and ed.competition_entity_id=ce.id and ce.slug=s.slug;

insert into public.competition_entity_tags(competition_entity_id,tag_id)
select ce.id,t.id from _v161_catalog s cross join lateral jsonb_array_elements_text(s.tags) code
join _v161_selection_tags d on d.code=code join public.competition_entities ce on ce.slug=s.slug join public.tags t on t.slug=d.slug
on conflict do nothing;

insert into public.competition_edition_tags(competition_edition_id,tag_id)
select ed.id,t.id
from _v161_catalog s
cross join lateral jsonb_array_elements_text(s.years) y
cross join lateral jsonb_array_elements_text(
 case when s.edition_tags ? y then s.edition_tags->y
      when jsonb_array_length(s.tags)=1 then s.tags else '[]'::jsonb end
) code
join _v161_selection_tags d on d.code=code
join public.competition_entities ce on ce.slug=s.slug
join public.competition_editions ed on ed.competition_entity_id=ce.id and ed.edition_year=y::integer
join public.tags t on t.slug=d.slug
on conflict do nothing;

alter table public.competitions add column if not exists canonical_entity_id uuid references public.competition_entities(id) on delete set null;
alter table public.competitions add column if not exists canonical_edition_id uuid references public.competition_editions(id) on delete set null;
create index if not exists competitions_canonical_entity_idx on public.competitions(canonical_entity_id);
create index if not exists competitions_canonical_edition_idx on public.competitions(canonical_edition_id);
alter table public.matches add column if not exists competition_edition_id uuid references public.competition_editions(id) on delete set null;
create index if not exists matches_competition_edition_idx on public.matches(competition_edition_id);

update public.competitions c set canonical_entity_id=ce.id,canonical_edition_id=ed.id,updated_at=now()
from public.competition_entities ce join public.competition_editions ed on ed.competition_entity_id=ce.id
where ce.slug='euro-u21' and c.name~*'^Euro U21 [0-9]{4}' and ed.edition_year=(substring(c.name from '([0-9]{4})'))::integer;
update public.competitions c set canonical_entity_id=ce.id,canonical_edition_id=ed.id,updated_at=now()
from public.competition_entities ce join public.competition_editions ed on ed.competition_entity_id=ce.id
where ce.slug='qualifications-euro-u21'
and (c.name~*'^Qualification Coupe Europe [0-9]{4}' or c.name~*'^Qualifications? Euro U21 [0-9]{4}' or c.name~*'^UEFA U21 Championship Qualification [0-9]{4}')
and ed.edition_year=(substring(c.name from '([0-9]{4})'))::integer;
update public.competitions c set canonical_entity_id=ce.id,canonical_edition_id=ed.id,updated_at=now()
from public.competition_entities ce join public.competition_editions ed on ed.competition_entity_id=ce.id and ed.edition_year=2024
where ce.slug='jeux-olympiques-m' and (c.name ilike 'Jeux Olympiques 2024%' or (c.name='Olympics Soccer' and coalesce(c.edition,'') like '2024%'));
update public.competitions c set canonical_entity_id=ce.id,canonical_edition_id=null,updated_at=now()
from public.competition_entities ce where ce.slug='limoges-lafarge' and (c.name ilike '%LIMOGES%' or c.name ilike '%LAFARGE%');

update public.matches m set competition_edition_id=coalesce(c.canonical_edition_id,(
 select ed.id from public.competition_editions ed where ed.competition_entity_id=c.canonical_entity_id and ed.edition_year=extract(year from m.match_date)::integer limit 1
))
from public.competitions c where m.competition_id=c.id and c.canonical_entity_id is not null
and m.competition_edition_id is distinct from coalesce(c.canonical_edition_id,(
 select ed.id from public.competition_editions ed where ed.competition_entity_id=c.canonical_entity_id and ed.edition_year=extract(year from m.match_date)::integer limit 1
));

create or replace function public.sync_match_competition_edition() returns trigger language plpgsql security invoker set search_path=public as $$
declare v_entity uuid;v_edition uuid;
begin
 if new.competition_id is null then new.competition_edition_id:=null;return new;end if;
 select canonical_entity_id,canonical_edition_id into v_entity,v_edition from public.competitions where id=new.competition_id;
 if v_edition is null and v_entity is not null and new.match_date is not null then
  select id into v_edition from public.competition_editions where competition_entity_id=v_entity and edition_year=extract(year from new.match_date)::integer limit 1;
 end if;
 new.competition_edition_id:=v_edition;return new;
end $$;
drop trigger if exists trg_matches_sync_competition_edition on public.matches;
create trigger trg_matches_sync_competition_edition before insert or update of competition_id,match_date on public.matches
for each row execute function public.sync_match_competition_edition();

comment on table public.football_positions is 'Référentiel canonique des postes football 3615 Bleus.';
comment on column public.match_appearances.position_id is 'Poste canonique occupé sur cette feuille de match.';
comment on table public.competition_entities is 'Entités principales de compétition, aliases fusionnés.';
comment on table public.competition_editions is 'Éditions réellement disputées par une sélection française selon le référentiel fourni.';
comment on table public.competition_entity_tags is 'Tags historiques de sections françaises pour une entité de compétition.';
comment on table public.competition_edition_tags is 'Sous-tags de l''édition : uniquement la sélection réellement engagée quand elle est établie.';
comment on column public.matches.competition_edition_id is 'Édition canonique utilisée pour relier match, feuille de match et compétition.';
commit;


-- Correctif déterministe V1.1.61.1 : relations entité/édition ↔ tags (évite toute jointure JSON ambiguë).
begin;
delete from public.competition_entity_tags;
delete from public.competition_edition_tags;
insert into public.competition_entity_tags(competition_entity_id,tag_id)
select ce.id,t.id from (values
('coupe-du-monde-fifa-m','international'),
('qualifications-coupe-du-monde-m','international'),
('euro-m','international'),
('qualifications-euro-m','international'),
('ligue-des-nations-m','international'),
('coupe-confederations','international'),
('artemio-franchi','international'),
('tournoi-france-m','international'),
('tournoi-koweit','international'),
('kirin-cup','international'),
('tournoi-hassan-ii','international'),
('nelson-mandela-challenge','international'),
('jeux-olympiques-m','olympique-u23'),
('qualifications-olympiques-historiques','olympique-u23'),
('euro-u21','espoirs'),
('qualifications-euro-u21','espoirs'),
('coupe-du-monde-u20-m','u20'),
('euro-u19-m','u19'),
('qualifications-euro-u19-m','u19'),
('limoges-lafarge','u18'),
('tournoi-porto-u18','u18'),
('uefa-friendship-cup','u18'),
('euro-u17-m','u17'),
('qualifications-euro-u17-m','u17'),
('coupe-du-monde-u17-m','u17'),
('mondial-montaigu-m','u16'),
('val-de-marne','u16'),
('dream-cup','u16'),
('aegean-cup','u16'),
('maurice-revello','u20'),
('maurice-revello','u21-m-historique'),
('maurice-revello','espoirs'),
('maurice-revello','olympique-u23'),
('jeux-mediterraneens-m','amateurs-m'),
('jeux-mediterraneens-m','espoirs'),
('jeux-mediterraneens-m','u21-m-historique'),
('jeux-mediterraneens-m','u20'),
('jeux-mediterraneens-m','u18'),
('jeux-mediterraneens-m','olympique-u23'),
('coupe-du-monde-fifa-f','internationale-f'),
('qualifications-coupe-du-monde-f','internationale-f'),
('euro-f','internationale-f'),
('qualifications-euro-f','internationale-f'),
('ligue-des-nations-f','internationale-f'),
('jeux-olympiques-f','internationale-f'),
('tournoi-france-f','internationale-f'),
('shebelieves-cup','internationale-f'),
('algarve-cup','internationale-f'),
('cyprus-womens-cup','internationale-f'),
('mundialito-f','internationale-f'),
('four-nations-f','internationale-f'),
('istria-cup','equipe-b-f'),
('sud-ladies-cup','u19-feminin'),
('sud-ladies-cup','u20-feminin'),
('sud-ladies-cup','espoirs-f'),
('coupe-du-monde-u20-f','u20-feminin'),
('coupe-du-monde-u20-f','u19-feminin'),
('nike-international-friendlies-f','u20-feminin'),
('euro-u19-f','u18-feminin'),
('euro-u19-f','u19-feminin'),
('qualifications-euro-u19-f','u19-feminin'),
('euro-u17-f','u17-feminin'),
('qualifications-euro-u17-f','u17-feminin'),
('coupe-du-monde-u17-f','u17-feminin'),
('mondial-montaigu-f','u16-feminin')
) v(entity_slug,tag_slug) join public.competition_entities ce on ce.slug=v.entity_slug join public.tags t on t.slug=v.tag_slug on conflict do nothing;
insert into public.competition_edition_tags(competition_edition_id,tag_id)
select ed.id,t.id from (values
('coupe-du-monde-fifa-m',1930,'international'),
('coupe-du-monde-fifa-m',1934,'international'),
('coupe-du-monde-fifa-m',1938,'international'),
('coupe-du-monde-fifa-m',1954,'international'),
('coupe-du-monde-fifa-m',1958,'international'),
('coupe-du-monde-fifa-m',1966,'international'),
('coupe-du-monde-fifa-m',1978,'international'),
('coupe-du-monde-fifa-m',1982,'international'),
('coupe-du-monde-fifa-m',1986,'international'),
('coupe-du-monde-fifa-m',1998,'international'),
('coupe-du-monde-fifa-m',2002,'international'),
('coupe-du-monde-fifa-m',2006,'international'),
('coupe-du-monde-fifa-m',2010,'international'),
('coupe-du-monde-fifa-m',2014,'international'),
('coupe-du-monde-fifa-m',2018,'international'),
('coupe-du-monde-fifa-m',2022,'international'),
('coupe-du-monde-fifa-m',2026,'international'),
('qualifications-coupe-du-monde-m',1934,'international'),
('qualifications-coupe-du-monde-m',1950,'international'),
('qualifications-coupe-du-monde-m',1954,'international'),
('qualifications-coupe-du-monde-m',1958,'international'),
('qualifications-coupe-du-monde-m',1962,'international'),
('qualifications-coupe-du-monde-m',1966,'international'),
('qualifications-coupe-du-monde-m',1970,'international'),
('qualifications-coupe-du-monde-m',1974,'international'),
('qualifications-coupe-du-monde-m',1978,'international'),
('qualifications-coupe-du-monde-m',1982,'international'),
('qualifications-coupe-du-monde-m',1986,'international'),
('qualifications-coupe-du-monde-m',1990,'international'),
('qualifications-coupe-du-monde-m',1994,'international'),
('qualifications-coupe-du-monde-m',2006,'international'),
('qualifications-coupe-du-monde-m',2010,'international'),
('qualifications-coupe-du-monde-m',2014,'international'),
('qualifications-coupe-du-monde-m',2018,'international'),
('qualifications-coupe-du-monde-m',2022,'international'),
('qualifications-coupe-du-monde-m',2026,'international'),
('euro-m',1960,'international'),
('euro-m',1984,'international'),
('euro-m',1992,'international'),
('euro-m',1996,'international'),
('euro-m',2000,'international'),
('euro-m',2004,'international'),
('euro-m',2008,'international'),
('euro-m',2012,'international'),
('euro-m',2016,'international'),
('euro-m',2020,'international'),
('euro-m',2024,'international'),
('qualifications-euro-m',1960,'international'),
('qualifications-euro-m',1964,'international'),
('qualifications-euro-m',1968,'international'),
('qualifications-euro-m',1972,'international'),
('qualifications-euro-m',1976,'international'),
('qualifications-euro-m',1980,'international'),
('qualifications-euro-m',1988,'international'),
('qualifications-euro-m',1992,'international'),
('qualifications-euro-m',1996,'international'),
('qualifications-euro-m',2000,'international'),
('qualifications-euro-m',2004,'international'),
('qualifications-euro-m',2008,'international'),
('qualifications-euro-m',2012,'international'),
('qualifications-euro-m',2020,'international'),
('qualifications-euro-m',2024,'international'),
('ligue-des-nations-m',2018,'international'),
('ligue-des-nations-m',2020,'international'),
('ligue-des-nations-m',2022,'international'),
('ligue-des-nations-m',2024,'international'),
('coupe-confederations',2001,'international'),
('coupe-confederations',2003,'international'),
('artemio-franchi',1985,'international'),
('tournoi-france-m',1988,'international'),
('tournoi-france-m',1997,'international'),
('tournoi-koweit',1990,'international'),
('kirin-cup',1994,'international'),
('tournoi-hassan-ii',1998,'international'),
('tournoi-hassan-ii',2000,'international'),
('nelson-mandela-challenge',2000,'international'),
('jeux-olympiques-m',1908,'olympique-u23'),
('jeux-olympiques-m',1920,'olympique-u23'),
('jeux-olympiques-m',1924,'olympique-u23'),
('jeux-olympiques-m',1928,'olympique-u23'),
('jeux-olympiques-m',1948,'olympique-u23'),
('jeux-olympiques-m',1952,'olympique-u23'),
('jeux-olympiques-m',1960,'olympique-u23'),
('jeux-olympiques-m',1968,'olympique-u23'),
('jeux-olympiques-m',1976,'olympique-u23'),
('jeux-olympiques-m',1984,'olympique-u23'),
('jeux-olympiques-m',1996,'olympique-u23'),
('jeux-olympiques-m',2020,'olympique-u23'),
('jeux-olympiques-m',2024,'olympique-u23'),
('qualifications-olympiques-historiques',1960,'olympique-u23'),
('qualifications-olympiques-historiques',1964,'olympique-u23'),
('qualifications-olympiques-historiques',1968,'olympique-u23'),
('qualifications-olympiques-historiques',1972,'olympique-u23'),
('qualifications-olympiques-historiques',1976,'olympique-u23'),
('qualifications-olympiques-historiques',1980,'olympique-u23'),
('qualifications-olympiques-historiques',1984,'olympique-u23'),
('qualifications-olympiques-historiques',1988,'olympique-u23'),
('euro-u21',1982,'espoirs'),
('euro-u21',1984,'espoirs'),
('euro-u21',1986,'espoirs'),
('euro-u21',1988,'espoirs'),
('euro-u21',1994,'espoirs'),
('euro-u21',1996,'espoirs'),
('euro-u21',2002,'espoirs'),
('euro-u21',2006,'espoirs'),
('euro-u21',2019,'espoirs'),
('euro-u21',2021,'espoirs'),
('euro-u21',2023,'espoirs'),
('euro-u21',2025,'espoirs'),
('qualifications-euro-u21',1978,'espoirs'),
('qualifications-euro-u21',1980,'espoirs'),
('qualifications-euro-u21',1982,'espoirs'),
('qualifications-euro-u21',1984,'espoirs'),
('qualifications-euro-u21',1986,'espoirs'),
('qualifications-euro-u21',1988,'espoirs'),
('qualifications-euro-u21',1990,'espoirs'),
('qualifications-euro-u21',1992,'espoirs'),
('qualifications-euro-u21',1994,'espoirs'),
('qualifications-euro-u21',1996,'espoirs'),
('qualifications-euro-u21',1998,'espoirs'),
('qualifications-euro-u21',2000,'espoirs'),
('qualifications-euro-u21',2002,'espoirs'),
('qualifications-euro-u21',2004,'espoirs'),
('qualifications-euro-u21',2006,'espoirs'),
('qualifications-euro-u21',2007,'espoirs'),
('qualifications-euro-u21',2009,'espoirs'),
('qualifications-euro-u21',2011,'espoirs'),
('qualifications-euro-u21',2013,'espoirs'),
('qualifications-euro-u21',2015,'espoirs'),
('qualifications-euro-u21',2017,'espoirs'),
('qualifications-euro-u21',2019,'espoirs'),
('qualifications-euro-u21',2021,'espoirs'),
('qualifications-euro-u21',2023,'espoirs'),
('qualifications-euro-u21',2025,'espoirs'),
('qualifications-euro-u21',2027,'espoirs'),
('coupe-du-monde-u20-m',1977,'u20'),
('coupe-du-monde-u20-m',1997,'u20'),
('coupe-du-monde-u20-m',2001,'u20'),
('coupe-du-monde-u20-m',2011,'u20'),
('coupe-du-monde-u20-m',2013,'u20'),
('coupe-du-monde-u20-m',2017,'u20'),
('coupe-du-monde-u20-m',2019,'u20'),
('coupe-du-monde-u20-m',2023,'u20'),
('coupe-du-monde-u20-m',2025,'u20'),
('euro-u19-m',2003,'u19'),
('euro-u19-m',2005,'u19'),
('euro-u19-m',2007,'u19'),
('euro-u19-m',2009,'u19'),
('euro-u19-m',2010,'u19'),
('euro-u19-m',2012,'u19'),
('euro-u19-m',2013,'u19'),
('euro-u19-m',2015,'u19'),
('euro-u19-m',2016,'u19'),
('euro-u19-m',2018,'u19'),
('euro-u19-m',2019,'u19'),
('euro-u19-m',2022,'u19'),
('euro-u19-m',2024,'u19'),
('qualifications-euro-u19-m',2002,'u19'),
('qualifications-euro-u19-m',2003,'u19'),
('qualifications-euro-u19-m',2004,'u19'),
('qualifications-euro-u19-m',2005,'u19'),
('qualifications-euro-u19-m',2006,'u19'),
('qualifications-euro-u19-m',2007,'u19'),
('qualifications-euro-u19-m',2008,'u19'),
('qualifications-euro-u19-m',2009,'u19'),
('qualifications-euro-u19-m',2011,'u19'),
('qualifications-euro-u19-m',2012,'u19'),
('qualifications-euro-u19-m',2013,'u19'),
('qualifications-euro-u19-m',2014,'u19'),
('qualifications-euro-u19-m',2015,'u19'),
('qualifications-euro-u19-m',2016,'u19'),
('qualifications-euro-u19-m',2017,'u19'),
('qualifications-euro-u19-m',2018,'u19'),
('qualifications-euro-u19-m',2019,'u19'),
('qualifications-euro-u19-m',2020,'u19'),
('qualifications-euro-u19-m',2022,'u19'),
('qualifications-euro-u19-m',2023,'u19'),
('qualifications-euro-u19-m',2024,'u19'),
('qualifications-euro-u19-m',2025,'u19'),
('qualifications-euro-u19-m',2026,'u19'),
('qualifications-euro-u19-m',2027,'u18'),
('limoges-lafarge',2007,'u18'),
('limoges-lafarge',2008,'u18'),
('limoges-lafarge',2009,'u18'),
('limoges-lafarge',2010,'u18'),
('limoges-lafarge',2011,'u18'),
('limoges-lafarge',2012,'u18'),
('limoges-lafarge',2013,'u18'),
('limoges-lafarge',2014,'u18'),
('limoges-lafarge',2015,'u18'),
('limoges-lafarge',2016,'u18'),
('limoges-lafarge',2017,'u18'),
('limoges-lafarge',2018,'u18'),
('limoges-lafarge',2019,'u18'),
('limoges-lafarge',2021,'u18'),
('limoges-lafarge',2022,'u18'),
('limoges-lafarge',2023,'u18'),
('limoges-lafarge',2024,'u18'),
('limoges-lafarge',2025,'u18'),
('limoges-lafarge',2026,'u18'),
('tournoi-porto-u18',2017,'u18'),
('tournoi-porto-u18',2018,'u18'),
('tournoi-porto-u18',2019,'u18'),
('tournoi-porto-u18',2025,'u18'),
('uefa-friendship-cup',2025,'u18'),
('euro-u17-m',2002,'u17'),
('euro-u17-m',2004,'u17'),
('euro-u17-m',2007,'u17'),
('euro-u17-m',2008,'u17'),
('euro-u17-m',2009,'u17'),
('euro-u17-m',2010,'u17'),
('euro-u17-m',2011,'u17'),
('euro-u17-m',2012,'u17'),
('euro-u17-m',2015,'u17'),
('euro-u17-m',2016,'u17'),
('euro-u17-m',2017,'u17'),
('euro-u17-m',2019,'u17'),
('euro-u17-m',2022,'u17'),
('euro-u17-m',2023,'u17'),
('euro-u17-m',2024,'u17'),
('euro-u17-m',2025,'u17'),
('euro-u17-m',2026,'u17'),
('qualifications-euro-u17-m',2002,'u17'),
('qualifications-euro-u17-m',2003,'u17'),
('qualifications-euro-u17-m',2005,'u17'),
('qualifications-euro-u17-m',2006,'u17'),
('qualifications-euro-u17-m',2007,'u17'),
('qualifications-euro-u17-m',2008,'u17'),
('qualifications-euro-u17-m',2009,'u17'),
('qualifications-euro-u17-m',2010,'u17'),
('qualifications-euro-u17-m',2011,'u17'),
('qualifications-euro-u17-m',2012,'u17'),
('qualifications-euro-u17-m',2013,'u17'),
('qualifications-euro-u17-m',2014,'u17'),
('qualifications-euro-u17-m',2015,'u17'),
('qualifications-euro-u17-m',2016,'u17'),
('qualifications-euro-u17-m',2017,'u17'),
('qualifications-euro-u17-m',2018,'u17'),
('qualifications-euro-u17-m',2019,'u17'),
('qualifications-euro-u17-m',2020,'u17'),
('qualifications-euro-u17-m',2022,'u17'),
('qualifications-euro-u17-m',2023,'u17'),
('qualifications-euro-u17-m',2024,'u17'),
('qualifications-euro-u17-m',2025,'u17'),
('qualifications-euro-u17-m',2026,'u17'),
('coupe-du-monde-u17-m',1987,'u17'),
('coupe-du-monde-u17-m',2001,'u17'),
('coupe-du-monde-u17-m',2007,'u17'),
('coupe-du-monde-u17-m',2011,'u17'),
('coupe-du-monde-u17-m',2015,'u17'),
('coupe-du-monde-u17-m',2017,'u17'),
('coupe-du-monde-u17-m',2019,'u17'),
('coupe-du-monde-u17-m',2023,'u17'),
('coupe-du-monde-u17-m',2025,'u17'),
('mondial-montaigu-m',1976,'u16'),
('mondial-montaigu-m',1977,'u16'),
('mondial-montaigu-m',1978,'u16'),
('mondial-montaigu-m',1979,'u16'),
('mondial-montaigu-m',1980,'u16'),
('mondial-montaigu-m',1981,'u16'),
('mondial-montaigu-m',1982,'u16'),
('mondial-montaigu-m',1983,'u16'),
('mondial-montaigu-m',1984,'u16'),
('mondial-montaigu-m',1985,'u16'),
('mondial-montaigu-m',1986,'u16'),
('mondial-montaigu-m',1987,'u16'),
('mondial-montaigu-m',1988,'u16'),
('mondial-montaigu-m',1989,'u16'),
('mondial-montaigu-m',1990,'u16'),
('mondial-montaigu-m',1991,'u16'),
('mondial-montaigu-m',1992,'u16'),
('mondial-montaigu-m',1993,'u16'),
('mondial-montaigu-m',1994,'u16'),
('mondial-montaigu-m',1995,'u16'),
('mondial-montaigu-m',1996,'u16'),
('mondial-montaigu-m',1997,'u16'),
('mondial-montaigu-m',1998,'u16'),
('mondial-montaigu-m',1999,'u16'),
('mondial-montaigu-m',2000,'u16'),
('mondial-montaigu-m',2001,'u16'),
('mondial-montaigu-m',2002,'u16'),
('mondial-montaigu-m',2003,'u16'),
('mondial-montaigu-m',2004,'u16'),
('mondial-montaigu-m',2005,'u16'),
('mondial-montaigu-m',2006,'u16'),
('mondial-montaigu-m',2007,'u16'),
('mondial-montaigu-m',2008,'u16'),
('mondial-montaigu-m',2009,'u16'),
('mondial-montaigu-m',2010,'u16'),
('mondial-montaigu-m',2011,'u16'),
('mondial-montaigu-m',2012,'u16'),
('mondial-montaigu-m',2013,'u16'),
('mondial-montaigu-m',2014,'u16'),
('mondial-montaigu-m',2015,'u16'),
('mondial-montaigu-m',2016,'u16'),
('mondial-montaigu-m',2017,'u16'),
('mondial-montaigu-m',2018,'u16'),
('mondial-montaigu-m',2019,'u16'),
('mondial-montaigu-m',2021,'u16'),
('mondial-montaigu-m',2022,'u16'),
('mondial-montaigu-m',2023,'u16'),
('mondial-montaigu-m',2024,'u16'),
('mondial-montaigu-m',2025,'u16'),
('mondial-montaigu-m',2026,'u16'),
('val-de-marne',1999,'u16'),
('val-de-marne',2000,'u16'),
('val-de-marne',2001,'u16'),
('val-de-marne',2002,'u16'),
('val-de-marne',2003,'u16'),
('val-de-marne',2004,'u16'),
('val-de-marne',2005,'u16'),
('val-de-marne',2006,'u16'),
('val-de-marne',2007,'u16'),
('val-de-marne',2008,'u16'),
('val-de-marne',2009,'u16'),
('val-de-marne',2010,'u16'),
('val-de-marne',2011,'u16'),
('val-de-marne',2012,'u16'),
('val-de-marne',2013,'u16'),
('val-de-marne',2014,'u16'),
('val-de-marne',2015,'u16'),
('val-de-marne',2016,'u16'),
('val-de-marne',2017,'u16'),
('val-de-marne',2018,'u16'),
('val-de-marne',2019,'u16'),
('val-de-marne',2021,'u16'),
('val-de-marne',2022,'u16'),
('val-de-marne',2023,'u16'),
('val-de-marne',2024,'u16'),
('val-de-marne',2025,'u16'),
('dream-cup',2015,'u16'),
('dream-cup',2025,'u16'),
('dream-cup',2026,'u16'),
('aegean-cup',2009,'u16'),
('aegean-cup',2010,'u16'),
('aegean-cup',2011,'u16'),
('aegean-cup',2012,'u16'),
('aegean-cup',2013,'u16'),
('aegean-cup',2014,'u16'),
('aegean-cup',2015,'u16'),
('maurice-revello',2025,'u20'),
('jeux-mediterraneens-m',1993,'u21-m-historique'),
('jeux-mediterraneens-m',1993,'espoirs'),
('jeux-mediterraneens-m',2018,'u18'),
('jeux-mediterraneens-m',2022,'u18'),
('coupe-du-monde-fifa-f',2003,'internationale-f'),
('coupe-du-monde-fifa-f',2011,'internationale-f'),
('coupe-du-monde-fifa-f',2015,'internationale-f'),
('coupe-du-monde-fifa-f',2019,'internationale-f'),
('coupe-du-monde-fifa-f',2023,'internationale-f'),
('qualifications-coupe-du-monde-f',1999,'internationale-f'),
('qualifications-coupe-du-monde-f',2003,'internationale-f'),
('qualifications-coupe-du-monde-f',2007,'internationale-f'),
('qualifications-coupe-du-monde-f',2011,'internationale-f'),
('qualifications-coupe-du-monde-f',2015,'internationale-f'),
('qualifications-coupe-du-monde-f',2023,'internationale-f'),
('qualifications-coupe-du-monde-f',2027,'internationale-f'),
('euro-f',1997,'internationale-f'),
('euro-f',2001,'internationale-f'),
('euro-f',2005,'internationale-f'),
('euro-f',2009,'internationale-f'),
('euro-f',2013,'internationale-f'),
('euro-f',2017,'internationale-f'),
('euro-f',2022,'internationale-f'),
('euro-f',2025,'internationale-f'),
('qualifications-euro-f',1984,'internationale-f'),
('qualifications-euro-f',1987,'internationale-f'),
('qualifications-euro-f',1989,'internationale-f'),
('qualifications-euro-f',1991,'internationale-f'),
('qualifications-euro-f',1993,'internationale-f'),
('qualifications-euro-f',1995,'internationale-f'),
('qualifications-euro-f',1997,'internationale-f'),
('qualifications-euro-f',2001,'internationale-f'),
('qualifications-euro-f',2005,'internationale-f'),
('qualifications-euro-f',2009,'internationale-f'),
('qualifications-euro-f',2013,'internationale-f'),
('qualifications-euro-f',2017,'internationale-f'),
('qualifications-euro-f',2022,'internationale-f'),
('qualifications-euro-f',2025,'internationale-f'),
('ligue-des-nations-f',2023,'internationale-f'),
('ligue-des-nations-f',2025,'internationale-f'),
('jeux-olympiques-f',2012,'internationale-f'),
('jeux-olympiques-f',2016,'internationale-f'),
('jeux-olympiques-f',2024,'internationale-f'),
('tournoi-france-f',2020,'internationale-f'),
('tournoi-france-f',2022,'internationale-f'),
('tournoi-france-f',2023,'internationale-f'),
('shebelieves-cup',2016,'internationale-f'),
('shebelieves-cup',2017,'internationale-f'),
('shebelieves-cup',2018,'internationale-f'),
('algarve-cup',2003,'internationale-f'),
('algarve-cup',2004,'internationale-f'),
('algarve-cup',2005,'internationale-f'),
('algarve-cup',2006,'internationale-f'),
('algarve-cup',2007,'internationale-f'),
('algarve-cup',2015,'internationale-f'),
('cyprus-womens-cup',2009,'internationale-f'),
('cyprus-womens-cup',2012,'internationale-f'),
('cyprus-womens-cup',2014,'internationale-f'),
('mundialito-f',1988,'internationale-f'),
('four-nations-f',2006,'internationale-f'),
('istria-cup',2015,'equipe-b-f'),
('sud-ladies-cup',2018,'u20-feminin'),
('sud-ladies-cup',2019,'u20-feminin'),
('sud-ladies-cup',2022,'u20-feminin'),
('sud-ladies-cup',2023,'u19-feminin'),
('sud-ladies-cup',2024,'u20-feminin'),
('sud-ladies-cup',2025,'espoirs-f'),
('coupe-du-monde-u20-f',2002,'u19-feminin'),
('coupe-du-monde-u20-f',2006,'u20-feminin'),
('coupe-du-monde-u20-f',2008,'u20-feminin'),
('coupe-du-monde-u20-f',2010,'u20-feminin'),
('coupe-du-monde-u20-f',2014,'u20-feminin'),
('coupe-du-monde-u20-f',2016,'u20-feminin'),
('coupe-du-monde-u20-f',2018,'u20-feminin'),
('coupe-du-monde-u20-f',2022,'u20-feminin'),
('coupe-du-monde-u20-f',2024,'u20-feminin'),
('coupe-du-monde-u20-f',2026,'u20-feminin'),
('nike-international-friendlies-f',2019,'u20-feminin'),
('euro-u19-f',1998,'u18-feminin'),
('euro-u19-f',2000,'u18-feminin'),
('euro-u19-f',2002,'u19-feminin'),
('euro-u19-f',2003,'u19-feminin'),
('euro-u19-f',2004,'u19-feminin'),
('euro-u19-f',2005,'u19-feminin'),
('euro-u19-f',2006,'u19-feminin'),
('euro-u19-f',2007,'u19-feminin'),
('euro-u19-f',2008,'u19-feminin'),
('euro-u19-f',2009,'u19-feminin'),
('euro-u19-f',2010,'u19-feminin'),
('euro-u19-f',2013,'u19-feminin'),
('euro-u19-f',2015,'u19-feminin'),
('euro-u19-f',2016,'u19-feminin'),
('euro-u19-f',2017,'u19-feminin'),
('euro-u19-f',2018,'u19-feminin'),
('euro-u19-f',2019,'u19-feminin'),
('euro-u19-f',2022,'u19-feminin'),
('euro-u19-f',2023,'u19-feminin'),
('euro-u19-f',2024,'u19-feminin'),
('euro-u19-f',2025,'u19-feminin'),
('qualifications-euro-u19-f',2002,'u19-feminin'),
('qualifications-euro-u19-f',2003,'u19-feminin'),
('qualifications-euro-u19-f',2004,'u19-feminin'),
('qualifications-euro-u19-f',2005,'u19-feminin'),
('qualifications-euro-u19-f',2006,'u19-feminin'),
('qualifications-euro-u19-f',2007,'u19-feminin'),
('qualifications-euro-u19-f',2009,'u19-feminin'),
('qualifications-euro-u19-f',2010,'u19-feminin'),
('qualifications-euro-u19-f',2011,'u19-feminin'),
('qualifications-euro-u19-f',2012,'u19-feminin'),
('qualifications-euro-u19-f',2013,'u19-feminin'),
('qualifications-euro-u19-f',2014,'u19-feminin'),
('qualifications-euro-u19-f',2015,'u19-feminin'),
('qualifications-euro-u19-f',2016,'u19-feminin'),
('qualifications-euro-u19-f',2017,'u19-feminin'),
('qualifications-euro-u19-f',2018,'u19-feminin'),
('qualifications-euro-u19-f',2019,'u19-feminin'),
('qualifications-euro-u19-f',2020,'u19-feminin'),
('qualifications-euro-u19-f',2022,'u19-feminin'),
('qualifications-euro-u19-f',2023,'u19-feminin'),
('qualifications-euro-u19-f',2024,'u19-feminin'),
('qualifications-euro-u19-f',2025,'u19-feminin'),
('qualifications-euro-u19-f',2026,'u19-feminin'),
('euro-u17-f',2008,'u17-feminin'),
('euro-u17-f',2009,'u17-feminin'),
('euro-u17-f',2011,'u17-feminin'),
('euro-u17-f',2012,'u17-feminin'),
('euro-u17-f',2014,'u17-feminin'),
('euro-u17-f',2015,'u17-feminin'),
('euro-u17-f',2017,'u17-feminin'),
('euro-u17-f',2022,'u17-feminin'),
('euro-u17-f',2023,'u17-feminin'),
('euro-u17-f',2024,'u17-feminin'),
('euro-u17-f',2025,'u17-feminin'),
('euro-u17-f',2026,'u17-feminin'),
('qualifications-euro-u17-f',2008,'u17-feminin'),
('qualifications-euro-u17-f',2009,'u17-feminin'),
('qualifications-euro-u17-f',2010,'u17-feminin'),
('qualifications-euro-u17-f',2011,'u17-feminin'),
('qualifications-euro-u17-f',2012,'u17-feminin'),
('qualifications-euro-u17-f',2013,'u17-feminin'),
('qualifications-euro-u17-f',2014,'u17-feminin'),
('qualifications-euro-u17-f',2015,'u17-feminin'),
('qualifications-euro-u17-f',2016,'u17-feminin'),
('qualifications-euro-u17-f',2017,'u17-feminin'),
('qualifications-euro-u17-f',2018,'u17-feminin'),
('qualifications-euro-u17-f',2019,'u17-feminin'),
('qualifications-euro-u17-f',2020,'u17-feminin'),
('qualifications-euro-u17-f',2022,'u17-feminin'),
('qualifications-euro-u17-f',2023,'u17-feminin'),
('qualifications-euro-u17-f',2024,'u17-feminin'),
('qualifications-euro-u17-f',2025,'u17-feminin'),
('qualifications-euro-u17-f',2026,'u17-feminin'),
('coupe-du-monde-u17-f',2008,'u17-feminin'),
('coupe-du-monde-u17-f',2012,'u17-feminin'),
('coupe-du-monde-u17-f',2022,'u17-feminin'),
('coupe-du-monde-u17-f',2025,'u17-feminin'),
('mondial-montaigu-f',2019,'u16-feminin'),
('mondial-montaigu-f',2022,'u16-feminin'),
('mondial-montaigu-f',2023,'u16-feminin'),
('mondial-montaigu-f',2024,'u16-feminin'),
('mondial-montaigu-f',2025,'u16-feminin'),
('mondial-montaigu-f',2026,'u16-feminin')
) v(entity_slug,edition_year,tag_slug) join public.competition_entities ce on ce.slug=v.entity_slug join public.competition_editions ed on ed.competition_entity_id=ce.id and ed.edition_year=v.edition_year join public.tags t on t.slug=v.tag_slug on conflict do nothing;
commit;


-- Durcissement post-audit Supabase V1.1.61.
alter function public.football_position_key(text) set search_path=public;
create index if not exists competition_entities_competition_tag_idx on public.competition_entities(competition_tag_id);

drop policy if exists football_positions_edit on public.football_positions;
create policy football_positions_insert on public.football_positions for insert to authenticated with check(public.can_edit());
create policy football_positions_update on public.football_positions for update to authenticated using(public.can_edit()) with check(public.can_edit());
create policy football_positions_delete on public.football_positions for delete to authenticated using(public.can_edit());

drop policy if exists competition_entities_edit on public.competition_entities;
create policy competition_entities_insert on public.competition_entities for insert to authenticated with check(public.can_edit());
create policy competition_entities_update on public.competition_entities for update to authenticated using(public.can_edit()) with check(public.can_edit());
create policy competition_entities_delete on public.competition_entities for delete to authenticated using(public.can_edit());

drop policy if exists competition_editions_edit on public.competition_editions;
create policy competition_editions_insert on public.competition_editions for insert to authenticated with check(public.can_edit());
create policy competition_editions_update on public.competition_editions for update to authenticated using(public.can_edit()) with check(public.can_edit());
create policy competition_editions_delete on public.competition_editions for delete to authenticated using(public.can_edit());

drop policy if exists competition_entity_tags_edit on public.competition_entity_tags;
create policy competition_entity_tags_insert on public.competition_entity_tags for insert to authenticated with check(public.can_edit());
create policy competition_entity_tags_update on public.competition_entity_tags for update to authenticated using(public.can_edit()) with check(public.can_edit());
create policy competition_entity_tags_delete on public.competition_entity_tags for delete to authenticated using(public.can_edit());

drop policy if exists competition_edition_tags_edit on public.competition_edition_tags;
create policy competition_edition_tags_insert on public.competition_edition_tags for insert to authenticated with check(public.can_edit());
create policy competition_edition_tags_update on public.competition_edition_tags for update to authenticated using(public.can_edit()) with check(public.can_edit());
create policy competition_edition_tags_delete on public.competition_edition_tags for delete to authenticated using(public.can_edit());

-- Backfill des libellés de poste déjà présents sur les feuilles de match.
update public.match_appearances set position=position where nullif(trim(coalesce(position,'')),'') is not null;


-- === MIGRATION_V1.1.61.5_PLAYER_POSITION_TAG_SYNC.sql ============================================================

-- 3615 Bleus V1.1.61.5 — synchronisation fiche joueur ↔ tags de poste
-- Déjà appliquée au projet Supabase bleus3000 le 25/09/2026.

create or replace function public.sync_player_position_tags(p_player_id uuid)
returns void
language plpgsql
security invoker
set search_path=public
as $$
begin
  if p_player_id is null then return; end if;
  insert into public.entity_tags(entity_type,entity_id,tag_id,added_by)
  select 'player',p_player_id,fp.tag_id,null::uuid
  from public.match_appearances ma join public.football_positions fp on fp.id=ma.position_id
  where ma.player_id=p_player_id group by fp.tag_id
  on conflict(entity_type,entity_id,tag_id) do nothing;

  insert into public.entity_tags(entity_type,entity_id,tag_id,added_by)
  select distinct 'player',p_player_id,fp.tag_id,null::uuid
  from public.players p
  join public.football_positions fp on
       public.football_position_key(p.primary_position)=public.football_position_key(fp.label_text)
    or exists(select 1 from unnest(fp.aliases) a where public.football_position_key(p.primary_position)=public.football_position_key(a))
    or exists(select 1 from unnest(coalesce(p.secondary_positions,array[]::text[])) sp where public.football_position_key(sp)=public.football_position_key(fp.label_text) or exists(select 1 from unnest(fp.aliases) a where public.football_position_key(sp)=public.football_position_key(a)))
  where p.id=p_player_id
  on conflict(entity_type,entity_id,tag_id) do nothing;

  delete from public.entity_tags et using public.tags t
  where et.entity_type='player' and et.entity_id=p_player_id and et.tag_id=t.id and t.reference_scope='position'
    and not exists(select 1 from public.match_appearances ma join public.football_positions fp on fp.id=ma.position_id where ma.player_id=p_player_id and fp.tag_id=et.tag_id)
    and not exists(select 1 from public.players p join public.football_positions fp on fp.tag_id=et.tag_id where p.id=p_player_id and (public.football_position_key(p.primary_position)=public.football_position_key(fp.label_text) or exists(select 1 from unnest(fp.aliases) a where public.football_position_key(p.primary_position)=public.football_position_key(a)) or exists(select 1 from unnest(coalesce(p.secondary_positions,array[]::text[])) sp where public.football_position_key(sp)=public.football_position_key(fp.label_text) or exists(select 1 from unnest(fp.aliases) a where public.football_position_key(sp)=public.football_position_key(a)))));
end
$$;

create or replace function public.sync_player_position_tags_from_player()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  perform public.sync_player_position_tags(new.id);
  return new;
end
$$;

drop trigger if exists trg_players_sync_position_tags on public.players;
create trigger trg_players_sync_position_tags
after insert or update of primary_position,secondary_positions on public.players
for each row execute function public.sync_player_position_tags_from_player();


-- === MIGRATION_V1.1.61.7_COMPETITION_FAMILIES.sql ============================================================

-- 3615 Bleus V1.1.61.7 — familles d'affichage des compétitions
-- Migration déjà appliquée au projet Supabase bleus3000 le 25/09/2026.

create table if not exists public.competition_families(
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  aliases text[] not null default '{}',
  competition_type text,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competition_family_entities(
  family_id uuid not null references public.competition_families(id) on delete cascade,
  competition_entity_id uuid not null references public.competition_entities(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(family_id,competition_entity_id),
  unique(competition_entity_id)
);

create index if not exists competition_family_entities_entity_idx on public.competition_family_entities(competition_entity_id);

alter table public.competition_families enable row level security;
alter table public.competition_family_entities enable row level security;

-- Lecture publique ; écriture réservée aux comptes autorisés via can_edit().
drop policy if exists competition_families_public_read on public.competition_families;
create policy competition_families_public_read on public.competition_families for select to anon,authenticated using(true);
drop policy if exists competition_families_insert on public.competition_families;
create policy competition_families_insert on public.competition_families for insert to authenticated with check(public.can_edit());
drop policy if exists competition_families_update on public.competition_families;
create policy competition_families_update on public.competition_families for update to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists competition_families_delete on public.competition_families;
create policy competition_families_delete on public.competition_families for delete to authenticated using(public.can_edit());

drop policy if exists competition_family_entities_public_read on public.competition_family_entities;
create policy competition_family_entities_public_read on public.competition_family_entities for select to anon,authenticated using(true);
drop policy if exists competition_family_entities_insert on public.competition_family_entities;
create policy competition_family_entities_insert on public.competition_family_entities for insert to authenticated with check(public.can_edit());
drop policy if exists competition_family_entities_update on public.competition_family_entities;
create policy competition_family_entities_update on public.competition_family_entities for update to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists competition_family_entities_delete on public.competition_family_entities;
create policy competition_family_entities_delete on public.competition_family_entities for delete to authenticated using(public.can_edit());

grant select on public.competition_families,public.competition_family_entities to anon,authenticated;
grant insert,update,delete on public.competition_families,public.competition_family_entities to authenticated;

-- Les données de regroupement ont été injectées avec la migration de production :
-- EURO (7 entités), Qualifications EURO (7), Coupe du monde (6), Qualifications Coupe du monde (2),
-- Jeux Olympiques (2), Ligue des Nations (2), Tournoi de France (2), Mondial de Montaigu (2),
-- puis une famille autonome pour chaque autre entité canonique.


-- === MIGRATION_V1.1.61.8_PLAYER_FAVORITES.sql ============================================================

-- 3615 Bleus V1.1.61.8 — favoris joueurs du profil (maximum 10)
create table if not exists public.user_player_favorites(
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,player_id)
);
create index if not exists user_player_favorites_player_idx on public.user_player_favorites(player_id);
alter table public.user_player_favorites enable row level security;
drop policy if exists user_player_favorites_select_own on public.user_player_favorites;
create policy user_player_favorites_select_own on public.user_player_favorites for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists user_player_favorites_insert_own on public.user_player_favorites;
create policy user_player_favorites_insert_own on public.user_player_favorites for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists user_player_favorites_delete_own on public.user_player_favorites;
create policy user_player_favorites_delete_own on public.user_player_favorites for delete to authenticated using(user_id=(select auth.uid()));
grant select,insert,delete on public.user_player_favorites to authenticated;
create or replace function public.enforce_player_favorites_limit() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.user_id <> auth.uid() then raise exception 'Favori non autorisé pour ce profil'; end if;
  if (select count(*) from public.user_player_favorites where user_id=new.user_id) >= 10 then raise exception 'Maximum de 10 joueurs favoris atteint'; end if;
  return new;
end $$;
drop trigger if exists trg_user_player_favorites_limit on public.user_player_favorites;
create trigger trg_user_player_favorites_limit before insert on public.user_player_favorites for each row execute function public.enforce_player_favorites_limit();


-- === MIGRATION_V1.1.61.9_HOME_CALENDAR_PIN.sql ============================================================

-- 3615 Bleus V1.1.61.9 — épinglage d'un match en tête du calendrier d'accueil
begin;

alter table public.matches
  add column if not exists homepage_pinned boolean not null default false,
  add column if not exists homepage_pinned_at timestamptz,
  add column if not exists homepage_pinned_by uuid references public.profiles(id) on delete set null;

create index if not exists matches_homepage_pinned_idx
  on public.matches(homepage_pinned, homepage_pinned_at)
  where homepage_pinned = true;

create index if not exists matches_homepage_pinned_by_idx
  on public.matches(homepage_pinned_by);

create or replace function public.normalize_homepage_match_pin()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_status text := upper(coalesce(new.status,''));
begin
  if v_status = any(array['FT','MATCH FINISHED','FINISHED','COMPLETED','AET','PEN','AFTER PENALTIES']) then
    new.homepage_pinned := false;
    new.homepage_pinned_at := null;
    new.homepage_pinned_by := null;
    return new;
  end if;

  if new.homepage_pinned = true
     and (
       tg_op = 'INSERT'
       or old.homepage_pinned is distinct from true
       or old.homepage_pinned_at is null
     ) then
    update public.matches
       set homepage_pinned=false,
           homepage_pinned_at=null,
           homepage_pinned_by=null,
           updated_at=now()
     where id is distinct from new.id
       and homepage_pinned=true;

    new.homepage_pinned_at := now();
    new.homepage_pinned_by := auth.uid();
  elsif new.homepage_pinned = false then
    new.homepage_pinned_at := null;
    new.homepage_pinned_by := null;
  end if;

  return new;
end
$$;

drop trigger if exists trg_matches_homepage_pin on public.matches;
create trigger trg_matches_homepage_pin
before insert or update of homepage_pinned,status
on public.matches
for each row
execute function public.normalize_homepage_match_pin();

with ranked as (
  select id,
         row_number() over(order by homepage_pinned_at desc nulls last, updated_at desc) as rn
  from public.matches
  where homepage_pinned=true
)
update public.matches m
set homepage_pinned=false,homepage_pinned_at=null,homepage_pinned_by=null
from ranked r
where m.id=r.id and r.rn>1;

comment on column public.matches.homepage_pinned is
'Match forcé en première position du bloc Prochains matchs tant qu’il n’est pas terminé.';
comment on column public.matches.homepage_pinned_at is
'Date d’épinglage du match en tête de la page d’accueil.';
comment on column public.matches.homepage_pinned_by is
'Éditeur ayant épinglé le match en tête de la page d’accueil.';

commit;


-- === MIGRATION_V1.1.61.12_EQUIPEMENTIERS.sql ============================================================

-- 3615 Bleus V1.1.61.12 — Référentiel relationnel des équipementiers
begin;

alter table public.tags drop constraint if exists tags_reference_scope_check;
alter table public.tags add constraint tags_reference_scope_check
check (
  reference_scope is null
  or reference_scope = any(array[
    'selection','competition','broadcast','general','position','equipment'
  ]::text[])
);

create table if not exists public.equipment_manufacturers(
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  aliases text[] not null default '{}',
  tag_id uuid references public.tags(id) on delete set null,
  website_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_manufacturers_tag_idx on public.equipment_manufacturers(tag_id);
alter table public.equipment_manufacturers enable row level security;

drop policy if exists equipment_manufacturers_read on public.equipment_manufacturers;
create policy equipment_manufacturers_read on public.equipment_manufacturers for select to anon,authenticated using(true);
drop policy if exists equipment_manufacturers_insert on public.equipment_manufacturers;
create policy equipment_manufacturers_insert on public.equipment_manufacturers for insert to authenticated with check(public.can_edit());
drop policy if exists equipment_manufacturers_update on public.equipment_manufacturers;
create policy equipment_manufacturers_update on public.equipment_manufacturers for update to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists equipment_manufacturers_delete on public.equipment_manufacturers;
create policy equipment_manufacturers_delete on public.equipment_manufacturers for delete to authenticated using(public.can_edit());

grant select on public.equipment_manufacturers to anon,authenticated;
grant insert,update,delete on public.equipment_manufacturers to authenticated;

alter table public.jerseys add column if not exists manufacturer_id uuid references public.equipment_manufacturers(id) on delete set null;
create index if not exists jerseys_manufacturer_id_idx on public.jerseys(manufacturer_id);

-- Convertit automatiquement les anciens libellés texte d'équipementier en entités + tags.
insert into public.tags(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope)
select
  'equipment-'||trim(both '-' from regexp_replace(translate(lower(trim(j.manufacturer)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','-','g')),
  'tag',left(trim(j.manufacturer),40),'👕',array[trim(j.manufacturer)],'solid','#ffffff','#ffffff',array['#ffffff'],'#123b8f','#c8d8eb',0,10,1,null::uuid,true,'equipment'
from public.jerseys j
where nullif(trim(coalesce(j.manufacturer,'')),'') is not null
group by trim(j.manufacturer)
on conflict(slug) do update set label_text=excluded.label_text,aliases=excluded.aliases,reference_scope='equipment',is_active=true,updated_at=now();

insert into public.equipment_manufacturers(slug,name,aliases,tag_id)
select
  trim(both '-' from regexp_replace(translate(lower(trim(j.manufacturer)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','-','g')),
  trim(j.manufacturer),array[trim(j.manufacturer)],t.id
from public.jerseys j
join public.tags t on t.slug='equipment-'||trim(both '-' from regexp_replace(translate(lower(trim(j.manufacturer)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','-','g'))
where nullif(trim(coalesce(j.manufacturer,'')),'') is not null
group by trim(j.manufacturer),t.id
on conflict(name) do update set tag_id=excluded.tag_id,aliases=excluded.aliases,updated_at=now();

update public.jerseys j
set manufacturer_id=e.id
from public.equipment_manufacturers e
where j.manufacturer_id is null and lower(trim(coalesce(j.manufacturer,'')))=lower(trim(e.name));

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select e.tag_id,'equipment',e.id,'membership',null::uuid
from public.equipment_manufacturers e
where e.tag_id is not null
on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;

create or replace function public.sync_jersey_manufacturer_text()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.manufacturer_id is not null then
    select name into new.manufacturer from public.equipment_manufacturers where id=new.manufacturer_id;
  elsif nullif(trim(coalesce(new.manufacturer,'')),'') is null then
    new.manufacturer:=null;
  end if;
  return new;
end
$$;

drop trigger if exists trg_jerseys_sync_manufacturer on public.jerseys;
create trigger trg_jerseys_sync_manufacturer before insert or update of manufacturer_id,manufacturer on public.jerseys
for each row execute function public.sync_jersey_manufacturer_text();

comment on table public.equipment_manufacturers is 'Référentiel des équipementiers de maillots ; chaque équipementier peut utiliser un tag avec logo.';
comment on column public.jerseys.manufacturer_id is 'Équipementier relationnel du maillot. Le champ manufacturer reste synchronisé pour compatibilité.';

commit;

-- ============================================================================
-- V1.1.61.17 — FEUILLES VALIDÉES = SOURCE UNIQUE DES STATISTIQUES SPORTIVES
-- ============================================================================
begin;

alter table public.matches
  add column if not exists sheet_validation_status text not null default 'draft',
  add column if not exists sheet_validated_at timestamptz,
  add column if not exists sheet_validated_by uuid references public.profiles(id) on delete set null,
  add column if not exists sheet_validation_revision integer not null default 0,
  add column if not exists sheet_stadium_name text,
  add column if not exists sheet_referee_name text,
  add column if not exists sheet_coach_name text,
  add column if not exists sheet_competition_name text,
  add column if not exists sheet_competition_family_id uuid references public.competition_families(id) on delete set null;

alter table public.matches drop constraint if exists matches_sheet_validation_status_check;
alter table public.matches add constraint matches_sheet_validation_status_check
check (sheet_validation_status = any(array['draft','needs_validation','validated']::text[]));
create index if not exists matches_sheet_competition_family_idx on public.matches(sheet_competition_family_id);

alter table public.match_appearances
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists player_name text,
  add column if not exists appeared boolean not null default false,
  add column if not exists replaced_by_player_id uuid references public.players(id) on delete set null,
  add column if not exists replaced_by_name text;

update public.match_appearances ma set player_name=p.display_name
from public.players p
where ma.player_id=p.id and nullif(trim(coalesce(ma.player_name,'')),'') is null;
update public.match_appearances set id=gen_random_uuid() where id is null;

alter table public.match_appearances drop constraint if exists match_appearances_pkey;
alter table public.match_appearances alter column id set not null;
alter table public.match_appearances alter column player_id drop not null;
alter table public.match_appearances add constraint match_appearances_pkey primary key(id);
alter table public.match_appearances drop constraint if exists match_appearances_match_player_key;
alter table public.match_appearances add constraint match_appearances_match_player_key unique(match_id,player_id);
create index if not exists match_appearances_match_idx on public.match_appearances(match_id);
create index if not exists match_appearances_replaced_by_idx on public.match_appearances(replaced_by_player_id);

create table if not exists public.validated_match_player_stats(
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  selection_id uuid not null references public.selection_teams(id) on delete cascade,
  appeared boolean not null default false,
  starter boolean not null default false,
  minutes integer,
  goals integer not null default 0,
  shirt_number integer,
  position_id uuid references public.football_positions(id) on delete set null,
  position_text text,
  captain boolean not null default false,
  result_code text,
  validated_at timestamptz not null default now(),
  primary key(match_id,player_id),
  check(result_code is null or result_code=any(array['V','N','D']::text[]))
);
create index if not exists validated_match_player_stats_player_idx on public.validated_match_player_stats(player_id,selection_id);
create index if not exists validated_match_player_stats_position_idx on public.validated_match_player_stats(position_id);
alter table public.validated_match_player_stats enable row level security;
drop policy if exists validated_match_player_stats_read on public.validated_match_player_stats;
create policy validated_match_player_stats_read on public.validated_match_player_stats for select to anon,authenticated using(true);
drop policy if exists validated_match_player_stats_insert on public.validated_match_player_stats;
create policy validated_match_player_stats_insert on public.validated_match_player_stats for insert to authenticated with check(public.can_edit());
drop policy if exists validated_match_player_stats_update on public.validated_match_player_stats;
create policy validated_match_player_stats_update on public.validated_match_player_stats for update to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists validated_match_player_stats_delete on public.validated_match_player_stats;
create policy validated_match_player_stats_delete on public.validated_match_player_stats for delete to authenticated using(public.can_edit());
grant select on public.validated_match_player_stats to anon,authenticated;
grant insert,update,delete on public.validated_match_player_stats to authenticated;

create or replace function public.sheet_name_key(p_value text)
returns text language sql immutable parallel safe set search_path=public as $$
  select regexp_replace(
    translate(lower(trim(coalesce(p_value,''))),
      'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+','','g'
  )
$$;

create or replace function public.resolve_or_create_sheet_player(p_name text,p_gender text,p_selection_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_name text:=trim(coalesce(p_name,''));v_key text;v_id uuid;v_tag uuid;v_slug text;
begin
  if v_name='' then return null; end if;
  v_key:=public.sheet_name_key(v_name);
  select p.id into v_id from public.players p
  where public.sheet_name_key(p.display_name)=v_key and (p_gender is null or p.gender=p_gender)
  order by p.active desc,p.created_at asc limit 1;
  if v_id is null then
    v_id:=gen_random_uuid();
    v_slug:=trim(both '-' from regexp_replace(lower(v_name),'[^a-z0-9]+','-','g'))||'-'||substr(v_id::text,1,8);
    insert into public.players(id,display_name,last_name,gender,france_eligibility,active,active_source,name_normalized,profile_slug,data_status)
    values(v_id,v_name,v_name,coalesce(nullif(p_gender,''),'M'),true,true,true,lower(v_name),v_slug,'validated_match_sheet');
  end if;
  if p_selection_id is not null then
    insert into public.player_selection_stats(player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,appearance_status,data_status,updated_at)
    values(v_id,p_selection_id,0,0,0,0,0,0,0,'called_only','sheet_rebuild_pending',now())
    on conflict(player_id,selection_id) do nothing;
    select team_tag_id into v_tag from public.selection_teams where id=p_selection_id;
    if v_tag is not null then
      insert into public.entity_tags(entity_type,entity_id,tag_id,added_by)
      values('player',v_id,v_tag,null::uuid) on conflict(entity_type,entity_id,tag_id) do nothing;
    end if;
  end if;
  return v_id;
end
$$;
revoke all on function public.resolve_or_create_sheet_player(text,text,uuid) from public,anon,authenticated;

create or replace function public.resolve_or_create_sheet_personnel(p_name text,p_type text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  if nullif(trim(coalesce(p_name,'')),'') is null then return null; end if;
  select id into v_id from public.personnel
  where person_type=p_type and public.sheet_name_key(display_name)=public.sheet_name_key(p_name)
  order by created_at limit 1;
  if v_id is null then insert into public.personnel(display_name,person_type,active) values(trim(p_name),p_type,true) returning id into v_id; end if;
  return v_id;
end
$$;

create or replace function public.resolve_or_create_sheet_place(p_name text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  if nullif(trim(coalesce(p_name,'')),'') is null then return null; end if;
  select id into v_id from public.places
  where place_type='stadium' and public.sheet_name_key(name)=public.sheet_name_key(p_name)
  order by created_at limit 1;
  if v_id is null then insert into public.places(place_type,name) values('stadium',trim(p_name)) returning id into v_id; end if;
  return v_id;
end
$$;

create or replace function public.refresh_player_from_validated_sheets(p_player_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_cap_id uuid;
begin
  if p_player_id is null then return; end if;
  update public.player_selection_stats set selections=0,goals=0,wins=0,draws=0,losses=0,starts=0,minutes=0,data_status='validated_match_sheets',updated_at=now() where player_id=p_player_id;
  insert into public.player_selection_stats(player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,appearance_status,first_year,last_year,first_selection_date,data_status,updated_at)
  select s.player_id,s.selection_id,count(*) filter(where s.appeared)::integer,coalesce(sum(s.goals),0)::integer,
    count(*) filter(where s.result_code='V')::integer,count(*) filter(where s.result_code='N')::integer,count(*) filter(where s.result_code='D')::integer,
    count(*) filter(where s.starter)::integer,coalesce(sum(s.minutes),0)::integer,'capped',min(extract(year from m.match_date))::integer,max(extract(year from m.match_date))::integer,min(m.match_date)::date,'validated_match_sheets',now()
  from public.validated_match_player_stats s join public.matches m on m.id=s.match_id
  where s.player_id=p_player_id and s.appeared=true group by s.player_id,s.selection_id
  on conflict(player_id,selection_id) do update set selections=excluded.selections,goals=excluded.goals,wins=excluded.wins,draws=excluded.draws,losses=excluded.losses,starts=excluded.starts,minutes=excluded.minutes,appearance_status='capped',first_year=excluded.first_year,last_year=excluded.last_year,first_selection_date=excluded.first_selection_date,data_status='validated_match_sheets',updated_at=now();
  delete from public.player_jersey_numbers where player_id=p_player_id;
  insert into public.player_jersey_numbers(player_id,selection_id,shirt_number,first_match_date,last_match_date,appearances_count,notes_short)
  select s.player_id,s.selection_id,s.shirt_number,min(m.match_date)::date,max(m.match_date)::date,count(*)::integer,'Calculé depuis les feuilles de match validées.'
  from public.validated_match_player_stats s join public.matches m on m.id=s.match_id
  where s.player_id=p_player_id and s.appeared=true and s.shirt_number is not null group by s.player_id,s.selection_id,s.shirt_number;
  update public.players set
    primary_position=(select coalesce(fp.label_text,s.position_text) from public.validated_match_player_stats s left join public.football_positions fp on fp.id=s.position_id join public.matches m on m.id=s.match_id where s.player_id=p_player_id and s.appeared=true and coalesce(fp.label_text,s.position_text) is not null group by coalesce(fp.label_text,s.position_text) order by count(*) desc,min(m.match_date),coalesce(fp.label_text,s.position_text) limit 1),
    secondary_positions=coalesce((select array_agg(x.label order by x.n desc,x.first_seen,x.label) from (select coalesce(fp.label_text,s.position_text) label,count(*) n,min(m.match_date) first_seen from public.validated_match_player_stats s left join public.football_positions fp on fp.id=s.position_id join public.matches m on m.id=s.match_id where s.player_id=p_player_id and s.appeared=true and coalesce(fp.label_text,s.position_text) is not null group by coalesce(fp.label_text,s.position_text)) x where x.label is distinct from (select coalesce(fp2.label_text,s2.position_text) from public.validated_match_player_stats s2 left join public.football_positions fp2 on fp2.id=s2.position_id join public.matches m2 on m2.id=s2.match_id where s2.player_id=p_player_id and s2.appeared=true and coalesce(fp2.label_text,s2.position_text) is not null group by coalesce(fp2.label_text,s2.position_text) order by count(*) desc,min(m2.match_date),coalesce(fp2.label_text,s2.position_text) limit 1)),array[]::text[]),updated_at=now()
  where id=p_player_id;
  delete from public.entity_tags et using public.tags t where et.entity_type='player' and et.entity_id=p_player_id and et.tag_id=t.id and t.reference_scope='position';
  insert into public.entity_tags(entity_type,entity_id,tag_id,added_by)
  select distinct 'player',s.player_id,fp.tag_id,null::uuid from public.validated_match_player_stats s join public.football_positions fp on fp.id=s.position_id where s.player_id=p_player_id and s.appeared=true on conflict(entity_type,entity_id,tag_id) do nothing;
  select id into v_cap_id from public.achievements where slug='capitanat';
  if v_cap_id is not null then
    delete from public.player_achievements where player_id=p_player_id and achievement_id=v_cap_id;
    insert into public.player_achievements(player_id,selection_id,achievement_id,achievement_value,notes_short,added_by)
    select s.player_id,s.selection_id,v_cap_id,count(*)::integer,'Calculé depuis les feuilles de match validées.',auth.uid()
    from public.validated_match_player_stats s where s.player_id=p_player_id and s.captain=true and s.appeared=true group by s.player_id,s.selection_id
    on conflict(player_id,achievement_id,selection_id) do update set achievement_value=excluded.achievement_value,notes_short=excluded.notes_short;
  end if;
end
$$;
revoke all on function public.refresh_player_from_validated_sheets(uuid) from public,anon,authenticated;

create or replace function public.refresh_validated_player_stats(p_player_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.can_edit() then raise exception 'Modification non autorisée'; end if;
  perform public.refresh_player_from_validated_sheets(p_player_id);
end
$$;
revoke all on function public.refresh_validated_player_stats(uuid) from public,anon;
grant execute on function public.refresh_validated_player_stats(uuid) to authenticated;

create or replace function public.sync_player_position_tags(p_player_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if p_player_id is null then return; end if;
  delete from public.entity_tags et using public.tags t where et.entity_type='player' and et.entity_id=p_player_id and et.tag_id=t.id and t.reference_scope='position';
  insert into public.entity_tags(entity_type,entity_id,tag_id,added_by)
  select distinct 'player',p_player_id,fp.tag_id,null::uuid from public.validated_match_player_stats vs join public.football_positions fp on fp.id=vs.position_id where vs.player_id=p_player_id and vs.appeared=true on conflict(entity_type,entity_id,tag_id) do nothing;
end
$$;

create or replace function public.mark_match_sheet_child_dirty()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_match_id uuid;
begin
  v_match_id:=case when tg_op='DELETE' then old.match_id else new.match_id end;
  update public.matches set sheet_validation_status=case when sheet_validation_status='validated' then 'needs_validation' else sheet_validation_status end,updated_at=now() where id=v_match_id;
  return case when tg_op='DELETE' then old else new end;
end
$$;
drop trigger if exists trg_match_appearances_sheet_dirty on public.match_appearances;
create trigger trg_match_appearances_sheet_dirty after insert or update or delete on public.match_appearances for each row execute function public.mark_match_sheet_child_dirty();
drop trigger if exists trg_match_goals_sheet_dirty on public.match_goal_events;
create trigger trg_match_goals_sheet_dirty after insert or update or delete on public.match_goal_events for each row execute function public.mark_match_sheet_child_dirty();
drop trigger if exists trg_match_cards_sheet_dirty on public.match_card_events;
create trigger trg_match_cards_sheet_dirty after insert or update or delete on public.match_card_events for each row execute function public.mark_match_sheet_child_dirty();

create or replace function public.mark_match_sheet_match_dirty()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if old.sheet_validation_status='validated' and (old.france_score is distinct from new.france_score or old.opponent_score is distinct from new.opponent_score or old.selection_team_id is distinct from new.selection_team_id or old.competition_id is distinct from new.competition_id or old.place_id is distinct from new.place_id or old.coach_id is distinct from new.coach_id) then new.sheet_validation_status:='needs_validation'; end if;
  return new;
end
$$;
drop trigger if exists trg_matches_sheet_dirty on public.matches;
create trigger trg_matches_sheet_dirty before update of france_score,opponent_score,selection_team_id,competition_id,place_id,coach_id on public.matches for each row execute function public.mark_match_sheet_match_dirty();

-- La V1.1.61.17 repart volontairement de zéro pour ces seuls agrégats.
update public.player_selection_stats set selections=0,goals=0,wins=0,draws=0,losses=0,starts=0,minutes=0,data_status='sheet_rebuild_pending',updated_at=now();
delete from public.player_jersey_numbers;
delete from public.player_achievements where achievement_id in(select id from public.achievements where slug='capitanat');
update public.players set primary_position=null,secondary_positions=array[]::text[],updated_at=now();
delete from public.entity_tags et using public.tags t where et.tag_id=t.id and et.entity_type='player' and t.reference_scope='position';

commit;


-- ============================================================================
-- V1.1.61.18 — MATCH SHEET UX / FORMATIONS / DROITS ADMIN
-- ============================================================================
begin;

alter table public.matches add column if not exists sheet_formation text;
alter table public.match_appearances add column if not exists lineup_slot integer;
create index if not exists match_appearances_lineup_slot_idx on public.match_appearances(match_id,starter,lineup_slot);

create or replace function public.can_edit() returns boolean
language sql stable security definer set search_path=public as $$
  select public.current_role() in ('admin','superadmin')
$$;

create or replace function public.can_edit_selections() returns boolean
language sql stable security definer set search_path=public as $$
  select public.current_role() in ('admin','superadmin')
$$;

create or replace function public.can_contribute() returns boolean
language sql stable security definer set search_path=public as $$
  select public.current_role() in ('admin','superadmin')
$$;

comment on column public.matches.sheet_formation is 'Formation tactique de la feuille de match, conservée pour rendu futur et statistiques de schéma.';
comment on column public.match_appearances.lineup_slot is 'Ordre/slot de la composition, utilisé pour reconstruire le schéma tactique.';

create or replace function public.mark_match_sheet_child_dirty()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_match_id uuid;
begin
  if tg_op='UPDATE' and new is not distinct from old then return new; end if;
  v_match_id:=case when tg_op='DELETE' then old.match_id else new.match_id end;
  update public.matches
  set sheet_validation_status=case when sheet_validation_status='validated' then 'needs_validation' else sheet_validation_status end,updated_at=now()
  where id=v_match_id;
  return case when tg_op='DELETE' then old else new end;
end
$$;

commit;


-- V1.1.61.20 — FINALISATION FRANCE A MASCULINE UNIQUEMENT
-- Le projet 3615 Bleus ne publie plus que la sélection FRA-A-M.
DO $$
DECLARE v_a uuid;
DECLARE v_tag uuid;
BEGIN
  SELECT id,team_tag_id INTO v_a,v_tag FROM public.selection_teams WHERE code='FRA-A-M' LIMIT 1;
  IF v_a IS NOT NULL THEN
    DELETE FROM public.calendar_events WHERE NOT (gender='M' AND selection_category='A');
    DELETE FROM public.callups WHERE NOT (gender='M' AND selection_category='A');
    DELETE FROM public.kits WHERE NOT (gender='M' AND selection_category='A');
    DELETE FROM public.matches WHERE NOT (gender='M' AND selection_category='A');
    DELETE FROM public.selection_teams WHERE id<>v_a;
    DELETE FROM public.tags WHERE reference_scope='selection' AND id<>v_tag AND upper(label_text)<>'VENU SANS JOUER';
  END IF;
END $$;

-- V1.1.61.20 — PURGE CANONIQUE A-ONLY POUR INSTALLATION NEUVE
-- À ce stade FRA-A-M est la seule sélection active conservée.
BEGIN;

CREATE TEMP TABLE _a_keep_players ON COMMIT DROP AS
SELECT DISTINCT player_id AS id FROM public.player_selection_stats pss
JOIN public.selection_teams st ON st.id=pss.selection_id AND st.code='FRA-A-M'
UNION
SELECT DISTINCT ma.player_id FROM public.match_appearances ma
JOIN public.matches m ON m.id=ma.match_id
WHERE m.gender='M' AND m.selection_category='A' AND ma.player_id IS NOT NULL
UNION
SELECT id FROM public.players WHERE gender='M' AND senior_a_called=true;

DELETE FROM public.players WHERE id NOT IN (SELECT id FROM _a_keep_players);

CREATE TEMP TABLE _a_keep_entities ON COMMIT DROP AS
SELECT DISTINCT cet.competition_entity_id AS id
FROM public.competition_entity_tags cet
JOIN public.selection_teams st ON st.team_tag_id=cet.tag_id AND st.code='FRA-A-M'
UNION
SELECT DISTINCT c.canonical_entity_id FROM public.competitions c
JOIN public.matches m ON m.competition_id=c.id
WHERE m.gender='M' AND m.selection_category='A' AND c.canonical_entity_id IS NOT NULL;

CREATE TEMP TABLE _a_keep_editions ON COMMIT DROP AS
SELECT DISTINCT cet.competition_edition_id AS id
FROM public.competition_edition_tags cet
JOIN public.selection_teams st ON st.team_tag_id=cet.tag_id AND st.code='FRA-A-M'
UNION
SELECT ce.id FROM public.competition_editions ce WHERE ce.competition_entity_id IN (SELECT id FROM _a_keep_entities);

CREATE TEMP TABLE _a_keep_families ON COMMIT DROP AS
SELECT DISTINCT family_id AS id FROM public.competition_family_entities
WHERE competition_entity_id IN (SELECT id FROM _a_keep_entities);

DELETE FROM public.competitions
WHERE NOT (gender='M' AND selection_category='A')
  AND id NOT IN (SELECT DISTINCT competition_id FROM public.matches WHERE competition_id IS NOT NULL);
DELETE FROM public.competition_family_entities
WHERE competition_entity_id NOT IN (SELECT id FROM _a_keep_entities)
   OR family_id NOT IN (SELECT id FROM _a_keep_families);
DELETE FROM public.competition_editions WHERE id NOT IN (SELECT id FROM _a_keep_editions);
DELETE FROM public.competition_entities WHERE id NOT IN (SELECT id FROM _a_keep_entities);
DELETE FROM public.competition_families WHERE id NOT IN (SELECT id FROM _a_keep_families);

DELETE FROM public.opponents o
WHERE NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.opponent_id=o.id);
DELETE FROM public.places p
WHERE NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.place_id=p.id)
  AND NOT EXISTS (SELECT 1 FROM public.callups c WHERE c.place_id=p.id);
DELETE FROM public.personnel p
WHERE NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.coach_id=p.id)
  AND NOT EXISTS (SELECT 1 FROM public.match_officials mo WHERE mo.person_id=p.id)
  AND NOT EXISTS (SELECT 1 FROM public.callups c WHERE c.coach_id=p.id);

DELETE FROM public.jerseys j
WHERE NOT EXISTS (
  SELECT 1 FROM public.jersey_selection_teams jst
  JOIN public.selection_teams st ON st.id=jst.selection_team_id
  WHERE jst.jersey_id=j.id AND st.code='FRA-A-M'
)
AND NOT EXISTS (
  SELECT 1 FROM public.match_jerseys mj
  JOIN public.matches m ON m.id=mj.match_id
  WHERE mj.jersey_id=j.id AND m.gender='M' AND m.selection_category='A'
);

DELETE FROM public.broadcast_channels bc
WHERE NOT EXISTS (
  SELECT 1 FROM public.match_broadcast_channels mbc
  JOIN public.matches m ON m.id=mbc.match_id
  WHERE mbc.broadcast_channel_id=bc.id AND m.gender='M' AND m.selection_category='A'
);

DELETE FROM public.player_match_performances pmp
WHERE NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id=pmp.player_id);
DELETE FROM public.ladder_snapshots ls
WHERE NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id=ls.player_id);
DELETE FROM public.entity_sources es
WHERE (es.entity_type='player' AND NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id=es.entity_id))
   OR (es.entity_type='match' AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id=es.entity_id))
   OR (es.entity_type='personnel' AND NOT EXISTS (SELECT 1 FROM public.personnel p WHERE p.id=es.entity_id))
   OR (es.entity_type='selection' AND NOT EXISTS (SELECT 1 FROM public.selection_teams st WHERE st.id=es.entity_id));
DELETE FROM public.entity_sources WHERE field_scope='France Espoirs · statistiques';
DELETE FROM public.sources s WHERE NOT EXISTS (SELECT 1 FROM public.entity_sources es WHERE es.source_id=s.id);

UPDATE public.players
SET external_ids=external_ids-'u17_source_id'-'u17_source_url'-'espoirs_player_id'
WHERE external_ids ? 'u17_source_id' OR external_ids ? 'u17_source_url' OR external_ids ? 'espoirs_player_id';

COMMIT;

-- ============================================================
-- V1.1.61.22 — RASSEMBLEMENTS FRANCE A
-- ============================================================
BEGIN;

ALTER TABLE public.callups
  ADD COLUMN IF NOT EXISTS selection_team_id uuid REFERENCES public.selection_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS calendar_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE public.callups DROP CONSTRAINT IF EXISTS callups_status_check;
ALTER TABLE public.callups ADD CONSTRAINT callups_status_check
CHECK (status = ANY(ARRAY['planned','announced','closed','cancelled']::text[]));

UPDATE public.callups
SET selection_team_id=(SELECT id FROM public.selection_teams WHERE code='FRA-A-M' LIMIT 1)
WHERE selection_team_id IS NULL AND gender='M' AND selection_category='A';

CREATE INDEX IF NOT EXISTS callups_selection_team_idx ON public.callups(selection_team_id);
CREATE INDEX IF NOT EXISTS callups_announcement_date_idx ON public.callups(announcement_date);
CREATE INDEX IF NOT EXISTS callups_start_date_idx ON public.callups(start_date);

ALTER TABLE public.callup_players
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes_short text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.callup_players DROP CONSTRAINT IF EXISTS callup_players_status_check;
ALTER TABLE public.callup_players ADD CONSTRAINT callup_players_status_check
CHECK (status = ANY(ARRAY['called','withdrawn','replacement','reserve']::text[]));

CREATE INDEX IF NOT EXISTS callup_players_player_idx ON public.callup_players(player_id);
CREATE INDEX IF NOT EXISTS callup_players_status_idx ON public.callup_players(callup_id,status);

CREATE TABLE IF NOT EXISTS public.callup_matches(
  callup_id uuid NOT NULL REFERENCES public.callups(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(callup_id,match_id),
  UNIQUE(match_id)
);

ALTER TABLE public.callup_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS callup_matches_read ON public.callup_matches;
CREATE POLICY callup_matches_read ON public.callup_matches
FOR SELECT TO anon,authenticated USING(true);
DROP POLICY IF EXISTS callup_matches_insert ON public.callup_matches;
CREATE POLICY callup_matches_insert ON public.callup_matches
FOR INSERT TO authenticated WITH CHECK((SELECT public.can_edit()));
DROP POLICY IF EXISTS callup_matches_update ON public.callup_matches;
CREATE POLICY callup_matches_update ON public.callup_matches
FOR UPDATE TO authenticated USING((SELECT public.can_edit())) WITH CHECK((SELECT public.can_edit()));
DROP POLICY IF EXISTS callup_matches_delete ON public.callup_matches;
CREATE POLICY callup_matches_delete ON public.callup_matches
FOR DELETE TO authenticated USING((SELECT public.can_edit()));

GRANT SELECT ON public.callup_matches TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.callup_matches TO authenticated;

CREATE INDEX IF NOT EXISTS callup_matches_match_idx ON public.callup_matches(match_id);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_callup_unique
ON public.calendar_events(callup_id)
WHERE callup_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_gathering_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=public
AS $$
DECLARE
  v_date date;
  v_event_ts timestamptz;
  v_subtitle text;
BEGIN
  DELETE FROM public.calendar_events WHERE callup_id=new.id;
  IF coalesce(new.calendar_visible,true)=false OR new.status='cancelled' THEN RETURN new; END IF;
  v_date:=coalesce(new.announcement_date,new.start_date,new.end_date);
  IF v_date IS NULL THEN RETURN new; END IF;
  v_event_ts := (v_date::timestamp + time '12:00') AT TIME ZONE 'Europe/Paris';
  v_subtitle := CASE WHEN new.announcement_date IS NOT NULL THEN 'Annonce de la liste · France A masculine' ELSE 'Rassemblement · France A masculine' END;
  INSERT INTO public.calendar_events(event_date,event_type,title,subtitle,gender,selection_category,callup_id,competition_id,place_id,updated_at)
  VALUES(v_event_ts,'gathering',new.title,v_subtitle,'M','A',new.id,new.competition_id,new.place_id,now());
  RETURN new;
END
$$;

DROP TRIGGER IF EXISTS trg_callups_calendar_sync ON public.callups;
CREATE TRIGGER trg_callups_calendar_sync
AFTER INSERT OR UPDATE OF title,announcement_date,start_date,end_date,status,calendar_visible,competition_id,place_id
ON public.callups
FOR EACH ROW EXECUTE FUNCTION public.sync_gathering_calendar_event();

COMMIT;


-- ============================================================
-- V1.1.61.23 — Photo en match des Internationaux A
-- ============================================================
alter table public.players
  add column if not exists action_photo_path text;
comment on column public.players.action_photo_path is
  'Photo du joueur en match, utilisée comme fond visuel de la fiche joueur déployée.';

-- ============================================================
-- V1.1.61.24 — SMART SEARCH · indexation et sémantique des buts
-- ============================================================
create index if not exists match_goal_events_player_match_idx
  on public.match_goal_events(player_id,match_id);
create index if not exists match_goal_events_assist_match_idx
  on public.match_goal_events(assist_player_id,match_id);
create index if not exists match_card_events_player_match_idx
  on public.match_card_events(player_id,match_id);
create index if not exists match_appearances_player_match_idx
  on public.match_appearances(player_id,match_id);
create index if not exists match_appearances_replacement_match_idx
  on public.match_appearances(replaced_by_player_id,match_id);

alter table public.match_goal_events
  add column if not exists goal_type text,
  add column if not exists body_part text,
  add column if not exists is_penalty boolean not null default false,
  add column if not exists is_own_goal boolean not null default false;

alter table public.match_goal_events drop constraint if exists match_goal_events_goal_type_check;
alter table public.match_goal_events add constraint match_goal_events_goal_type_check
check (goal_type is null or goal_type = any(array['open_play','header','free_kick','penalty','other']::text[]));

alter table public.match_goal_events drop constraint if exists match_goal_events_body_part_check;
alter table public.match_goal_events add constraint match_goal_events_body_part_check
check (body_part is null or body_part = any(array['right_foot','left_foot','head','other']::text[]));

create index if not exists match_goal_events_type_idx on public.match_goal_events(goal_type);
create index if not exists match_goal_events_body_part_idx on public.match_goal_events(body_part);

comment on column public.match_goal_events.goal_type is 'Type de but : jeu, tête, coup franc, penalty ou autre.';
comment on column public.match_goal_events.body_part is 'Partie du corps utilisée pour marquer.';

-- ============================================================
-- V1.1.61.25 — Mode Formation / schémas tactiques
-- ============================================================
create table if not exists public.tactical_formations(
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tactical_formation_slots(
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.tactical_formations(id) on delete cascade,
  slot_number integer not null check(slot_number between 1 and 11),
  position_id uuid not null references public.football_positions(id) on delete restrict,
  x numeric(5,2) not null check(x between 0 and 100),
  y numeric(5,2) not null check(y between 0 and 100),
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(formation_id,slot_number)
);

alter table public.matches
  add column if not exists sheet_formation_id uuid references public.tactical_formations(id) on delete set null,
  add column if not exists sheet_formation_snapshot jsonb;

create index if not exists matches_sheet_formation_id_idx on public.matches(sheet_formation_id);
create index if not exists tactical_formation_slots_formation_idx on public.tactical_formation_slots(formation_id,slot_number);

alter table public.tactical_formations enable row level security;
alter table public.tactical_formation_slots enable row level security;

drop policy if exists tactical_formations_read on public.tactical_formations;
create policy tactical_formations_read on public.tactical_formations for select to anon,authenticated using(true);
drop policy if exists tactical_formations_insert on public.tactical_formations;
create policy tactical_formations_insert on public.tactical_formations for insert to authenticated with check((select public.can_edit()));
drop policy if exists tactical_formations_update on public.tactical_formations;
create policy tactical_formations_update on public.tactical_formations for update to authenticated using((select public.can_edit())) with check((select public.can_edit()));
drop policy if exists tactical_formations_delete on public.tactical_formations;
create policy tactical_formations_delete on public.tactical_formations for delete to authenticated using((select public.can_edit()));

drop policy if exists tactical_formation_slots_read on public.tactical_formation_slots;
create policy tactical_formation_slots_read on public.tactical_formation_slots for select to anon,authenticated using(true);
drop policy if exists tactical_formation_slots_insert on public.tactical_formation_slots;
create policy tactical_formation_slots_insert on public.tactical_formation_slots for insert to authenticated with check((select public.can_edit()));
drop policy if exists tactical_formation_slots_update on public.tactical_formation_slots;
create policy tactical_formation_slots_update on public.tactical_formation_slots for update to authenticated using((select public.can_edit())) with check((select public.can_edit()));
drop policy if exists tactical_formation_slots_delete on public.tactical_formation_slots;
create policy tactical_formation_slots_delete on public.tactical_formation_slots for delete to authenticated using((select public.can_edit()));

grant select on public.tactical_formations,public.tactical_formation_slots to anon,authenticated;
grant insert,update,delete on public.tactical_formations,public.tactical_formation_slots to authenticated;

insert into public.tactical_formations(slug,name,is_default,is_active,is_system,sort_order)
values
 ('4-3-3','4-3-3',true,true,true,10),
 ('4-4-2','4-4-2',false,true,true,20),
 ('4-2-3-1','4-2-3-1',false,true,true,30),
 ('3-5-2','3-5-2',false,true,true,40),
 ('3-4-3','3-4-3',false,true,true,50),
 ('5-3-2','5-3-2',false,true,true,60),
 ('4-1-4-1','4-1-4-1',false,true,true,70)
on conflict(slug) do update set name=excluded.name,is_active=true,is_system=true,sort_order=excluded.sort_order;

with seed(formation_slug,slot_number,position_slug,x,y) as (
values
 ('4-3-3',1,'gardien',50,92),('4-3-3',2,'lateral-gauche',10,73),('4-3-3',3,'defenseur-central',36,73),('4-3-3',4,'defenseur-central',64,73),('4-3-3',5,'lateral-droit',90,73),('4-3-3',6,'milieu-central-8',19,49),('4-3-3',7,'milieu-defensif-6',50,49),('4-3-3',8,'milieu-central-8',81,49),('4-3-3',9,'ailier-gauche',19,24),('4-3-3',10,'avant-centre-9',50,24),('4-3-3',11,'ailier-droit',81,24),
 ('4-4-2',1,'gardien',50,92),('4-4-2',2,'lateral-gauche',10,73),('4-4-2',3,'defenseur-central',36,73),('4-4-2',4,'defenseur-central',64,73),('4-4-2',5,'lateral-droit',90,73),('4-4-2',6,'demi-gauche',10,49),('4-4-2',7,'milieu-central-8',36,49),('4-4-2',8,'milieu-central-8',64,49),('4-4-2',9,'demi-droit',90,49),('4-4-2',10,'avant-centre-9',32,24),('4-4-2',11,'deuxieme-attaquant',68,24),
 ('4-2-3-1',1,'gardien',50,92),('4-2-3-1',2,'lateral-gauche',10,76),('4-2-3-1',3,'defenseur-central',36,76),('4-2-3-1',4,'defenseur-central',64,76),('4-2-3-1',5,'lateral-droit',90,76),('4-2-3-1',6,'milieu-defensif-6',32,59),('4-2-3-1',7,'milieu-defensif-6',68,59),('4-2-3-1',8,'ailier-gauche',19,41),('4-2-3-1',9,'milieu-offensif-axial-10',50,41),('4-2-3-1',10,'ailier-droit',81,41),('4-2-3-1',11,'avant-centre-9',50,21),
 ('3-5-2',1,'gardien',50,92),('3-5-2',2,'defenseur-central',19,73),('3-5-2',3,'libero',50,73),('3-5-2',4,'defenseur-central',81,73),('3-5-2',5,'piston-gauche',9,49),('3-5-2',6,'milieu-central-8',29.5,49),('3-5-2',7,'milieu-defensif-6',50,49),('3-5-2',8,'milieu-central-8',70.5,49),('3-5-2',9,'piston-droit',91,49),('3-5-2',10,'avant-centre-9',32,24),('3-5-2',11,'deuxieme-attaquant',68,24),
 ('3-4-3',1,'gardien',50,92),('3-4-3',2,'defenseur-central',19,73),('3-4-3',3,'libero',50,73),('3-4-3',4,'defenseur-central',81,73),('3-4-3',5,'piston-gauche',10,49),('3-4-3',6,'milieu-central-8',36,49),('3-4-3',7,'milieu-central-8',64,49),('3-4-3',8,'piston-droit',90,49),('3-4-3',9,'ailier-gauche',19,24),('3-4-3',10,'avant-centre-9',50,24),('3-4-3',11,'ailier-droit',81,24),
 ('5-3-2',1,'gardien',50,92),('5-3-2',2,'lateral-gauche',9,73),('5-3-2',3,'defenseur-central',29.5,73),('5-3-2',4,'libero',50,73),('5-3-2',5,'defenseur-central',70.5,73),('5-3-2',6,'lateral-droit',91,73),('5-3-2',7,'milieu-central-8',19,49),('5-3-2',8,'milieu-defensif-6',50,49),('5-3-2',9,'milieu-central-8',81,49),('5-3-2',10,'avant-centre-9',32,24),('5-3-2',11,'deuxieme-attaquant',68,24),
 ('4-1-4-1',1,'gardien',50,92),('4-1-4-1',2,'lateral-gauche',10,76),('4-1-4-1',3,'defenseur-central',36,76),('4-1-4-1',4,'defenseur-central',64,76),('4-1-4-1',5,'lateral-droit',90,76),('4-1-4-1',6,'milieu-defensif-6',50,59),('4-1-4-1',7,'demi-gauche',10,41),('4-1-4-1',8,'milieu-central-8',36,41),('4-1-4-1',9,'milieu-central-8',64,41),('4-1-4-1',10,'demi-droit',90,41),('4-1-4-1',11,'avant-centre-9',50,21)
)
insert into public.tactical_formation_slots(formation_id,slot_number,position_id,x,y,label)
select f.id,s.slot_number,p.id,s.x,s.y,p.label_text
from seed s
join public.tactical_formations f on f.slug=s.formation_slug
join public.football_positions p on p.slug=s.position_slug
on conflict(formation_id,slot_number) do update set position_id=excluded.position_id,x=excluded.x,y=excluded.y,label=excluded.label,updated_at=now();
create unique index if not exists tactical_formations_one_default_idx on public.tactical_formations ((is_default)) where is_default=true;

-- 3615 Bleus V1.1.61.28 — tags Compétitions canoniques : ENTITÉ → ÉDITION
-- Règle métier :
--   • le tag ENTITÉ est le seul tag compétition visible sur les tuiles ;
--   • le tag ÉDITION est le lien technique précis pour matchs, feuilles de match, maillots, filtres et statistiques ;
--   • une édition hérite obligatoirement de son entité via tags.parent_tag_id ;
--   • les anciens tags compétition doublons sont réaffectés vers le tag canonique puis désactivés.

begin;

alter table public.tags
  add column if not exists competition_tag_level text,
  add column if not exists parent_tag_id uuid references public.tags(id) on delete set null;

alter table public.tags drop constraint if exists tags_competition_tag_level_check;
alter table public.tags add constraint tags_competition_tag_level_check
  check (competition_tag_level is null or competition_tag_level in ('entity','edition'));
create index if not exists tags_parent_tag_idx on public.tags(parent_tag_id);
create index if not exists tags_competition_level_idx on public.tags(competition_tag_level) where competition_tag_level is not null;

alter table public.competition_editions
  add column if not exists edition_tag_id uuid references public.tags(id) on delete set null;
create unique index if not exists competition_editions_edition_tag_uidx
  on public.competition_editions(edition_tag_id) where edition_tag_id is not null;

alter table public.tag_reference_links drop constraint if exists tag_reference_links_reference_type_check;
alter table public.tag_reference_links add constraint tag_reference_links_reference_type_check
check (reference_type in ('selection','competition','competition_entity','competition_edition','opponent','place','personnel','equipment','bibliography','match','callup','broadcast'));

create or replace function public.competition_tag_key(p_value text) returns text
language sql immutable parallel safe set search_path=public as $$
  select regexp_replace(
    translate(lower(coalesce(p_value,'')),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+','','g'
  )
$$;

-- Rapproche d'abord l'ancienne couche competitions avec les entités canoniques.
-- Priorité au tag déjà partagé, puis au nom / aux alias normalisés.
with candidates as (
  select c.id as competition_id,ce.id as entity_id,
         row_number() over(partition by c.id order by
           case when c.tag_id=ce.competition_tag_id then 0
                when public.competition_tag_key(c.name)=public.competition_tag_key(ce.name) then 1
                else 2 end,
           ce.created_at,ce.id) as rn
  from public.competitions c
  join public.competition_entities ce
    on (c.gender is null or ce.gender is null or c.gender=ce.gender)
   and (
     c.tag_id=ce.competition_tag_id
     or public.competition_tag_key(c.name)=public.competition_tag_key(ce.name)
     or exists(select 1 from unnest(coalesce(ce.aliases,array[]::text[])) a where public.competition_tag_key(c.name)=public.competition_tag_key(a))
   )
  where c.canonical_entity_id is null
)
update public.competitions c
set canonical_entity_id=x.entity_id,updated_at=now()
from candidates x
where x.rn=1 and c.id=x.competition_id;

-- Une ancienne compétition peut déjà représenter une édition qui n'existe pas encore dans le catalogue
-- (ex. "2026-2027"). On crée l'édition canonique à partir de la première année rencontrée.
with legacy_years as (
  select c.id,c.canonical_entity_id,c.edition,
         coalesce(
           nullif(substring(coalesce(c.edition,'') from '((?:19|20)[0-9]{2})'),'')::integer,
           extract(year from c.start_date)::integer,
           extract(year from min(m.match_date))::integer
         ) as edition_year
  from public.competitions c
  left join public.matches m on m.competition_id=c.id
  where c.canonical_entity_id is not null
  group by c.id,c.canonical_entity_id,c.edition,c.start_date
)
insert into public.competition_editions(competition_entity_id,edition_year,edition_label,notes)
select y.canonical_entity_id,y.edition_year,coalesce(nullif(y.edition,''),y.edition_year::text),'Édition raccordée automatiquement depuis la couche historique competitions.'
from legacy_years y
where y.edition_year is not null
on conflict(competition_entity_id,edition_year) do nothing;

with legacy_years as (
  select c.id,c.canonical_entity_id,
         coalesce(
           nullif(substring(coalesce(c.edition,'') from '((?:19|20)[0-9]{2})'),'')::integer,
           extract(year from c.start_date)::integer,
           extract(year from min(m.match_date))::integer
         ) as edition_year
  from public.competitions c
  left join public.matches m on m.competition_id=c.id
  where c.canonical_entity_id is not null
  group by c.id,c.canonical_entity_id,c.edition,c.start_date
)
update public.competitions c
set canonical_edition_id=ed.id,updated_at=now()
from legacy_years y
join public.competition_editions ed on ed.competition_entity_id=y.canonical_entity_id and ed.edition_year=y.edition_year
where c.id=y.id and c.canonical_edition_id is distinct from ed.id;

-- Les matchs historiques héritent immédiatement de l'édition canonique de leur ancienne compétition.
update public.matches m
set competition_edition_id=c.canonical_edition_id,updated_at=now()
from public.competitions c
where m.competition_id=c.id
  and c.canonical_edition_id is not null
  and m.competition_edition_id is distinct from c.canonical_edition_id;

-- Les tags portés par les entités canoniques deviennent explicitement des tags ENTITÉ.
update public.tags t
set reference_scope='competition', competition_tag_level='entity', parent_tag_id=null, is_active=true, updated_at=now()
from public.competition_entities ce
where ce.competition_tag_id=t.id
  and (t.reference_scope is distinct from 'competition' or t.competition_tag_level is distinct from 'entity' or t.parent_tag_id is not null or t.is_active is distinct from true);

-- Table temporaire de fusion : vieux tag compétition -> tag ENTITÉ canonique.
create temp table _competition_tag_merge(old_id uuid primary key,new_id uuid not null) on commit drop;

insert into _competition_tag_merge(old_id,new_id)
select distinct c.tag_id,ce.competition_tag_id
from public.competitions c
join public.competition_entities ce on ce.id=c.canonical_entity_id
where c.tag_id is not null and c.tag_id<>ce.competition_tag_id
on conflict(old_id) do update set new_id=excluded.new_id;

-- Complète la fusion pour les doublons ayant le même libellé / alias que l'entité canonique.
insert into _competition_tag_merge(old_id,new_id)
select distinct dup.id,ce.competition_tag_id
from public.tags dup
join public.competition_entities ce on dup.id<>ce.competition_tag_id
join public.tags canon on canon.id=ce.competition_tag_id
where dup.competition_tag_level is null
  and (
    public.competition_tag_key(dup.label_text)=public.competition_tag_key(canon.label_text)
    or public.competition_tag_key(dup.label_text)=public.competition_tag_key(ce.name)
    or exists(select 1 from unnest(coalesce(ce.aliases,array[]::text[])) a where public.competition_tag_key(a)=public.competition_tag_key(dup.label_text))
    or exists(select 1 from unnest(coalesce(dup.aliases,array[]::text[])) a where public.competition_tag_key(a)=public.competition_tag_key(ce.name))
    or exists(select 1 from unnest(coalesce(dup.aliases,array[]::text[])) da cross join unnest(coalesce(ce.aliases,array[]::text[])) ca where public.competition_tag_key(da)=public.competition_tag_key(ca))
  )
on conflict(old_id) do nothing;

-- Réécrit les tags génériques déjà posés sur des tuiles sans perdre la relation.
insert into public.entity_tags(entity_type,entity_id,tag_id,added_by,created_at)
select et.entity_type,et.entity_id,m.new_id,et.added_by,et.created_at
from public.entity_tags et join _competition_tag_merge m on m.old_id=et.tag_id
on conflict(entity_type,entity_id,tag_id) do nothing;
delete from public.entity_tags et using _competition_tag_merge m where et.tag_id=m.old_id;

-- Réécrit les associations Tags ↔ Référentiels.
insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by,created_at)
select m.new_id,l.reference_type,l.reference_id,l.relation_kind,l.created_by,l.created_at
from public.tag_reference_links l join _competition_tag_merge m on m.old_id=l.tag_id
on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;
delete from public.tag_reference_links l using _competition_tag_merge m where l.tag_id=m.old_id;

-- L'ancienne couche public.competitions pointe toujours vers le tag ENTITÉ canonique.
update public.competitions c
set tag_id=ce.competition_tag_id,updated_at=now()
from public.competition_entities ce
where c.canonical_entity_id=ce.id and c.tag_id is distinct from ce.competition_tag_id;

-- Les overrides historiques de matchs ne doivent plus ressusciter un doublon.
update public.matches m
set manual_overrides=jsonb_set(coalesce(m.manual_overrides,'{}'::jsonb),'{competition_tag_id}',to_jsonb(ce.competition_tag_id::text),true),updated_at=now()
from public.competitions c
join public.competition_entities ce on ce.id=c.canonical_entity_id
where m.competition_id=c.id
  and coalesce(m.manual_overrides,'{}'::jsonb) ? 'competition_tag_id'
  and (m.manual_overrides->>'competition_tag_id') is distinct from ce.competition_tag_id::text;

-- Garantit aussi les liens de l'ancienne couche vers le tag canonique.
delete from public.tag_reference_links l
using public.competitions c,public.competition_entities ce
where l.reference_type='competition' and l.reference_id=c.id and c.canonical_entity_id=ce.id and l.tag_id<>ce.competition_tag_id;
insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select ce.competition_tag_id,'competition',c.id,'membership',null::uuid
from public.competitions c join public.competition_entities ce on ce.id=c.canonical_entity_id
on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;

-- Métadonnées de liaison des tags ENTITÉ dans le gestionnaire de tags.
insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select ce.competition_tag_id,'competition_entity',ce.id,'membership',null::uuid
from public.competition_entities ce
on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;

-- Création déterministe d'un tag ÉDITION pour chaque édition canonique.
insert into public.tags(
  slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,
  gradient_angle,border_radius,border_width,created_by,is_active,reference_scope,competition_tag_level,parent_tag_id
)
select
  left('competition-edition-'||ce.slug||'-'||ed.edition_year::text,96),
  'tag',
  left(ce.name||' '||coalesce(nullif(ed.edition_label,''),ed.edition_year::text),40),
  coalesce(nullif(parent.icon_text,''),'🏆'),
  array[ce.name||' '||coalesce(nullif(ed.edition_label,''),ed.edition_year::text),ce.name,ed.edition_year::text],
  parent.appearance,parent.color_start,parent.color_end,parent.gradient_colors,parent.text_color,parent.border_color,
  parent.gradient_angle,parent.border_radius,parent.border_width,null::uuid,true,'competition','edition',ce.competition_tag_id
from public.competition_editions ed
join public.competition_entities ce on ce.id=ed.competition_entity_id
join public.tags parent on parent.id=ce.competition_tag_id
on conflict(slug) do update set
  reference_scope='competition',competition_tag_level='edition',parent_tag_id=excluded.parent_tag_id,is_active=true,
  aliases=(select coalesce(array_agg(distinct v order by v),array[]::text[]) from unnest(coalesce(public.tags.aliases,array[]::text[])||excluded.aliases) v),
  updated_at=now();

update public.competition_editions ed
set edition_tag_id=t.id,updated_at=now()
from public.competition_entities ce, public.tags t
where ed.competition_entity_id=ce.id
  and t.slug=left('competition-edition-'||ce.slug||'-'||ed.edition_year::text,96)
  and ed.edition_tag_id is distinct from t.id;

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select ed.edition_tag_id,'competition_edition',ed.id,'membership',null::uuid
from public.competition_editions ed where ed.edition_tag_id is not null
on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;

-- À l'avenir, toute nouvelle édition reçoit automatiquement son tag ÉDITION hérité du tag ENTITÉ.
create or replace function public.assign_competition_edition_tag() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  v_entity public.competition_entities%rowtype;
  v_parent public.tags%rowtype;
  v_tag uuid;
  v_slug text;
  v_full_label text;
begin
  select * into v_entity from public.competition_entities where id=new.competition_entity_id;
  if v_entity.id is null then return new; end if;
  select * into v_parent from public.tags where id=v_entity.competition_tag_id;
  if v_parent.id is null then return new; end if;
  v_slug:=left('competition-edition-'||v_entity.slug||'-'||new.edition_year::text,96);
  v_full_label:=v_entity.name||' '||coalesce(nullif(new.edition_label,''),new.edition_year::text);
  insert into public.tags(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope,competition_tag_level,parent_tag_id)
  values(v_slug,'tag',left(v_full_label,40),coalesce(nullif(v_parent.icon_text,''),'🏆'),array[v_full_label,v_entity.name,new.edition_year::text],v_parent.appearance,v_parent.color_start,v_parent.color_end,v_parent.gradient_colors,v_parent.text_color,v_parent.border_color,v_parent.gradient_angle,v_parent.border_radius,v_parent.border_width,null,true,'competition','edition',v_entity.competition_tag_id)
  on conflict(slug) do update set reference_scope='competition',competition_tag_level='edition',parent_tag_id=v_entity.competition_tag_id,is_active=true,updated_at=now()
  returning id into v_tag;
  new.edition_tag_id:=v_tag;
  return new;
end $$;

drop trigger if exists trg_competition_editions_assign_tag on public.competition_editions;
create trigger trg_competition_editions_assign_tag
before insert or update of competition_entity_id,edition_year,edition_label on public.competition_editions
for each row execute function public.assign_competition_edition_tag();

create or replace function public.sync_competition_tag_reference_links() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='competition_entities' then
    update public.tags set reference_scope='competition',competition_tag_level='entity',parent_tag_id=null,is_active=true,updated_at=now() where id=new.competition_tag_id;
    insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
    values(new.competition_tag_id,'competition_entity',new.id,'membership',null)
    on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;
  else
    if new.edition_tag_id is not null then
      insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
      values(new.edition_tag_id,'competition_edition',new.id,'membership',null)
      on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_competition_entities_tag_link on public.competition_entities;
create trigger trg_competition_entities_tag_link after insert or update of competition_tag_id on public.competition_entities
for each row execute function public.sync_competition_tag_reference_links();
drop trigger if exists trg_competition_editions_tag_link on public.competition_editions;
create trigger trg_competition_editions_tag_link after insert or update of edition_tag_id on public.competition_editions
for each row execute function public.sync_competition_tag_reference_links();

-- Ces fonctions sont réservées au moteur de triggers : pas d'appel direct via Data API.
revoke execute on function public.assign_competition_edition_tag() from public,anon,authenticated;
revoke execute on function public.sync_competition_tag_reference_links() from public,anon,authenticated;

-- Empêche l'ancienne table competitions de réintroduire un tag différent de celui de son entité canonique.
create or replace function public.sync_legacy_competition_entity_tag() returns trigger
language plpgsql security invoker set search_path=public as $$
declare v_tag uuid;
begin
  if new.canonical_entity_id is not null then
    select competition_tag_id into v_tag from public.competition_entities where id=new.canonical_entity_id;
    if v_tag is not null then new.tag_id:=v_tag; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_competitions_sync_entity_tag on public.competitions;
create trigger trg_competitions_sync_entity_tag
before insert or update of canonical_entity_id,tag_id on public.competitions
for each row execute function public.sync_legacy_competition_entity_tag();

-- Relation Maillots ↔ ÉDITIONS. L'affichage remontera ensuite automatiquement au tag ENTITÉ.
create table if not exists public.jersey_competition_editions(
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  competition_edition_id uuid not null references public.competition_editions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(jersey_id,competition_edition_id)
);
create index if not exists jersey_competition_editions_edition_idx on public.jersey_competition_editions(competition_edition_id);
alter table public.jersey_competition_editions enable row level security;
drop policy if exists jersey_competition_editions_public_read on public.jersey_competition_editions;
create policy jersey_competition_editions_public_read on public.jersey_competition_editions for select to anon,authenticated using(true);
drop policy if exists jersey_competition_editions_edit on public.jersey_competition_editions;
drop policy if exists jersey_competition_editions_insert on public.jersey_competition_editions;
drop policy if exists jersey_competition_editions_update on public.jersey_competition_editions;
drop policy if exists jersey_competition_editions_delete on public.jersey_competition_editions;
create policy jersey_competition_editions_insert on public.jersey_competition_editions for insert to authenticated with check(public.can_edit());
create policy jersey_competition_editions_update on public.jersey_competition_editions for update to authenticated using(public.can_edit()) with check(public.can_edit());
create policy jersey_competition_editions_delete on public.jersey_competition_editions for delete to authenticated using(public.can_edit());
grant select on public.jersey_competition_editions to anon,authenticated;
grant insert,update,delete on public.jersey_competition_editions to authenticated;

insert into public.jersey_competition_editions(jersey_id,competition_edition_id)
select distinct jc.jersey_id,c.canonical_edition_id
from public.jersey_competitions jc
join public.competitions c on c.id=jc.competition_id
where c.canonical_edition_id is not null
on conflict do nothing;

-- Les anciens tags réellement fusionnés restent dans l'historique mais ne polluent plus les sélecteurs.
update public.tags t
set is_active=false,updated_at=now()
where exists(select 1 from _competition_tag_merge m where m.old_id=t.id)
  and not exists(select 1 from public.competition_entities ce where ce.competition_tag_id=t.id)
  and not exists(select 1 from public.competition_editions ed where ed.edition_tag_id=t.id);

comment on column public.tags.competition_tag_level is 'entity = tag compétition visible ; edition = tag technique enfant utilisé pour relationner une édition précise.';
comment on column public.tags.parent_tag_id is 'Pour un tag édition, pointe vers le tag entité compétition parent.';
comment on column public.competition_editions.edition_tag_id is 'Tag canonique de l édition, enfant du tag entité.';
comment on table public.jersey_competition_editions is 'Affiliation précise Maillot ↔ édition canonique ; l UI affiche le tag entité parent.';

commit;


-- ============================================================
-- V1.1.61.30 — ÉVÉNEMENTS RASSEMBLEMENTS / ACCUEIL 3 BLOCS
-- ============================================================
-- 3615 Bleus V1.1.61.30 — Bloc événements des rassemblements

begin;

create table if not exists public.callup_events (
  id uuid primary key default gen_random_uuid(),
  callup_id uuid not null references public.callups(id) on delete cascade,
  event_date timestamptz not null default now(),
  event_type text not null default 'update',
  title text not null,
  description text,
  player_id uuid references public.players(id) on delete set null,
  related_player_id uuid references public.players(id) on delete set null,
  source_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint callup_events_type_check check (
    event_type = any(array[
      'announcement','news','withdrawal','replacement','reinforcement','update'
    ]::text[])
  )
);

create index if not exists callup_events_callup_idx
  on public.callup_events(callup_id,event_date desc);
create index if not exists callup_events_date_idx
  on public.callup_events(event_date desc);
create index if not exists callup_events_player_idx
  on public.callup_events(player_id)
  where player_id is not null;

alter table public.callup_events enable row level security;

drop policy if exists callup_events_read on public.callup_events;
create policy callup_events_read on public.callup_events
for select to anon,authenticated using(true);

drop policy if exists callup_events_insert on public.callup_events;
create policy callup_events_insert on public.callup_events
for insert to authenticated with check((select public.can_edit()));

drop policy if exists callup_events_update on public.callup_events;
create policy callup_events_update on public.callup_events
for update to authenticated using((select public.can_edit())) with check((select public.can_edit()));

drop policy if exists callup_events_delete on public.callup_events;
create policy callup_events_delete on public.callup_events
for delete to authenticated using((select public.can_edit()));

grant select on public.callup_events to anon,authenticated;
grant insert,update,delete on public.callup_events to authenticated;

comment on table public.callup_events is
  'Événements datés liés à un rassemblement : actualités, forfaits, remplacements, renforts et mises à jour.';

commit;
-- 3615 Bleus V1.1.61.33 — Couleurs éditoriales des pays
-- Déjà appliquée sur le projet Supabase bleus3000 le 28/09/2026.

create table if not exists public.country_display_colors (
  country_code text primary key,
  country_name text not null,
  primary_color text not null,
  secondary_color text,
  text_color text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint country_display_colors_code_check check (country_code ~ '^[a-z0-9-]{2,12}$'),
  constraint country_display_colors_primary_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint country_display_colors_secondary_check check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint country_display_colors_text_check check (text_color is null or text_color ~ '^#[0-9A-Fa-f]{6}$')
);

alter table public.country_display_colors enable row level security;
drop policy if exists country_display_colors_read on public.country_display_colors;
create policy country_display_colors_read on public.country_display_colors for select to anon,authenticated using (true);
drop policy if exists country_display_colors_insert on public.country_display_colors;
create policy country_display_colors_insert on public.country_display_colors for insert to authenticated with check ((select public.can_edit()));
drop policy if exists country_display_colors_update on public.country_display_colors;
create policy country_display_colors_update on public.country_display_colors for update to authenticated using ((select public.can_edit())) with check ((select public.can_edit()));
drop policy if exists country_display_colors_delete on public.country_display_colors;
create policy country_display_colors_delete on public.country_display_colors for delete to authenticated using ((select public.can_edit()));
grant select on public.country_display_colors to anon,authenticated;
grant insert,update,delete on public.country_display_colors to authenticated;

comment on table public.country_display_colors is
'Overrides éditoriaux des couleurs de pays pour les scoreboards. Sans ligne : maillot France / couleur dominante du drapeau adverse.';
-- 3615 Bleus V1.1.61.36 — Maillots : bibliothèque d'équipement complète
begin;

alter table public.jerseys
  add column if not exists family_key text,
  add column if not exists flocking_example_name text,
  add column if not exists flocking_example_number integer,
  add column if not exists flocking_example_photo_url text;

create index if not exists jerseys_family_key_idx on public.jerseys(family_key) where family_key is not null;

create table if not exists public.kit_components (
  id uuid primary key default gen_random_uuid(),
  component_type text not null,
  title text not null,
  selection_team_id uuid references public.selection_teams(id) on delete set null,
  season_label text,
  year_start integer,
  year_end integer,
  usage_type text,
  primary_color text,
  secondary_color text,
  image_path text,
  image_url text,
  notes_short text,
  source_urls text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kit_components_type_check check (component_type in ('short','socks'))
);
create index if not exists kit_components_type_year_idx on public.kit_components(component_type,year_start,year_end);
create index if not exists kit_components_team_idx on public.kit_components(selection_team_id);

create table if not exists public.jersey_kit_components (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  component_id uuid not null references public.kit_components(id) on delete cascade,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(jersey_id,component_id)
);
create index if not exists jersey_kit_components_component_idx on public.jersey_kit_components(component_id);

create table if not exists public.jersey_variants (
  id uuid primary key default gen_random_uuid(),
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  label text not null,
  variant_kind text not null default 'sleeve',
  usage_type text,
  sleeve_type text,
  primary_color text,
  secondary_color text,
  image_path text,
  image_url text,
  notes_short text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jersey_variants_kind_check check (variant_kind in ('sleeve','usage','goalkeeper','special'))
);
create index if not exists jersey_variants_jersey_idx on public.jersey_variants(jersey_id,variant_kind);

create table if not exists public.jersey_opponents (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  opponent_id uuid not null references public.opponents(id) on delete cascade,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(jersey_id,opponent_id)
);
create index if not exists jersey_opponents_opponent_idx on public.jersey_opponents(opponent_id);

create table if not exists public.competition_patches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_path text,
  image_url text,
  valid_from date,
  valid_to date,
  notes_short text,
  source_urls text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competition_patch_tags (
  patch_id uuid not null references public.competition_patches(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  relation_kind text not null default 'competition',
  created_at timestamptz not null default now(),
  primary key(patch_id,tag_id)
);
create index if not exists competition_patch_tags_tag_idx on public.competition_patch_tags(tag_id);

create table if not exists public.jersey_patches (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  patch_id uuid not null references public.competition_patches(id) on delete cascade,
  placement text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(jersey_id,patch_id)
);
create index if not exists jersey_patches_patch_idx on public.jersey_patches(patch_id);

alter table public.match_jerseys
  add column if not exists short_component_id uuid references public.kit_components(id) on delete set null,
  add column if not exists socks_component_id uuid references public.kit_components(id) on delete set null,
  add column if not exists jersey_variant_id uuid references public.jersey_variants(id) on delete set null;

create index if not exists match_jerseys_short_idx on public.match_jerseys(short_component_id) where short_component_id is not null;
create index if not exists match_jerseys_socks_idx on public.match_jerseys(socks_component_id) where socks_component_id is not null;
create index if not exists match_jerseys_variant_idx on public.match_jerseys(jersey_variant_id) where jersey_variant_id is not null;

create table if not exists public.match_jersey_patches (
  match_id uuid not null,
  jersey_id uuid not null,
  role text not null default 'outfield',
  patch_id uuid not null references public.competition_patches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(match_id,jersey_id,role,patch_id),
  constraint match_jersey_patches_kit_fk foreign key(match_id,jersey_id,role)
    references public.match_jerseys(match_id,jersey_id,role) on delete cascade
);
create index if not exists match_jersey_patches_patch_idx on public.match_jersey_patches(patch_id);

alter table public.kit_components enable row level security;
alter table public.jersey_kit_components enable row level security;
alter table public.jersey_variants enable row level security;
alter table public.jersey_opponents enable row level security;
alter table public.competition_patches enable row level security;
alter table public.competition_patch_tags enable row level security;
alter table public.jersey_patches enable row level security;
alter table public.match_jersey_patches enable row level security;

-- Lecture publique ; écriture ADMIN / SUPERADMIN via public.can_edit().
do $$
declare t text;
begin
  foreach t in array array['kit_components','jersey_kit_components','jersey_variants','jersey_opponents','competition_patches','competition_patch_tags','jersey_patches','match_jersey_patches'] loop
    execute format('drop policy if exists %I_public_read on public.%I',t,t);
    execute format('create policy %I_public_read on public.%I for select to anon,authenticated using(true)',t,t);
    execute format('drop policy if exists %I_insert on public.%I',t,t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check((select public.can_edit()))',t,t);
    execute format('drop policy if exists %I_update on public.%I',t,t);
    execute format('create policy %I_update on public.%I for update to authenticated using((select public.can_edit())) with check((select public.can_edit()))',t,t);
    execute format('drop policy if exists %I_delete on public.%I',t,t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using((select public.can_edit()))',t,t);
    execute format('grant select on public.%I to anon,authenticated',t);
    execute format('grant insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

comment on table public.kit_components is 'Bibliothèque réutilisable des shorts et chaussettes des sélections françaises.';
comment on table public.jersey_kit_components is 'Associations multiples maillot ↔ shorts / chaussettes.';
comment on table public.jersey_variants is 'Variantes directement rattachées à un maillot : manches, usage, gardien, édition spéciale.';
comment on table public.jersey_opponents is 'Adversaires pour lesquels un maillot est recommandé ou documenté.';
comment on table public.competition_patches is 'Bibliothèque des patchs compétition sans duplication.';
comment on table public.competition_patch_tags is 'Relation patch ↔ tag compétition ENTITÉ ou ÉDITION.';
comment on table public.jersey_patches is 'Patchs compatibles / documentés pour un maillot.';
comment on table public.match_jersey_patches is 'Patchs réellement portés avec le maillot sur un match.';
comment on column public.match_jerseys.short_component_id is 'Short réellement porté pour ce match.';
comment on column public.match_jerseys.socks_component_id is 'Chaussettes réellement portées pour ce match.';
comment on column public.match_jerseys.jersey_variant_id is 'Variante de maillot réellement portée (ex. manches longues).';

commit;
-- 3615 Bleus V1.1.61.40 — Rassemblements enrichis
-- Historique immuable, liste annoncée, éditions, diffusions multiples et PDF FFF.

begin;

alter table public.callups add column if not exists fff_pdf_url text;

alter table public.callup_players drop constraint if exists callup_players_status_check;
alter table public.callup_players add constraint callup_players_status_check
check (status = any(array['called','withdrawn','replacement','reserve','reinforcement']::text[]));

alter table public.callup_events drop constraint if exists callup_events_type_check;
alter table public.callup_events add constraint callup_events_type_check
check (event_type = any(array['announcement','news','withdrawal','replacement','reinforcement','conference','update']::text[]));

create table if not exists public.callup_announced_players(
  callup_id uuid not null references public.callups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  position_group text,
  first_callup boolean not null default false,
  sort_order integer not null default 0,
  captured_at timestamptz not null default now(),
  primary key(callup_id,player_id)
);
create index if not exists callup_announced_players_player_idx on public.callup_announced_players(player_id);

create table if not exists public.callup_roster_history(
  id uuid primary key default gen_random_uuid(),
  callup_id uuid not null references public.callups(id) on delete cascade,
  event_date timestamptz not null default now(),
  change_type text not null,
  player_id uuid references public.players(id) on delete set null,
  related_player_id uuid references public.players(id) on delete set null,
  previous_status text,
  new_status text,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint callup_roster_history_type_check check (
    change_type = any(array['added','removed','withdrawal','replacement','reinforcement','reserve','status_change']::text[])
  )
);
create index if not exists callup_roster_history_callup_idx on public.callup_roster_history(callup_id,event_date desc);
create index if not exists callup_roster_history_player_idx on public.callup_roster_history(player_id);

create table if not exists public.callup_competition_editions(
  callup_id uuid not null references public.callups(id) on delete cascade,
  competition_edition_id uuid not null references public.competition_editions(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(callup_id,competition_edition_id)
);
create index if not exists callup_competition_editions_edition_idx on public.callup_competition_editions(competition_edition_id);

create table if not exists public.callup_broadcast_channels(
  id uuid primary key default gen_random_uuid(),
  callup_id uuid not null references public.callups(id) on delete cascade,
  broadcast_channel_id uuid not null references public.broadcast_channels(id) on delete cascade,
  broadcast_kind text not null default 'press_conference',
  broadcast_url text,
  scheduled_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint callup_broadcast_kind_check check (
    broadcast_kind = any(array['press_conference','announcement','training','other']::text[])
  )
);
create index if not exists callup_broadcast_channels_callup_idx on public.callup_broadcast_channels(callup_id,sort_order);
create index if not exists callup_broadcast_channels_channel_idx on public.callup_broadcast_channels(broadcast_channel_id);

alter table public.callup_announced_players enable row level security;
alter table public.callup_roster_history enable row level security;
alter table public.callup_competition_editions enable row level security;
alter table public.callup_broadcast_channels enable row level security;

drop policy if exists callup_announced_players_read on public.callup_announced_players;
create policy callup_announced_players_read on public.callup_announced_players for select to anon,authenticated using(true);
drop policy if exists callup_announced_players_insert on public.callup_announced_players;
create policy callup_announced_players_insert on public.callup_announced_players for insert to authenticated with check((select public.can_edit()));
drop policy if exists callup_announced_players_update on public.callup_announced_players;
create policy callup_announced_players_update on public.callup_announced_players for update to authenticated using((select public.is_superadmin())) with check((select public.is_superadmin()));
drop policy if exists callup_announced_players_delete on public.callup_announced_players;
create policy callup_announced_players_delete on public.callup_announced_players for delete to authenticated using((select public.is_superadmin()));

drop policy if exists callup_roster_history_read on public.callup_roster_history;
create policy callup_roster_history_read on public.callup_roster_history for select to anon,authenticated using(true);
drop policy if exists callup_roster_history_insert on public.callup_roster_history;
create policy callup_roster_history_insert on public.callup_roster_history for insert to authenticated with check((select public.can_edit()));
drop policy if exists callup_roster_history_update on public.callup_roster_history;
create policy callup_roster_history_update on public.callup_roster_history for update to authenticated using((select public.is_superadmin())) with check((select public.is_superadmin()));
drop policy if exists callup_roster_history_delete on public.callup_roster_history;
create policy callup_roster_history_delete on public.callup_roster_history for delete to authenticated using((select public.is_superadmin()));

drop policy if exists callup_competition_editions_read on public.callup_competition_editions;
create policy callup_competition_editions_read on public.callup_competition_editions for select to anon,authenticated using(true);
drop policy if exists callup_competition_editions_insert on public.callup_competition_editions;
create policy callup_competition_editions_insert on public.callup_competition_editions for insert to authenticated with check((select public.can_edit()));
drop policy if exists callup_competition_editions_update on public.callup_competition_editions;
create policy callup_competition_editions_update on public.callup_competition_editions for update to authenticated using((select public.can_edit())) with check((select public.can_edit()));
drop policy if exists callup_competition_editions_delete on public.callup_competition_editions;
create policy callup_competition_editions_delete on public.callup_competition_editions for delete to authenticated using((select public.can_edit()));

drop policy if exists callup_broadcast_channels_read on public.callup_broadcast_channels;
create policy callup_broadcast_channels_read on public.callup_broadcast_channels for select to anon,authenticated using(true);
drop policy if exists callup_broadcast_channels_insert on public.callup_broadcast_channels;
create policy callup_broadcast_channels_insert on public.callup_broadcast_channels for insert to authenticated with check((select public.can_edit()));
drop policy if exists callup_broadcast_channels_update on public.callup_broadcast_channels;
create policy callup_broadcast_channels_update on public.callup_broadcast_channels for update to authenticated using((select public.can_edit())) with check((select public.can_edit()));
drop policy if exists callup_broadcast_channels_delete on public.callup_broadcast_channels;
create policy callup_broadcast_channels_delete on public.callup_broadcast_channels for delete to authenticated using((select public.can_edit()));

grant select on public.callup_announced_players,public.callup_roster_history,public.callup_competition_editions,public.callup_broadcast_channels to anon,authenticated;
grant insert,update,delete on public.callup_announced_players,public.callup_roster_history,public.callup_competition_editions,public.callup_broadcast_channels to authenticated;

insert into public.callup_announced_players(callup_id,player_id,position_group,first_callup,sort_order)
select cp.callup_id,cp.player_id,cp.position_group,cp.first_callup,cp.sort_order
from public.callup_players cp
join public.callups c on c.id=cp.callup_id
where c.announcement_date is not null
  and not exists(select 1 from public.callup_announced_players ap where ap.callup_id=cp.callup_id)
on conflict do nothing;

create or replace function public.capture_announced_callup_roster()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  insert into public.callup_announced_players(callup_id,player_id,position_group,first_callup,sort_order)
  select cp.callup_id,cp.player_id,cp.position_group,cp.first_callup,cp.sort_order
  from public.callup_players cp
  join (select distinct callup_id from new_callup_rows) n on n.callup_id=cp.callup_id
  join public.callups c on c.id=cp.callup_id
  where c.announcement_date is not null
    and not exists(select 1 from public.callup_announced_players ap where ap.callup_id=cp.callup_id)
  on conflict do nothing;
  return null;
end $$;

drop trigger if exists trg_capture_announced_callup_roster on public.callup_players;
create trigger trg_capture_announced_callup_roster
after insert on public.callup_players
referencing new table as new_callup_rows
for each statement execute function public.capture_announced_callup_roster();

comment on column public.callups.fff_pdf_url is 'Lien PDF officiel FFF de la convocation.';
comment on table public.callup_announced_players is 'Instantané immuable de la liste initialement annoncée.';
comment on table public.callup_roster_history is 'Historique structuré des modifications de liste après annonce.';
comment on table public.callup_competition_editions is 'Éditions de compétition reliées au rassemblement, sans duplication des joueurs.';
comment on table public.callup_broadcast_channels is 'Diffusions liées au rassemblement, notamment conférence de presse, avec plusieurs chaînes possibles.';

commit;

-- V1.1.61.41 — Rassemblements : forfait explicitement non remplacé
alter table public.callup_players
  add column if not exists not_replaced boolean not null default false;


-- 3615 Bleus V1.1.61.44 — médias reliés aux matchs
create table if not exists public.match_media_assets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  asset_type text not null,
  title text,
  url text,
  image_path text,
  image_url text,
  source_url text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_media_assets_type_check check (asset_type = any(array['newspaper_front','team_photo','ticket','youtube','ball']::text[]))
);
create index if not exists match_media_assets_match_idx on public.match_media_assets(match_id,sort_order,created_at);
alter table public.match_media_assets enable row level security;
drop policy if exists match_media_assets_read on public.match_media_assets;
create policy match_media_assets_read on public.match_media_assets for select to anon,authenticated using(true);
drop policy if exists match_media_assets_insert on public.match_media_assets;
create policy match_media_assets_insert on public.match_media_assets for insert to authenticated with check((select public.can_edit()));
drop policy if exists match_media_assets_update on public.match_media_assets;
create policy match_media_assets_update on public.match_media_assets for update to authenticated using((select public.can_edit())) with check((select public.can_edit()));
drop policy if exists match_media_assets_delete on public.match_media_assets;
create policy match_media_assets_delete on public.match_media_assets for delete to authenticated using((select public.can_edit()));
grant select on public.match_media_assets to anon,authenticated;
grant insert,update,delete on public.match_media_assets to authenticated;
comment on table public.match_media_assets is 'Médias reliés à une tuile match : une de journal, photo d’équipe, ballon, billet historique ou lien vidéo YouTube.';


-- ===== V1.1.66 — réconciliation événements / liste courante =====
-- 3615 Bleus V1.1.66 — réconciliation événements / liste courante des rassemblements
-- Rend persistants les statuts dérivés des événements de forfait/remplacement/renfort.

begin;

with repl as (
  select distinct on (e.callup_id,e.related_player_id)
    e.callup_id, e.related_player_id as player_id, e.player_id as replacement_for,
    e.description, e.event_date
  from public.callup_events e
  where e.event_type='replacement' and e.related_player_id is not null
  order by e.callup_id,e.related_player_id,e.event_date desc
)
insert into public.callup_players (callup_id,player_id,position_group,status,first_callup,replacement_for,not_replaced,sort_order,notes_short,updated_at)
select r.callup_id,r.player_id,
       coalesce((select a.position_group from public.callup_announced_players a where a.callup_id=r.callup_id and a.player_id=r.player_id limit 1),
                (select cp.position_group from public.callup_players cp where cp.callup_id=r.callup_id and cp.player_id=r.replacement_for limit 1),
                p.primary_position),
       'replacement',false,r.replacement_for,false,
       coalesce((select max(cp.sort_order)+1 from public.callup_players cp where cp.callup_id=r.callup_id),0),
       r.description,coalesce(r.event_date,now())
from repl r join public.players p on p.id=r.player_id
on conflict (callup_id,player_id) do update set
  status='replacement', replacement_for=excluded.replacement_for,
  position_group=coalesce(public.callup_players.position_group,excluded.position_group),
  notes_short=coalesce(public.callup_players.notes_short,excluded.notes_short),
  updated_at=greatest(public.callup_players.updated_at,excluded.updated_at);

with reinf as (
  select distinct on (e.callup_id,coalesce(e.player_id,e.related_player_id))
    e.callup_id,coalesce(e.player_id,e.related_player_id) as player_id,e.description,e.event_date
  from public.callup_events e
  where e.event_type='reinforcement' and coalesce(e.player_id,e.related_player_id) is not null
  order by e.callup_id,coalesce(e.player_id,e.related_player_id),e.event_date desc
)
insert into public.callup_players (callup_id,player_id,position_group,status,first_callup,replacement_for,not_replaced,sort_order,notes_short,updated_at)
select r.callup_id,r.player_id,
       coalesce((select a.position_group from public.callup_announced_players a where a.callup_id=r.callup_id and a.player_id=r.player_id limit 1),p.primary_position),
       'reinforcement',false,null,false,
       coalesce((select max(cp.sort_order)+1 from public.callup_players cp where cp.callup_id=r.callup_id),0),
       r.description,coalesce(r.event_date,now())
from reinf r join public.players p on p.id=r.player_id
on conflict (callup_id,player_id) do update set
  status='reinforcement',
  position_group=coalesce(public.callup_players.position_group,excluded.position_group),
  notes_short=coalesce(public.callup_players.notes_short,excluded.notes_short),
  updated_at=greatest(public.callup_players.updated_at,excluded.updated_at);

with outs as (
  select distinct on (callup_id,player_id) callup_id,player_id,description,event_date
  from (
    select callup_id,player_id,description,event_date from public.callup_events where event_type='withdrawal' and player_id is not null
    union all
    select callup_id,player_id,description,event_date from public.callup_events where event_type='replacement' and player_id is not null
  ) q
  order by callup_id,player_id,event_date desc
)
insert into public.callup_players (callup_id,player_id,position_group,status,first_callup,replacement_for,not_replaced,sort_order,notes_short,updated_at)
select o.callup_id,o.player_id,
       coalesce((select a.position_group from public.callup_announced_players a where a.callup_id=o.callup_id and a.player_id=o.player_id limit 1),p.primary_position),
       'withdrawn',false,null,false,
       coalesce((select max(cp.sort_order)+1 from public.callup_players cp where cp.callup_id=o.callup_id),0),
       o.description,coalesce(o.event_date,now())
from outs o join public.players p on p.id=o.player_id
on conflict (callup_id,player_id) do update set
  status='withdrawn', replacement_for=null, not_replaced=false,
  position_group=coalesce(public.callup_players.position_group,excluded.position_group),
  notes_short=coalesce(public.callup_players.notes_short,excluded.notes_short),
  updated_at=greatest(public.callup_players.updated_at,excluded.updated_at);

commit;


-- V1.1.67 — dégradés éditoriaux des couleurs pays
alter table if exists public.country_display_colors
  add column if not exists display_mode text not null default 'gradient',
  add column if not exists gradient_angle integer not null default 180;

do $$ begin
  alter table public.country_display_colors drop constraint if exists country_display_colors_display_mode_check;
  alter table public.country_display_colors add constraint country_display_colors_display_mode_check check (display_mode in ('solid','gradient'));
  alter table public.country_display_colors drop constraint if exists country_display_colors_gradient_angle_check;
  alter table public.country_display_colors add constraint country_display_colors_gradient_angle_check check (gradient_angle between 0 and 360);
exception when undefined_table then null; end $$;


-- V1.1.89 — surlignages pays avancés + logos compétitions
alter table if exists public.country_display_colors
  add column if not exists highlight_colors text[] not null default '{}',
  add column if not exists highlight_gradient_type text not null default 'linear',
  add column if not exists highlight_opacity numeric not null default 0.28,
  add column if not exists highlight_height integer not null default 82;

do $$ begin
  alter table public.country_display_colors drop constraint if exists country_display_colors_highlight_gradient_type_check;
  alter table public.country_display_colors add constraint country_display_colors_highlight_gradient_type_check check (highlight_gradient_type in ('linear','radial'));
  alter table public.country_display_colors drop constraint if exists country_display_colors_highlight_opacity_check;
  alter table public.country_display_colors add constraint country_display_colors_highlight_opacity_check check (highlight_opacity between 0.05 and 0.95);
  alter table public.country_display_colors drop constraint if exists country_display_colors_highlight_height_check;
  alter table public.country_display_colors add constraint country_display_colors_highlight_height_check check (highlight_height between 35 and 120);
exception when undefined_table then null; end $$;

alter table if exists public.competition_entities add column if not exists logo_path text;
alter table if exists public.competition_editions add column if not exists logo_path text;


-- V1.2.2 — dates de décès joueurs / staff + cohérence biographique
alter table if exists public.players add column if not exists death_date date;
alter table if exists public.personnel add column if not exists death_date date;

do $$ begin
  alter table public.players drop constraint if exists players_death_after_birth_check;
  alter table public.players add constraint players_death_after_birth_check check (death_date is null or birth_date is null or death_date >= birth_date);
exception when undefined_table then null; end $$;

do $$ begin
  alter table public.personnel drop constraint if exists personnel_death_after_birth_check;
  alter table public.personnel add constraint personnel_death_after_birth_check check (death_date is null or birth_date is null or death_date >= birth_date);
exception when undefined_table then null; end $$;
-- 3615 Bleus V1.2.5 — fiabilisation des feuilles de match
-- Upgrades : centre qualité, contrôle ville, validation atomique, revalidation exhaustive,
-- numérotation chronologique canonique en base.

begin;

-- ---------------------------------------------------------------------------
-- 1) Champs complémentaires & numéro canonique
-- ---------------------------------------------------------------------------
alter table public.matches
  add column if not exists sheet_city_name text,
  add column if not exists chronological_number integer;

create index if not exists matches_chronological_number_idx
  on public.matches(chronological_number)
  where gender='M' and selection_category='A';

comment on column public.matches.sheet_city_name is
  'Ville saisie/confirmée dans la feuille de match ; utilisée par le contrôle qualité.';
comment on column public.matches.chronological_number is
  'Numéro canonique du match France A masculine, recalculé selon la date effective puis l UUID.';

-- ---------------------------------------------------------------------------
-- 2) Numérotation canonique : même logique que l interface, mais persistée en BDD
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_match_numbers()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  with ranked as (
    select
      m.id,
      row_number() over (
        order by
          case
            when m.manual_overrides ? 'match_date'
             and nullif(m.manual_overrides->>'match_date','') is not null
             and (m.manual_overrides->>'match_date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            then (m.manual_overrides->>'match_date')::timestamptz
            else m.match_date
          end asc nulls last,
          m.id::text asc
      )::integer as rn
    from public.matches m
    where m.gender='M' and m.selection_category='A'
  )
  update public.matches m
  set chronological_number=r.rn
  from ranked r
  where m.id=r.id
    and m.chronological_number is distinct from r.rn;

  update public.matches
  set chronological_number=null
  where chronological_number is not null
    and not (gender='M' and selection_category='A');
end
$$;

revoke all on function public.recalculate_match_numbers() from public,anon,authenticated;

create or replace function public.trg_recalculate_match_numbers()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  -- Trigger de niveau STATEMENT : un import de 200 matchs ne recalcule qu'une fois.
  perform public.recalculate_match_numbers();
  return null;
end
$$;

revoke all on function public.trg_recalculate_match_numbers() from public,anon,authenticated;

drop trigger if exists trg_matches_recalculate_numbers on public.matches;
create trigger trg_matches_recalculate_numbers
after insert or delete or update of match_date,manual_overrides,gender,selection_category
on public.matches
for each statement execute function public.trg_recalculate_match_numbers();

-- ---------------------------------------------------------------------------
-- 3) Revalidation exhaustive dès qu une donnée de feuille change
-- ---------------------------------------------------------------------------
create or replace function public.mark_match_sheet_child_dirty()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare v_match_id uuid;
begin
  if tg_op='UPDATE' and new is not distinct from old then return new; end if;
  v_match_id:=case when tg_op='DELETE' then old.match_id else new.match_id end;
  update public.matches
  set sheet_validation_status=case when sheet_validation_status='validated' then 'needs_validation' else sheet_validation_status end,
      updated_at=now()
  where id=v_match_id;
  return case when tg_op='DELETE' then old else new end;
end
$$;

drop trigger if exists trg_match_appearances_sheet_dirty on public.match_appearances;
create trigger trg_match_appearances_sheet_dirty after insert or update or delete on public.match_appearances
for each row execute function public.mark_match_sheet_child_dirty();

drop trigger if exists trg_match_goals_sheet_dirty on public.match_goal_events;
create trigger trg_match_goals_sheet_dirty after insert or update or delete on public.match_goal_events
for each row execute function public.mark_match_sheet_child_dirty();

drop trigger if exists trg_match_cards_sheet_dirty on public.match_card_events;
create trigger trg_match_cards_sheet_dirty after insert or update or delete on public.match_card_events
for each row execute function public.mark_match_sheet_child_dirty();

drop trigger if exists trg_match_officials_sheet_dirty on public.match_officials;
create trigger trg_match_officials_sheet_dirty after insert or update or delete on public.match_officials
for each row execute function public.mark_match_sheet_child_dirty();

drop trigger if exists trg_match_jerseys_sheet_dirty on public.match_jerseys;
create trigger trg_match_jerseys_sheet_dirty after insert or update or delete on public.match_jerseys
for each row execute function public.mark_match_sheet_child_dirty();

create or replace function public.mark_match_sheet_match_dirty()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_override_changed boolean:=false;
begin
  if old.sheet_validation_status<>'validated' then return new; end if;

  v_override_changed :=
       (coalesce(old.manual_overrides,'{}'::jsonb)->'match_date') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'match_date')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'france_score') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'france_score')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'opponent_score') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'opponent_score')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'venue_name') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'venue_name')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'city') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'city')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'competition_name') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'competition_name');

  if old.france_score is distinct from new.france_score
     or old.opponent_score is distinct from new.opponent_score
     or old.selection_team_id is distinct from new.selection_team_id
     or old.competition_id is distinct from new.competition_id
     or old.competition_edition_id is distinct from new.competition_edition_id
     or old.place_id is distinct from new.place_id
     or old.coach_id is distinct from new.coach_id
     or old.sheet_stadium_name is distinct from new.sheet_stadium_name
     or old.sheet_city_name is distinct from new.sheet_city_name
     or old.sheet_referee_name is distinct from new.sheet_referee_name
     or old.sheet_coach_name is distinct from new.sheet_coach_name
     or old.sheet_competition_name is distinct from new.sheet_competition_name
     or old.sheet_competition_family_id is distinct from new.sheet_competition_family_id
     or v_override_changed then
    new.sheet_validation_status:='needs_validation';
  end if;
  return new;
end
$$;

drop trigger if exists trg_matches_sheet_dirty on public.matches;
create trigger trg_matches_sheet_dirty
before update of france_score,opponent_score,selection_team_id,competition_id,competition_edition_id,place_id,coach_id,
  sheet_stadium_name,sheet_city_name,sheet_referee_name,sheet_coach_name,sheet_competition_name,sheet_competition_family_id,manual_overrides
on public.matches
for each row execute function public.mark_match_sheet_match_dirty();

-- ---------------------------------------------------------------------------
-- 4) Résolution stade + ville
-- ---------------------------------------------------------------------------
create or replace function public.resolve_or_create_sheet_place(p_name text,p_city text)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare v_id uuid;
begin
  if nullif(trim(coalesce(p_name,'')),'') is null then return null; end if;
  select id into v_id
  from public.places
  where place_type='stadium' and public.sheet_name_key(name)=public.sheet_name_key(p_name)
  order by created_at limit 1;

  if v_id is null then
    insert into public.places(place_type,name,city)
    values('stadium',trim(p_name),nullif(trim(coalesce(p_city,'')),''))
    returning id into v_id;
  elsif nullif(trim(coalesce(p_city,'')),'') is not null then
    update public.places set city=trim(p_city),updated_at=now() where id=v_id and city is distinct from trim(p_city);
  end if;
  return v_id;
end
$$;

-- ---------------------------------------------------------------------------
-- 5) Contrôle qualité canonique d une feuille
-- ---------------------------------------------------------------------------
create or replace function public.match_sheet_missing_fields(p_match_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_match public.matches%rowtype;
  v_place public.places%rowtype;
  v_missing text[]:=array[]::text[];
  v_starters integer:=0;
  v_referee boolean:=false;
  v_jersey boolean:=false;
  v_score_f text;
  v_score_o text;
  v_venue_override text;
  v_city_override text;
begin
  select * into v_match from public.matches where id=p_match_id;
  if not found then return array['match_introuvable']; end if;

  if v_match.place_id is not null then select * into v_place from public.places where id=v_match.place_id; end if;

  select count(*)::integer into v_starters
  from public.match_appearances
  where match_id=p_match_id
    and starter=true
    and (player_id is not null or nullif(trim(coalesce(player_name,'')),'') is not null);
  if v_starters<11 then v_missing:=array_append(v_missing,'composition'); end if;

  v_venue_override:=case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'venue_name' then v_match.manual_overrides->>'venue_name' else null end;
  v_city_override:=case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'city' then v_match.manual_overrides->>'city' else null end;

  if nullif(trim(coalesce(v_match.sheet_stadium_name,v_venue_override,v_place.name,'')),'') is null then
    v_missing:=array_append(v_missing,'stade');
  end if;
  if nullif(trim(coalesce(v_match.sheet_city_name,v_city_override,v_place.city,'')),'') is null then
    v_missing:=array_append(v_missing,'ville');
  end if;

  select exists(
    select 1 from public.match_officials mo
    where mo.match_id=p_match_id
      and mo.role ~* '(arbitre|referee)'
      and mo.role !~* '(assistant|assistante|video|var|linesman|lineswoman|fourth|quatri|4e|4eme|reserve)'
  ) into v_referee;
  if nullif(trim(coalesce(v_match.sheet_referee_name,'')),'') is null and not v_referee then
    v_missing:=array_append(v_missing,'arbitre');
  end if;

  if nullif(trim(coalesce(v_match.sheet_coach_name,'')),'') is null and v_match.coach_id is null then
    v_missing:=array_append(v_missing,'selectionneur');
  end if;
  if v_match.competition_edition_id is null then v_missing:=array_append(v_missing,'edition_competition'); end if;

  select exists(select 1 from public.match_jerseys mj where mj.match_id=p_match_id and coalesce(mj.role,'outfield')='outfield') into v_jersey;
  if not v_jersey then v_missing:=array_append(v_missing,'maillot'); end if;

  if coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'france_score' then
    v_score_f:=v_match.manual_overrides->>'france_score';
  else
    v_score_f:=v_match.france_score::text;
  end if;
  if coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then
    v_score_o:=v_match.manual_overrides->>'opponent_score';
  else
    v_score_o:=v_match.opponent_score::text;
  end if;
  if nullif(trim(coalesce(v_score_f,'')),'') is null or nullif(trim(coalesce(v_score_o,'')),'') is null then
    v_missing:=array_append(v_missing,'score');
  end if;

  return v_missing;
end
$$;

revoke all on function public.match_sheet_missing_fields(uuid) from public,anon;
grant execute on function public.match_sheet_missing_fields(uuid) to authenticated;

-- Les anciennes feuilles déjà marquées VALIDÉES sont ré-auditées une fois à l'installation.
-- Si un des 8 champs obligatoires manque réellement, elles passent en À REVALIDER.
update public.matches m
set sheet_validation_status='needs_validation',
    updated_at=now()
where m.gender='M'
  and m.selection_category='A'
  and m.sheet_validation_status='validated'
  and cardinality(public.match_sheet_missing_fields(m.id))>0;

-- ---------------------------------------------------------------------------
-- 6) Validation atomique : sauvegarde + matérialisation + stats dans 1 transaction
-- ---------------------------------------------------------------------------
create or replace function public.validate_match_sheet(
  p_match_id uuid,
  p_appearances jsonb,
  p_goals jsonb,
  p_cards jsonb,
  p_context jsonb,
  p_jersey_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_match public.matches%rowtype;
  v_item jsonb;
  v_id uuid;
  v_player_id uuid;
  v_replacement_id uuid;
  v_assist_id uuid;
  v_place_id uuid;
  v_coach_id uuid;
  v_referee_id uuid;
  v_edition_id uuid;
  v_competition_id uuid;
  v_existing_jersey uuid;
  v_selection_id uuid;
  v_result text;
  v_missing text[];
  v_affected uuid[]:=array[]::uuid[];
  v_appeared uuid[]:=array[]::uuid[];
  v_player_count integer:=0;
  v_revision integer:=0;
  v_stadium text:=nullif(trim(coalesce(p_context->>'stadium','')),'');
  v_city text:=nullif(trim(coalesce(p_context->>'city','')),'');
  v_coach text:=nullif(trim(coalesce(p_context->>'coach','')),'');
  v_referee text:=nullif(trim(coalesce(p_context->>'referee','')),'');
  v_competition text:=nullif(trim(coalesce(p_context->>'competition_name','')),'');
begin
  if auth.uid() is null or not public.can_edit() then raise exception 'Modification non autorisée'; end if;
  if jsonb_typeof(coalesce(p_appearances,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_goals,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_cards,'[]'::jsonb))<>'array' then
    raise exception 'Payload de feuille invalide';
  end if;

  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'Match introuvable'; end if;
  v_selection_id:=v_match.selection_team_id;
  if v_selection_id is null then raise exception 'Sélection interne manquante pour ce match'; end if;

  select coalesce(array_agg(distinct x.pid),array[]::uuid[]) into v_affected
  from (
    select player_id pid from public.validated_match_player_stats where match_id=p_match_id and player_id is not null
    union
    select player_id from public.match_appearances where match_id=p_match_id and player_id is not null
    union
    select replaced_by_player_id from public.match_appearances where match_id=p_match_id and replaced_by_player_id is not null
  ) x;

  -- Contexte feuille : stade/ville, sélectionneur, arbitre, compétition.
  if v_stadium is not null then
    v_place_id:=public.resolve_or_create_sheet_place(v_stadium,v_city);
  else
    v_place_id:=null;
  end if;
  if v_coach is not null then v_coach_id:=public.resolve_or_create_sheet_personnel(v_coach,'selectionneur'); end if;
  if v_referee is not null then v_referee_id:=public.resolve_or_create_sheet_personnel(v_referee,'arbitre'); end if;

  if nullif(p_context->>'competition_edition_id','') is not null then
    v_edition_id:=(p_context->>'competition_edition_id')::uuid;
    select c.id into v_competition_id
    from public.competitions c
    where c.canonical_edition_id=v_edition_id
      and (c.gender is null or c.gender=v_match.gender)
      and (c.selection_category is null or c.selection_category=v_match.selection_category)
    order by c.created_at nulls last,c.id limit 1;
  elsif v_competition is not null then
    select c.id,c.canonical_edition_id into v_competition_id,v_edition_id
    from public.competitions c
    where public.sheet_name_key(c.name)=public.sheet_name_key(v_competition)
      and (c.gender is null or c.gender=v_match.gender)
      and (c.selection_category is null or c.selection_category=v_match.selection_category)
    order by c.created_at nulls last,c.id limit 1;
  end if;

  update public.matches
  set place_id=v_place_id,
      coach_id=v_coach_id,
      competition_id=coalesce(v_competition_id,competition_id),
      competition_edition_id=v_edition_id,
      sheet_stadium_name=v_stadium,
      sheet_city_name=v_city,
      sheet_referee_name=v_referee,
      sheet_coach_name=v_coach,
      sheet_competition_name=v_competition,
      updated_at=now()
  where id=p_match_id;

  delete from public.match_officials mo
  where mo.match_id=p_match_id
    and mo.role ~* '(arbitre|referee)'
    and mo.role !~* '(assistant|assistante|video|var|linesman|lineswoman|fourth|quatri|4e|4eme|reserve)';
  if v_referee_id is not null then
    insert into public.match_officials(match_id,person_id,role)
    values(p_match_id,v_referee_id,'Arbitre principal')
    on conflict(match_id,person_id,role) do nothing;
  end if;

  -- Maillot France : préserver les composants si le maillot ne change pas.
  select jersey_id into v_existing_jersey
  from public.match_jerseys
  where match_id=p_match_id and coalesce(role,'outfield')='outfield'
  order by updated_at desc nulls last limit 1;
  if p_jersey_id is null then
    delete from public.match_jerseys where match_id=p_match_id and coalesce(role,'outfield')='outfield';
  elsif v_existing_jersey is null then
    insert into public.match_jerseys(match_id,jersey_id,selection_team_id,role,created_by,updated_at)
    values(p_match_id,p_jersey_id,v_selection_id,'outfield',auth.uid(),now());
  elsif v_existing_jersey is distinct from p_jersey_id then
    delete from public.match_jerseys where match_id=p_match_id and coalesce(role,'outfield')='outfield';
    insert into public.match_jerseys(match_id,jersey_id,selection_team_id,role,created_by,updated_at)
    values(p_match_id,p_jersey_id,v_selection_id,'outfield',auth.uid(),now());
  else
    update public.match_jerseys
    set selection_team_id=v_selection_id
    where match_id=p_match_id and jersey_id=p_jersey_id and coalesce(role,'outfield')='outfield';
  end if;

  -- Supprime uniquement les lignes retirées de l éditeur.
  delete from public.match_appearances a
  where a.match_id=p_match_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_appearances,'[]'::jsonb)) j
      where nullif(j->>'id','') is not null and (j->>'id')::uuid=a.id
    );

  -- Composition.
  for v_item in select value from jsonb_array_elements(coalesce(p_appearances,'[]'::jsonb)) loop
    v_id:=case when nullif(v_item->>'id','') is null then null else (v_item->>'id')::uuid end;
    v_player_id:=case when nullif(v_item->>'player_id','') is null then null else (v_item->>'player_id')::uuid end;
    if v_player_id is null and nullif(trim(coalesce(v_item->>'player_name','')),'') is not null then
      v_player_id:=public.resolve_or_create_sheet_player(v_item->>'player_name',v_match.gender,v_selection_id);
    end if;
    v_replacement_id:=case when nullif(v_item->>'replaced_by_player_id','') is null then null else (v_item->>'replaced_by_player_id')::uuid end;
    if v_replacement_id is null and nullif(trim(coalesce(v_item->>'replaced_by_name','')),'') is not null then
      v_replacement_id:=public.resolve_or_create_sheet_player(v_item->>'replaced_by_name',v_match.gender,v_selection_id);
    end if;
    if v_player_id is not null then v_affected:=array_append(v_affected,v_player_id); end if;
    if v_replacement_id is not null then
      v_affected:=array_append(v_affected,v_replacement_id);
      v_appeared:=array_append(v_appeared,v_replacement_id);
    end if;

    if v_id is null and v_player_id is not null then
      select id into v_id from public.match_appearances where match_id=p_match_id and player_id=v_player_id limit 1;
    end if;

    if v_id is not null and exists(select 1 from public.match_appearances where id=v_id and match_id=p_match_id) then
      update public.match_appearances
      set player_id=v_player_id,
          player_name=nullif(trim(coalesce(v_item->>'player_name','')),''),
          starter=coalesce((v_item->>'starter')::boolean,false),
          appeared=false,
          lineup_slot=case when nullif(v_item->>'lineup_slot','') is null then null else (v_item->>'lineup_slot')::integer end,
          minutes=case when nullif(v_item->>'minutes','') is null then null else (v_item->>'minutes')::integer end,
          squad_status=nullif(v_item->>'squad_status',''),
          shirt_number=case when nullif(v_item->>'shirt_number','') is null then null else (v_item->>'shirt_number')::integer end,
          position_id=case when nullif(v_item->>'position_id','') is null then null else (v_item->>'position_id')::uuid end,
          position=nullif(v_item->>'position',''),
          captain=coalesce((v_item->>'captain')::boolean,false),
          replaced_by_player_id=v_replacement_id,
          replaced_by_name=nullif(trim(coalesce(v_item->>'replaced_by_name','')),''),
          verification=coalesce(nullif(v_item->>'verification',''),'manual')
      where id=v_id;
    else
      insert into public.match_appearances(
        match_id,player_id,player_name,starter,appeared,lineup_slot,minutes,squad_status,shirt_number,
        position_id,position,captain,replaced_by_player_id,replaced_by_name,verification
      ) values(
        p_match_id,v_player_id,nullif(trim(coalesce(v_item->>'player_name','')),''),coalesce((v_item->>'starter')::boolean,false),false,
        case when nullif(v_item->>'lineup_slot','') is null then null else (v_item->>'lineup_slot')::integer end,
        case when nullif(v_item->>'minutes','') is null then null else (v_item->>'minutes')::integer end,
        nullif(v_item->>'squad_status',''),
        case when nullif(v_item->>'shirt_number','') is null then null else (v_item->>'shirt_number')::integer end,
        case when nullif(v_item->>'position_id','') is null then null else (v_item->>'position_id')::uuid end,
        nullif(v_item->>'position',''),coalesce((v_item->>'captain')::boolean,false),v_replacement_id,
        nullif(trim(coalesce(v_item->>'replaced_by_name','')),''),coalesce(nullif(v_item->>'verification',''),'manual')
      );
    end if;

    if coalesce((v_item->>'starter')::boolean,false) and v_player_id is not null then
      v_appeared:=array_append(v_appeared,v_player_id);
    end if;
  end loop;

  -- Buts : mise à jour par ID, insertion des nouveaux, suppression des lignes retirées.
  delete from public.match_goal_events g
  where g.match_id=p_match_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb)) j
      where nullif(j->>'id','') is not null and (j->>'id')::uuid=g.id
    );

  for v_item in select value from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb)) loop
    v_id:=case when nullif(v_item->>'id','') is null then null else (v_item->>'id')::uuid end;
    v_player_id:=case when nullif(v_item->>'player_id','') is null then null else (v_item->>'player_id')::uuid end;
    v_assist_id:=case when nullif(v_item->>'assist_player_id','') is null then null else (v_item->>'assist_player_id')::uuid end;
    if public.sheet_name_key(v_item->>'team_name')='france' then
      if v_player_id is null then v_player_id:=public.resolve_or_create_sheet_player(v_item->>'scorer_name',v_match.gender,v_selection_id); end if;
      if v_assist_id is null and nullif(trim(coalesce(v_item->>'assist_name','')),'') is not null then
        v_assist_id:=public.resolve_or_create_sheet_player(v_item->>'assist_name',v_match.gender,v_selection_id);
      end if;
      if v_player_id is not null then v_affected:=array_append(v_affected,v_player_id);v_appeared:=array_append(v_appeared,v_player_id); end if;
      if v_assist_id is not null then v_affected:=array_append(v_affected,v_assist_id);v_appeared:=array_append(v_appeared,v_assist_id); end if;
    else
      v_player_id:=null;v_assist_id:=null;
    end if;

    if v_id is not null and exists(select 1 from public.match_goal_events where id=v_id and match_id=p_match_id) then
      update public.match_goal_events
      set player_id=v_player_id,scorer_name=coalesce(nullif(trim(v_item->>'scorer_name'),''),'Inconnu'),team_name=nullif(v_item->>'team_name',''),
          minute_text=nullif(v_item->>'minute_text',''),score_after=nullif(v_item->>'score_after',''),assist_player_id=v_assist_id,
          assist_name=nullif(trim(coalesce(v_item->>'assist_name','')),''),goal_type=nullif(v_item->>'goal_type',''),
          body_part=nullif(v_item->>'body_part',''),is_penalty=coalesce((v_item->>'is_penalty')::boolean,false),
          is_own_goal=coalesce((v_item->>'is_own_goal')::boolean,false),updated_at=now()
      where id=v_id;
    else
      insert into public.match_goal_events(match_id,player_id,scorer_name,team_name,minute_text,score_after,assist_player_id,assist_name,goal_type,body_part,is_penalty,is_own_goal,updated_at)
      values(p_match_id,v_player_id,coalesce(nullif(trim(v_item->>'scorer_name'),''),'Inconnu'),nullif(v_item->>'team_name',''),nullif(v_item->>'minute_text',''),nullif(v_item->>'score_after',''),v_assist_id,nullif(trim(coalesce(v_item->>'assist_name','')),''),nullif(v_item->>'goal_type',''),nullif(v_item->>'body_part',''),coalesce((v_item->>'is_penalty')::boolean,false),coalesce((v_item->>'is_own_goal')::boolean,false),now());
    end if;
  end loop;

  -- Cartons.
  delete from public.match_card_events c
  where c.match_id=p_match_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) j
      where nullif(j->>'id','') is not null and (j->>'id')::uuid=c.id
    );

  for v_item in select value from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) loop
    v_id:=case when nullif(v_item->>'id','') is null then null else (v_item->>'id')::uuid end;
    v_player_id:=case when nullif(v_item->>'player_id','') is null then null else (v_item->>'player_id')::uuid end;
    if public.sheet_name_key(v_item->>'team_name')='france' then
      if v_player_id is null then v_player_id:=public.resolve_or_create_sheet_player(v_item->>'player_name',v_match.gender,v_selection_id); end if;
      if v_player_id is not null then v_affected:=array_append(v_affected,v_player_id);v_appeared:=array_append(v_appeared,v_player_id); end if;
    else
      v_player_id:=null;
    end if;

    if v_id is not null and exists(select 1 from public.match_card_events where id=v_id and match_id=p_match_id) then
      update public.match_card_events
      set player_id=v_player_id,player_name=coalesce(nullif(trim(v_item->>'player_name'),''),'Inconnu'),team_name=nullif(v_item->>'team_name',''),
          card_type=coalesce(nullif(v_item->>'card_type',''),'yellow'),minute_text=nullif(v_item->>'minute_text',''),updated_at=now()
      where id=v_id;
    else
      insert into public.match_card_events(match_id,player_id,player_name,team_name,card_type,minute_text,updated_at)
      values(p_match_id,v_player_id,coalesce(nullif(trim(v_item->>'player_name'),''),'Inconnu'),nullif(v_item->>'team_name',''),coalesce(nullif(v_item->>'card_type',''),'yellow'),nullif(v_item->>'minute_text',''),now());
    end if;
  end loop;

  -- Toute personne dont un événement ou un remplacement prouve l entrée en jeu doit avoir une ligne d apparition.
  for v_player_id in
    select distinct u.pid from unnest(coalesce(v_appeared,array[]::uuid[])) as u(pid) where u.pid is not null
  loop
    if not exists(select 1 from public.match_appearances where match_id=p_match_id and player_id=v_player_id) then
      insert into public.match_appearances(match_id,player_id,player_name,starter,appeared,squad_status,verification)
      select p_match_id,p.id,p.display_name,false,true,'Remplaçant(e)','validated-event'
      from public.players p where p.id=v_player_id;
    end if;
  end loop;

  update public.match_appearances set appeared=false where match_id=p_match_id;
  update public.match_appearances
  set appeared=true
  where match_id=p_match_id
    and (starter=true or player_id=any(coalesce(v_appeared,array[]::uuid[])));

  -- Compteurs événementiels cohérents avec les événements détaillés.
  update public.match_appearances
  set goals=0,assists=0,yellow_cards=0,red_cards=0
  where match_id=p_match_id;

  update public.match_appearances a
  set goals=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.player_id=a.player_id),
      assists=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.assist_player_id=a.player_id),
      yellow_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('yellow','second_yellow')),
      red_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('red','second_yellow'))
  where a.match_id=p_match_id and a.player_id is not null;

  -- Contrôle avant tout recalcul statistique. Toute erreur annule la transaction entière.
  v_missing:=public.match_sheet_missing_fields(p_match_id);
  if cardinality(v_missing)>0 then
    raise exception 'Feuille incomplète : %',array_to_string(v_missing,', ');
  end if;

  select * into v_match from public.matches where id=p_match_id;
  if coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'france_score' then
    v_result:=case
      when (v_match.manual_overrides->>'france_score')::integer>(case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then (v_match.manual_overrides->>'opponent_score')::integer else v_match.opponent_score end) then 'V'
      when (v_match.manual_overrides->>'france_score')::integer<(case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then (v_match.manual_overrides->>'opponent_score')::integer else v_match.opponent_score end) then 'D'
      else 'N' end;
  else
    v_result:=case
      when v_match.france_score>(case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then (v_match.manual_overrides->>'opponent_score')::integer else v_match.opponent_score end) then 'V'
      when v_match.france_score<(case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then (v_match.manual_overrides->>'opponent_score')::integer else v_match.opponent_score end) then 'D'
      else 'N' end;
  end if;

  delete from public.validated_match_player_stats where match_id=p_match_id;

  insert into public.validated_match_player_stats(
    match_id,player_id,selection_id,appeared,starter,minutes,goals,shirt_number,position_id,position_text,captain,result_code,validated_at
  )
  select
    a.match_id,a.player_id,v_selection_id,true,a.starter,a.minutes,
    coalesce((select count(*)::integer from public.match_goal_events g where g.match_id=a.match_id and g.player_id=a.player_id),0),
    a.shirt_number,a.position_id,a.position,a.captain,v_result,now()
  from public.match_appearances a
  where a.match_id=p_match_id and a.appeared=true and a.player_id is not null;

  get diagnostics v_player_count=row_count;

  select coalesce(array_agg(distinct player_id),array[]::uuid[]) into v_appeared
  from public.validated_match_player_stats where match_id=p_match_id;
  v_affected:=coalesce(v_affected,array[]::uuid[])||coalesce(v_appeared,array[]::uuid[]);

  for v_player_id in
    select distinct u.pid from unnest(coalesce(v_affected,array[]::uuid[])) as u(pid) where u.pid is not null
  loop
    perform public.refresh_player_from_validated_sheets(v_player_id);
  end loop;

  update public.matches
  set sheet_validation_status='validated',
      sheet_validated_at=now(),
      sheet_validated_by=auth.uid(),
      sheet_validation_revision=coalesce(sheet_validation_revision,0)+1,
      lineup_status='Feuille validée · statistiques synchronisées',
      updated_at=now()
  where id=p_match_id
  returning sheet_validation_revision into v_revision;

  perform public.recalculate_match_numbers();

  return jsonb_build_object(
    'ok',true,
    'match_id',p_match_id,
    'player_count',v_player_count,
    'revision',v_revision,
    'chronological_number',(select chronological_number from public.matches where id=p_match_id)
  );
end
$$;

revoke all on function public.validate_match_sheet(uuid,jsonb,jsonb,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.validate_match_sheet(uuid,jsonb,jsonb,jsonb,jsonb,uuid) to authenticated;

-- Recalcule immédiatement la numérotation existante.
select public.recalculate_match_numbers();

commit;
-- 3615 Bleus V1.2.7 — Copyright photos + référentiel Ballons
-- À exécuter sur une base existante avant le déploiement du front V1.2.7.

begin;

-- ---------------------------------------------------------------------------
-- 1) Copyright personnalisable des photos
-- ---------------------------------------------------------------------------
alter table public.players
  add column if not exists photo_copyright_source text,
  add column if not exists action_photo_copyright_source text;

alter table public.personnel
  add column if not exists photo_copyright_source text;

alter table public.places
  add column if not exists photo_copyright_source text;

alter table public.jerseys
  add column if not exists main_photo_copyright_source text;

alter table public.match_media_assets
  add column if not exists image_copyright_source text;

comment on column public.players.photo_copyright_source is 'Source du copyright affiché en capsule sur le portrait joueur.';
comment on column public.players.action_photo_copyright_source is 'Source du copyright affiché sur la photo en match du joueur.';
comment on column public.personnel.photo_copyright_source is 'Source du copyright affiché sur la photo du membre du personnel.';
comment on column public.places.photo_copyright_source is 'Source du copyright affiché sur la photo du lieu.';
comment on column public.jerseys.main_photo_copyright_source is 'Source du copyright de la photo principale du maillot.';
comment on column public.match_media_assets.image_copyright_source is 'Source du copyright de la photo du média de match.';

-- ---------------------------------------------------------------------------
-- 2) Référentiel canonique des ballons
-- ---------------------------------------------------------------------------
create table if not exists public.football_balls (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  manufacturer_id uuid references public.equipment_manufacturers(id) on delete set null,
  manufacturer_alias text,
  competition_entity_id uuid references public.competition_entities(id) on delete set null,
  competition_edition_id uuid references public.competition_editions(id) on delete set null,
  year_start integer,
  year_end integer,
  photo_path text,
  photo_url text,
  photo_copyright_source text,
  notes_short text,
  source_media_asset_id uuid references public.match_media_assets(id) on delete set null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists football_balls_comp_entity_idx on public.football_balls(competition_entity_id);
create index if not exists football_balls_comp_edition_idx on public.football_balls(competition_edition_id);
create index if not exists football_balls_manufacturer_idx on public.football_balls(manufacturer_id);
create index if not exists football_balls_year_idx on public.football_balls(year_start,year_end);
create unique index if not exists football_balls_source_media_uidx
  on public.football_balls(source_media_asset_id)
  where source_media_asset_id is not null;

create table if not exists public.match_balls (
  match_id uuid primary key references public.matches(id) on delete cascade,
  ball_id uuid not null references public.football_balls(id) on delete restrict,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists match_balls_ball_idx on public.match_balls(ball_id);

comment on table public.football_balls is 'Référentiel canonique des modèles de ballons utilisés par l’Équipe de France.';
comment on column public.football_balls.manufacturer_alias is 'Alias/libellé équipementier propre au ballon, par exemple adidas, Nike Football, Select.';
comment on table public.match_balls is 'Ballon canonique utilisé sur une feuille de match ; permet les ajouts rapides et les statistiques.';

alter table public.football_balls enable row level security;
alter table public.match_balls enable row level security;

drop policy if exists football_balls_read on public.football_balls;
create policy football_balls_read on public.football_balls for select to anon,authenticated using(true);
drop policy if exists football_balls_insert on public.football_balls;
create policy football_balls_insert on public.football_balls for insert to authenticated with check(public.can_edit());
drop policy if exists football_balls_update on public.football_balls;
create policy football_balls_update on public.football_balls for update to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists football_balls_delete on public.football_balls;
create policy football_balls_delete on public.football_balls for delete to authenticated using(public.can_edit());

drop policy if exists match_balls_read on public.match_balls;
create policy match_balls_read on public.match_balls for select to anon,authenticated using(true);
drop policy if exists match_balls_insert on public.match_balls;
create policy match_balls_insert on public.match_balls for insert to authenticated with check(public.can_edit());
drop policy if exists match_balls_update on public.match_balls;
create policy match_balls_update on public.match_balls for update to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists match_balls_delete on public.match_balls;
create policy match_balls_delete on public.match_balls for delete to authenticated using(public.can_edit());

grant select on public.football_balls,public.match_balls to anon,authenticated;
grant insert,update,delete on public.football_balls,public.match_balls to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Reprise automatique des ballons déjà présents comme médias de match
--    Une entrée par média historique : aucun ancien contenu n’est supprimé.
-- ---------------------------------------------------------------------------
insert into public.football_balls(
  model_name,manufacturer_alias,competition_entity_id,competition_edition_id,
  year_start,year_end,photo_path,photo_url,photo_copyright_source,notes_short,
  source_media_asset_id,created_by,created_at,updated_at
)
select
  coalesce(nullif(trim(a.title),''),'Ballon du match'),
  null,
  ed.competition_entity_id,
  m.competition_edition_id,
  extract(year from (m.match_date at time zone 'Europe/Paris'))::integer,
  extract(year from (m.match_date at time zone 'Europe/Paris'))::integer,
  a.image_path,
  coalesce(a.image_url,a.url),
  a.image_copyright_source,
  'Import automatique depuis un média ballon déjà présent sur une feuille de match.',
  a.id,
  a.created_by,
  coalesce(a.created_at,now()),
  now()
from public.match_media_assets a
join public.matches m on m.id=a.match_id
left join public.competition_editions ed on ed.id=m.competition_edition_id
where a.asset_type='ball'
  and not exists(select 1 from public.football_balls b where b.source_media_asset_id=a.id);

insert into public.match_balls(match_id,ball_id,created_by,created_at,updated_at)
select a.match_id,b.id,a.created_by,coalesce(a.created_at,now()),now()
from public.match_media_assets a
join public.football_balls b on b.source_media_asset_id=a.id
where a.asset_type='ball'
on conflict(match_id) do nothing;

-- Les futurs médias de type "ball" restent automatiquement synchronisés avec le référentiel.
create or replace function public.sync_match_media_ball_to_library()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_ball_id uuid;
  v_year integer;
  v_edition uuid;
  v_entity uuid;
begin
  if new.asset_type <> 'ball' then return new; end if;
  select extract(year from (m.match_date at time zone 'Europe/Paris'))::integer,
         m.competition_edition_id,
         ed.competition_entity_id
    into v_year,v_edition,v_entity
  from public.matches m
  left join public.competition_editions ed on ed.id=m.competition_edition_id
  where m.id=new.match_id;

  select id into v_ball_id from public.football_balls where source_media_asset_id=new.id limit 1;
  if v_ball_id is null then
    insert into public.football_balls(
      model_name,competition_entity_id,competition_edition_id,year_start,year_end,
      photo_path,photo_url,photo_copyright_source,notes_short,source_media_asset_id,created_by
    ) values(
      coalesce(nullif(trim(new.title),''),'Ballon du match'),v_entity,v_edition,v_year,v_year,
      new.image_path,coalesce(new.image_url,new.url),new.image_copyright_source,
      'Synchronisé depuis le média ballon de la feuille de match.',new.id,new.created_by
    ) returning id into v_ball_id;
  else
    update public.football_balls set
      model_name=coalesce(nullif(trim(new.title),''),model_name),
      competition_entity_id=coalesce(v_entity,competition_entity_id),
      competition_edition_id=coalesce(v_edition,competition_edition_id),
      year_start=coalesce(year_start,v_year),year_end=coalesce(year_end,v_year),
      photo_path=coalesce(new.image_path,photo_path),
      photo_url=coalesce(new.image_url,new.url,photo_url),
      photo_copyright_source=new.image_copyright_source,
      updated_at=now()
    where id=v_ball_id;
  end if;

  insert into public.match_balls(match_id,ball_id,created_by,updated_at)
  values(new.match_id,v_ball_id,new.created_by,now())
  on conflict(match_id) do update set ball_id=excluded.ball_id,updated_at=now();
  return new;
end
$$;

revoke all on function public.sync_match_media_ball_to_library() from public,anon,authenticated;
drop trigger if exists trg_match_media_ball_library on public.match_media_assets;
create trigger trg_match_media_ball_library
after insert or update of asset_type,title,image_path,image_url,url,image_copyright_source
on public.match_media_assets
for each row execute function public.sync_match_media_ball_to_library();

commit;

-- 3615 Bleus V1.2.10 — Validation rapide + Livres + Buts notés + Panini
-- À exécuter sur une base existante avant le déploiement du front V1.2.10.

begin;

-- ---------------------------------------------------------------------------
-- 1) Livres
-- ---------------------------------------------------------------------------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  isbn text,
  edition_text text,
  publication_year integer,
  publisher text,
  photo_path text,
  photo_url text,
  photo_copyright_source text,
  notes_short text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists books_year_idx on public.books(publication_year);
create index if not exists books_title_idx on public.books(lower(title));
alter table public.books enable row level security;
drop policy if exists books_read on public.books;
create policy books_read on public.books for select to anon,authenticated using(true);
drop policy if exists books_write on public.books;
create policy books_write on public.books for all to authenticated using(public.can_edit()) with check(public.can_edit());
grant select on public.books to anon,authenticated;
grant insert,update,delete on public.books to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Buts : lecteur interne + notes 1 → 100
-- ---------------------------------------------------------------------------
alter table public.match_goal_events
  add column if not exists video_url text,
  add column if not exists video_title text;

create table if not exists public.goal_ratings (
  goal_id uuid not null references public.match_goal_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check(rating between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(goal_id,user_id)
);
create index if not exists goal_ratings_goal_idx on public.goal_ratings(goal_id);
alter table public.goal_ratings enable row level security;
drop policy if exists goal_ratings_read on public.goal_ratings;
create policy goal_ratings_read on public.goal_ratings for select to anon,authenticated using(true);
drop policy if exists goal_ratings_insert on public.goal_ratings;
create policy goal_ratings_insert on public.goal_ratings for insert to authenticated with check(user_id=auth.uid());
drop policy if exists goal_ratings_update on public.goal_ratings;
create policy goal_ratings_update on public.goal_ratings for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists goal_ratings_delete on public.goal_ratings;
create policy goal_ratings_delete on public.goal_ratings for delete to authenticated using(user_id=auth.uid());
grant select on public.goal_ratings to anon,authenticated;
grant insert,update,delete on public.goal_ratings to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Panini : albums + stickers
-- ---------------------------------------------------------------------------
create table if not exists public.panini_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  edition_text text,
  publication_year integer,
  publisher text not null default 'Panini',
  competition_entity_id uuid references public.competition_entities(id) on delete set null,
  competition_edition_id uuid references public.competition_editions(id) on delete set null,
  cover_path text,
  cover_url text,
  cover_copyright_source text,
  notes_short text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists panini_albums_year_idx on public.panini_albums(publication_year);

create table if not exists public.panini_stickers (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.panini_albums(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  sticker_number text,
  title text,
  image_path text,
  image_url text,
  image_copyright_source text,
  notes_short text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists panini_stickers_album_idx on public.panini_stickers(album_id,sort_order);
create unique index if not exists panini_stickers_album_number_uidx
  on public.panini_stickers(album_id,sticker_number)
  where sticker_number is not null and trim(sticker_number)<>'';

alter table public.panini_albums enable row level security;
alter table public.panini_stickers enable row level security;
drop policy if exists panini_albums_read on public.panini_albums;
create policy panini_albums_read on public.panini_albums for select to anon,authenticated using(true);
drop policy if exists panini_albums_write on public.panini_albums;
create policy panini_albums_write on public.panini_albums for all to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists panini_stickers_read on public.panini_stickers;
create policy panini_stickers_read on public.panini_stickers for select to anon,authenticated using(true);
drop policy if exists panini_stickers_write on public.panini_stickers;
create policy panini_stickers_write on public.panini_stickers for all to authenticated using(public.can_edit()) with check(public.can_edit());
grant select on public.panini_albums,public.panini_stickers to anon,authenticated;
grant insert,update,delete on public.panini_albums,public.panini_stickers to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Validation rapide : uniquement une feuille déjà complète en base
-- ---------------------------------------------------------------------------
create or replace function public.quick_validatable_match_sheets()
returns table(
  match_id uuid,
  chronological_number integer,
  match_date timestamptz,
  opponent_name text,
  sheet_validation_status text
)
language sql
stable
security invoker
set search_path=public
as $$
  select m.id,m.chronological_number,m.match_date,o.name,m.sheet_validation_status
  from public.matches m
  left join public.opponents o on o.id=m.opponent_id
  where m.gender='M'
    and m.selection_category='A'
    and m.match_date < now()
    and coalesce(m.sheet_validation_status,'draft') <> 'validated'
    and cardinality(public.match_sheet_missing_fields(m.id))=0
  order by m.match_date desc,m.chronological_number desc;
$$;
revoke all on function public.quick_validatable_match_sheets() from public,anon;
grant execute on function public.quick_validatable_match_sheets() to authenticated;

create or replace function public.quick_validate_existing_match_sheet(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_match public.matches%rowtype;
  v_selection_id uuid;
  v_missing text[];
  v_result text;
  v_player_id uuid;
  v_affected uuid[]:=array[]::uuid[];
  v_count integer:=0;
  v_revision integer:=0;
  v_france_score integer;
  v_opponent_score integer;
begin
  if auth.uid() is null or not public.can_edit() then
    raise exception 'Modification non autorisée';
  end if;

  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'Match introuvable'; end if;
  v_selection_id:=v_match.selection_team_id;
  if v_selection_id is null then raise exception 'Sélection interne manquante'; end if;

  v_missing:=public.match_sheet_missing_fields(p_match_id);
  if cardinality(v_missing)>0 then
    raise exception 'Feuille incomplète : %',array_to_string(v_missing,', ');
  end if;

  select coalesce(array_agg(distinct player_id),array[]::uuid[]) into v_affected
  from public.validated_match_player_stats
  where match_id=p_match_id and player_id is not null;

  -- Les titulaires ont nécessairement joué.
  update public.match_appearances
  set appeared=true
  where match_id=p_match_id and starter=true;

  -- Les entrants explicitement liés comme remplaçants ont joué.
  update public.match_appearances a
  set appeared=true
  where a.match_id=p_match_id
    and a.player_id is not null
    and exists(
      select 1 from public.match_appearances x
      where x.match_id=p_match_id and x.replaced_by_player_id=a.player_id
    );

  -- Un buteur/passeur/cartonné français présent dans la feuille a joué.
  update public.match_appearances a
  set appeared=true
  where a.match_id=p_match_id and a.player_id is not null
    and (
      exists(select 1 from public.match_goal_events g where g.match_id=p_match_id and (g.player_id=a.player_id or g.assist_player_id=a.player_id))
      or exists(select 1 from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id)
    );

  update public.match_appearances a
  set goals=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.player_id=a.player_id and coalesce(g.is_own_goal,false)=false),
      assists=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.assist_player_id=a.player_id),
      yellow_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('yellow','second_yellow')),
      red_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('red','second_yellow'))
  where a.match_id=p_match_id and a.player_id is not null;

  v_france_score:=case
    when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'france_score'
      then (v_match.manual_overrides->>'france_score')::integer
    else v_match.france_score
  end;
  v_opponent_score:=case
    when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score'
      then (v_match.manual_overrides->>'opponent_score')::integer
    else v_match.opponent_score
  end;
  v_result:=case when v_france_score>v_opponent_score then 'V' when v_france_score<v_opponent_score then 'D' else 'N' end;

  delete from public.validated_match_player_stats where match_id=p_match_id;
  insert into public.validated_match_player_stats(
    match_id,player_id,selection_id,appeared,starter,minutes,goals,shirt_number,
    position_id,position_text,captain,result_code,validated_at
  )
  select a.match_id,a.player_id,v_selection_id,true,a.starter,a.minutes,
         coalesce(a.goals,0),a.shirt_number,a.position_id,a.position,a.captain,v_result,now()
  from public.match_appearances a
  where a.match_id=p_match_id and a.appeared=true and a.player_id is not null;
  get diagnostics v_count=row_count;

  select coalesce(v_affected,array[]::uuid[]) || coalesce(array_agg(distinct player_id),array[]::uuid[])
  into v_affected
  from public.validated_match_player_stats
  where match_id=p_match_id;

  for v_player_id in
    select distinct u.pid from unnest(coalesce(v_affected,array[]::uuid[])) as u(pid) where u.pid is not null
  loop
    perform public.refresh_player_from_validated_sheets(v_player_id);
  end loop;

  update public.matches
  set sheet_validation_status='validated',
      sheet_validated_at=now(),
      sheet_validated_by=auth.uid(),
      sheet_validation_revision=coalesce(sheet_validation_revision,0)+1,
      lineup_status='Feuille validée · statistiques synchronisées',
      updated_at=now()
  where id=p_match_id
  returning sheet_validation_revision into v_revision;

  return jsonb_build_object('ok',true,'match_id',p_match_id,'player_count',v_count,'revision',v_revision);
end
$$;
revoke all on function public.quick_validate_existing_match_sheet(uuid) from public,anon,authenticated;
grant execute on function public.quick_validate_existing_match_sheet(uuid) to authenticated;

commit;
-- 3615 Bleus V1.2.10.2 — Upload direct des vidéos de buts
-- Crée un bucket public dédié aux clips vidéo. Les URL sont enregistrées dans match_goal_events.video_url.

begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'goal-videos',
  'goal-videos',
  true,
  52428800,
  array['video/mp4','video/webm','video/quicktime','video/x-m4v']::text[]
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists goal_videos_select on storage.objects;
drop policy if exists goal_videos_insert on storage.objects;
drop policy if exists goal_videos_update on storage.objects;
drop policy if exists goal_videos_delete on storage.objects;

create policy goal_videos_select on storage.objects
for select to anon,authenticated
using(bucket_id='goal-videos');

create policy goal_videos_insert on storage.objects
for insert to authenticated
with check(bucket_id='goal-videos' and public.can_edit());

create policy goal_videos_update on storage.objects
for update to authenticated
using(bucket_id='goal-videos' and public.can_edit())
with check(bucket_id='goal-videos' and public.can_edit());

create policy goal_videos_delete on storage.objects
for delete to authenticated
using(bucket_id='goal-videos' and public.can_edit());

commit;


-- 3615 Bleus V1.2.10.6 — Photo d’équipe dans les médias de match
-- À exécuter sur une base existante avant d’ajouter une Photo d’équipe.

begin;

alter table public.match_media_assets
  drop constraint if exists match_media_assets_type_check;

alter table public.match_media_assets
  add constraint match_media_assets_type_check
  check (asset_type = any(array['newspaper_front','team_photo','ticket','youtube','ball']::text[]));

comment on table public.match_media_assets is
  'Médias reliés à une tuile match : une de journal, photo d’équipe, ballon, billet historique ou lien vidéo YouTube.';

commit;

-- ============================================================================
-- V1.3.12 — FEUILLES SANS VALIDATION / SOURCE DE VERITE COURANTE
-- ============================================================================

-- 3615 Bleus V1.3.12 — suppression du système de validation des feuilles
-- La feuille courante est la source de vérité. Toute modification remplace l'état précédent.
-- Les agrégats sont reconstruits depuis les lignes courantes, donc une information ne compte qu'une fois.

begin;

-- ---------------------------------------------------------------------------
-- 1) Supprimer les déclencheurs de validation / revalidation historiques
-- ---------------------------------------------------------------------------
drop trigger if exists trg_match_appearances_sheet_dirty on public.match_appearances;
drop trigger if exists trg_match_goals_sheet_dirty on public.match_goal_events;
drop trigger if exists trg_match_cards_sheet_dirty on public.match_card_events;
drop trigger if exists trg_matches_sheet_dirty on public.matches;
drop trigger if exists trg_team_type_after_validation on public.matches;
drop trigger if exists trg_match_officials_sheet_dirty on public.match_officials;
drop trigger if exists trg_match_jerseys_sheet_dirty on public.match_jerseys;

-- ---------------------------------------------------------------------------
-- 2) Les tags de poste sont désormais dérivés des feuilles courantes
-- ---------------------------------------------------------------------------
create or replace function public.sync_player_position_tags(p_player_id uuid)
returns void
language plpgsql
security invoker
set search_path='public'
as $$
begin
  if p_player_id is null then return; end if;

  delete from public.entity_tags et
  using public.tags t
  where et.entity_type='player'
    and et.entity_id=p_player_id
    and et.tag_id=t.id
    and t.reference_scope='position';

  insert into public.entity_tags(entity_type,entity_id,tag_id,added_by)
  select distinct 'player',p_player_id,fp.tag_id,null::uuid
  from public.match_appearances ma
  join public.matches m on m.id=ma.match_id
  join public.football_positions fp on fp.id=ma.position_id
  where ma.player_id=p_player_id
    and m.match_date<=now()
    and (coalesce(ma.starter,false) or coalesce(ma.appeared,false))
  on conflict(entity_type,entity_id,tag_id) do nothing;
end
$$;

-- ---------------------------------------------------------------------------
-- 3) Recalcul idempotent des agrégats joueur depuis les feuilles courantes
-- ---------------------------------------------------------------------------
create or replace function public.refresh_players_from_match_sheets(p_player_ids uuid[])
returns integer
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_ids uuid[];
  v_cap_id uuid;
  v_count integer:=0;
begin
  select coalesce(array_agg(distinct x),array[]::uuid[])
    into v_ids
  from unnest(coalesce(p_player_ids,array[]::uuid[])) x
  where x is not null;

  if cardinality(v_ids)=0 then return 0; end if;
  v_count:=cardinality(v_ids);

  -- Remise à zéro uniquement des agrégats calculés. Les métadonnées comme le
  -- numéro d'international restent intactes.
  update public.player_selection_stats
  set selections=0,goals=0,wins=0,draws=0,losses=0,starts=0,minutes=0,
      appearance_status='called_only',data_status='match_sheets_live',updated_at=now()
  where player_id=any(v_ids);

  with live as (
    select
      a.player_id,
      m.selection_team_id selection_id,
      m.match_date,
      coalesce(a.starter,false) starter,
      coalesce(a.minutes,0) minutes,
      coalesce(a.goals,0) goals,
      case
        when (m.manual_overrides ? 'france_score') and coalesce(m.manual_overrides->>'france_score','') ~ '^-?[0-9]+$'
          then (m.manual_overrides->>'france_score')::integer
        else m.france_score
      end france_score_eff,
      case
        when (m.manual_overrides ? 'opponent_score') and coalesce(m.manual_overrides->>'opponent_score','') ~ '^-?[0-9]+$'
          then (m.manual_overrides->>'opponent_score')::integer
        else m.opponent_score
      end opponent_score_eff
    from public.match_appearances a
    join public.matches m on m.id=a.match_id
    where a.player_id=any(v_ids)
      and m.selection_team_id is not null
      and m.match_date<=now()
      and (coalesce(a.starter,false) or coalesce(a.appeared,false))
  ), agg as (
    select
      player_id,selection_id,
      count(*)::integer selections,
      coalesce(sum(goals),0)::integer goals,
      count(*) filter(where france_score_eff is not null and opponent_score_eff is not null and france_score_eff>opponent_score_eff)::integer wins,
      count(*) filter(where france_score_eff is not null and opponent_score_eff is not null and france_score_eff=opponent_score_eff)::integer draws,
      count(*) filter(where france_score_eff is not null and opponent_score_eff is not null and france_score_eff<opponent_score_eff)::integer losses,
      count(*) filter(where starter)::integer starts,
      coalesce(sum(minutes),0)::integer minutes,
      min(extract(year from match_date))::integer first_year,
      max(extract(year from match_date))::integer last_year,
      min(match_date)::date first_selection_date
    from live
    group by player_id,selection_id
  )
  insert into public.player_selection_stats(
    player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,
    appearance_status,first_year,last_year,first_selection_date,data_status,updated_at
  )
  select
    player_id,selection_id,selections,goals,wins,draws,losses,starts,minutes,
    'capped',first_year,last_year,first_selection_date,'match_sheets_live',now()
  from agg
  on conflict(player_id,selection_id) do update set
    selections=excluded.selections,
    goals=excluded.goals,
    wins=excluded.wins,
    draws=excluded.draws,
    losses=excluded.losses,
    starts=excluded.starts,
    minutes=excluded.minutes,
    appearance_status='capped',
    first_year=excluded.first_year,
    last_year=excluded.last_year,
    first_selection_date=excluded.first_selection_date,
    data_status='match_sheets_live',
    updated_at=now();

  delete from public.player_jersey_numbers where player_id=any(v_ids);
  insert into public.player_jersey_numbers(
    player_id,selection_id,shirt_number,first_match_date,last_match_date,appearances_count,notes_short
  )
  select
    a.player_id,m.selection_team_id,a.shirt_number,
    min(m.match_date)::date,max(m.match_date)::date,count(*)::integer,
    'Calculé depuis la feuille de match courante.'
  from public.match_appearances a
  join public.matches m on m.id=a.match_id
  where a.player_id=any(v_ids)
    and a.shirt_number is not null
    and m.selection_team_id is not null
    and m.match_date<=now()
    and (coalesce(a.starter,false) or coalesce(a.appeared,false))
  group by a.player_id,m.selection_team_id,a.shirt_number;

  update public.players p
  set
    primary_position=(
      select coalesce(fp.label_text,a.position)
      from public.match_appearances a
      join public.matches m on m.id=a.match_id
      left join public.football_positions fp on fp.id=a.position_id
      where a.player_id=p.id
        and m.match_date<=now()
        and (coalesce(a.starter,false) or coalesce(a.appeared,false))
        and coalesce(fp.label_text,a.position) is not null
      group by coalesce(fp.label_text,a.position)
      order by count(*) desc,min(m.match_date),coalesce(fp.label_text,a.position)
      limit 1
    ),
    secondary_positions=coalesce((
      select array_agg(q.label order by q.n desc,q.first_seen,q.label)
      from (
        select coalesce(fp.label_text,a.position) label,count(*) n,min(m.match_date) first_seen
        from public.match_appearances a
        join public.matches m on m.id=a.match_id
        left join public.football_positions fp on fp.id=a.position_id
        where a.player_id=p.id
          and m.match_date<=now()
          and (coalesce(a.starter,false) or coalesce(a.appeared,false))
          and coalesce(fp.label_text,a.position) is not null
        group by coalesce(fp.label_text,a.position)
      ) q
      where q.label is distinct from (
        select coalesce(fp2.label_text,a2.position)
        from public.match_appearances a2
        join public.matches m2 on m2.id=a2.match_id
        left join public.football_positions fp2 on fp2.id=a2.position_id
        where a2.player_id=p.id
          and m2.match_date<=now()
          and (coalesce(a2.starter,false) or coalesce(a2.appeared,false))
          and coalesce(fp2.label_text,a2.position) is not null
        group by coalesce(fp2.label_text,a2.position)
        order by count(*) desc,min(m2.match_date),coalesce(fp2.label_text,a2.position)
        limit 1
      )
    ),array[]::text[]),
    updated_at=now()
  where p.id=any(v_ids);

  select id into v_cap_id from public.achievements where slug='capitanat' limit 1;
  if v_cap_id is not null then
    delete from public.player_achievements
    where player_id=any(v_ids) and achievement_id=v_cap_id;

    insert into public.player_achievements(
      player_id,selection_id,achievement_id,achievement_value,notes_short,added_by
    )
    select
      a.player_id,m.selection_team_id,v_cap_id,count(*)::integer,
      'Calculé depuis la feuille de match courante.',auth.uid()
    from public.match_appearances a
    join public.matches m on m.id=a.match_id
    where a.player_id=any(v_ids)
      and m.selection_team_id is not null
      and m.match_date<=now()
      and coalesce(a.captain,false)
      and (coalesce(a.starter,false) or coalesce(a.appeared,false))
    group by a.player_id,m.selection_team_id
    on conflict(player_id,achievement_id,selection_id) do update set
      achievement_value=excluded.achievement_value,
      notes_short=excluded.notes_short;
  end if;

  perform public.sync_player_position_tags(x)
  from unnest(v_ids) x;

  return v_count;
end
$$;

revoke all on function public.refresh_players_from_match_sheets(uuid[]) from public,anon,authenticated;

create or replace function public.sync_player_position_tags_trigger()
returns trigger
language plpgsql
security invoker
set search_path='public'
as $$
begin
  if current_setting('bleus.bulk_sheet_save',true)='1' then
    return case when tg_op='DELETE' then old else new end;
  end if;
  if tg_op='DELETE' then perform public.sync_player_position_tags(old.player_id); return old; end if;
  perform public.sync_player_position_tags(new.player_id);
  if tg_op='UPDATE' and old.player_id is distinct from new.player_id then perform public.sync_player_position_tags(old.player_id); end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- 4) Normaliser l'état courant d'une feuille avant recalcul statistique
-- ---------------------------------------------------------------------------
create or replace function public.sync_match_sheet_current_state(
  p_match_id uuid,
  p_extra_players uuid[] default array[]::uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_ids uuid[]:=array[]::uuid[];
begin
  if p_match_id is null then return v_ids; end if;

  -- Un remplaçant ou un joueur présent dans un fait de jeu France doit avoir
  -- une ligne d'apparition unique pour le match. L'unicité (match_id,player_id)
  -- empêche tout double comptage lors des éditions successives.
  with implied as (
    select replaced_by_player_id pid
    from public.match_appearances
    where match_id=p_match_id and replaced_by_player_id is not null
    union
    select player_id from public.match_goal_events
    where match_id=p_match_id and player_id is not null and public.sheet_name_key(coalesce(team_name,'France'))='france'
    union
    select assist_player_id from public.match_goal_events
    where match_id=p_match_id and assist_player_id is not null and public.sheet_name_key(coalesce(team_name,'France'))='france'
    union
    select player_id from public.match_card_events
    where match_id=p_match_id and player_id is not null and public.sheet_name_key(coalesce(team_name,'France'))='france'
  )
  insert into public.match_appearances(match_id,player_id,player_name,starter,appeared,squad_status)
  select p_match_id,p.id,p.display_name,false,true,'Remplaçant(e)'
  from implied i
  join public.players p on p.id=i.pid
  on conflict(match_id,player_id) do nothing;

  update public.match_appearances a
  set appeared=(
    coalesce(a.starter,false)
    or coalesce(a.minutes,0)>0
    or exists(select 1 from public.match_appearances s where s.match_id=p_match_id and s.replaced_by_player_id=a.player_id)
    or exists(select 1 from public.match_goal_events g where g.match_id=p_match_id and (g.player_id=a.player_id or g.assist_player_id=a.player_id))
    or exists(select 1 from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id)
  )
  where a.match_id=p_match_id;

  update public.match_appearances a
  set
    goals=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.player_id=a.player_id),
    assists=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.assist_player_id=a.player_id),
    yellow_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('yellow','second_yellow')),
    red_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('red','second_yellow'))
  where a.match_id=p_match_id and a.player_id is not null;

  select coalesce(array_agg(distinct pid),array[]::uuid[])
    into v_ids
  from (
    select player_id pid from public.match_appearances where match_id=p_match_id and player_id is not null
    union select player_id from public.match_goal_events where match_id=p_match_id and player_id is not null
    union select assist_player_id from public.match_goal_events where match_id=p_match_id and assist_player_id is not null
    union select player_id from public.match_card_events where match_id=p_match_id and player_id is not null
    union select x from unnest(coalesce(p_extra_players,array[]::uuid[])) x where x is not null
  ) q;

  perform public.refresh_players_from_match_sheets(v_ids);
  return v_ids;
end
$$;

revoke all on function public.sync_match_sheet_current_state(uuid,uuid[]) from public,anon,authenticated;

-- ---------------------------------------------------------------------------
-- 5) Sauvegarde atomique : une seule RPC, aucun passage "brouillon -> validé"
-- ---------------------------------------------------------------------------
create or replace function public.save_match_sheet(
  p_match_id uuid,
  p_appearances jsonb default '[]'::jsonb,
  p_goals jsonb default '[]'::jsonb,
  p_cards jsonb default '[]'::jsonb,
  p_context jsonb default '{}'::jsonb,
  p_jersey_id uuid default null,
  p_ball_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_match public.matches%rowtype;
  v_selection_id uuid;
  v_item jsonb;
  v_id uuid;
  v_player_id uuid;
  v_replacement_id uuid;
  v_assist_id uuid;
  v_place_id uuid;
  v_coach_id uuid;
  v_referee_id uuid;
  v_competition_id uuid;
  v_edition_id uuid;
  v_stadium text:=nullif(trim(coalesce(p_context->>'stadium','')),'');
  v_city text:=nullif(trim(coalesce(p_context->>'city','')),'');
  v_coach text:=nullif(trim(coalesce(p_context->>'coach','')),'');
  v_referee text:=nullif(trim(coalesce(p_context->>'referee','')),'');
  v_competition text:=nullif(trim(coalesce(p_context->>'competition_name','')),'');
  v_old_players uuid[]:=array[]::uuid[];
  v_affected uuid[]:=array[]::uuid[];
  v_count integer:=0;
  v_old_manager_key text;
  v_new_manager_key text;
begin
  if auth.uid() is null or not public.can_edit() then raise exception 'Modification non autorisée'; end if;
  if jsonb_typeof(coalesce(p_appearances,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_goals,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_cards,'[]'::jsonb))<>'array' then
    raise exception 'Payload de feuille invalide';
  end if;

  perform set_config('bleus.bulk_sheet_save','1',true);

  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'Match introuvable'; end if;
  v_selection_id:=v_match.selection_team_id;
  if v_selection_id is null then raise exception 'Sélection interne manquante pour ce match'; end if;
  v_old_manager_key:=public.team_type_manager_key(p_match_id);

  select coalesce(array_agg(distinct pid),array[]::uuid[]) into v_old_players
  from (
    select player_id pid from public.match_appearances where match_id=p_match_id and player_id is not null
    union select replaced_by_player_id from public.match_appearances where match_id=p_match_id and replaced_by_player_id is not null
    union select player_id from public.match_goal_events where match_id=p_match_id and player_id is not null
    union select assist_player_id from public.match_goal_events where match_id=p_match_id and assist_player_id is not null
    union select player_id from public.match_card_events where match_id=p_match_id and player_id is not null
  ) q;

  if v_stadium is not null then v_place_id:=public.resolve_or_create_sheet_place(v_stadium,v_city); end if;
  if v_coach is not null then v_coach_id:=public.resolve_or_create_sheet_personnel(v_coach,'selectionneur'); end if;
  if v_referee is not null then v_referee_id:=public.resolve_or_create_sheet_personnel(v_referee,'arbitre'); end if;

  if nullif(p_context->>'competition_edition_id','') is not null then
    v_edition_id:=(p_context->>'competition_edition_id')::uuid;
    select c.id into v_competition_id
    from public.competitions c
    where c.canonical_edition_id=v_edition_id
      and (c.gender is null or c.gender=v_match.gender)
      and (c.selection_category is null or c.selection_category=v_match.selection_category)
    order by c.created_at nulls last,c.id limit 1;
  elsif v_competition is not null then
    select c.id,c.canonical_edition_id into v_competition_id,v_edition_id
    from public.competitions c
    where public.sheet_name_key(c.name)=public.sheet_name_key(v_competition)
      and (c.gender is null or c.gender=v_match.gender)
      and (c.selection_category is null or c.selection_category=v_match.selection_category)
    order by c.created_at nulls last,c.id limit 1;
  end if;

  update public.matches
  set place_id=v_place_id,
      coach_id=v_coach_id,
      competition_id=coalesce(v_competition_id,competition_id),
      competition_edition_id=v_edition_id,
      sheet_stadium_name=v_stadium,
      sheet_city_name=v_city,
      sheet_referee_name=v_referee,
      sheet_coach_name=v_coach,
      sheet_competition_name=v_competition,
      lineup_status=case when jsonb_array_length(coalesce(p_appearances,'[]'::jsonb))>0
                         then 'Feuille de match · '||jsonb_array_length(coalesce(p_appearances,'[]'::jsonb))||' joueurs'
                         else null end,
      updated_at=now()
  where id=p_match_id;

  delete from public.match_officials mo
  where mo.match_id=p_match_id
    and mo.role ~* '(arbitre|referee)'
    and mo.role !~* '(assistant|assistante|video|var|linesman|lineswoman|fourth|quatri|4e|4eme|reserve)';
  if v_referee_id is not null then
    insert into public.match_officials(match_id,person_id,role)
    values(p_match_id,v_referee_id,'Arbitre principal')
    on conflict(match_id,person_id,role) do nothing;
  end if;

  delete from public.match_jerseys where match_id=p_match_id and coalesce(role,'outfield')='outfield';
  if p_jersey_id is not null then
    insert into public.match_jerseys(match_id,jersey_id,selection_team_id,role,created_by,updated_at)
    values(p_match_id,p_jersey_id,v_selection_id,'outfield',auth.uid(),now());
  end if;

  delete from public.match_balls where match_id=p_match_id;
  if p_ball_id is not null then
    insert into public.match_balls(match_id,ball_id,created_by,updated_at)
    values(p_match_id,p_ball_id,auth.uid(),now());
  end if;

  delete from public.match_appearances a
  where a.match_id=p_match_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_appearances,'[]'::jsonb)) j
      where nullif(j->>'id','') is not null and (j->>'id')::uuid=a.id
    );

  for v_item in select value from jsonb_array_elements(coalesce(p_appearances,'[]'::jsonb)) loop
    v_id:=case when nullif(v_item->>'id','') is null then null else (v_item->>'id')::uuid end;
    v_player_id:=case when nullif(v_item->>'player_id','') is null then null else (v_item->>'player_id')::uuid end;
    if v_player_id is null and nullif(trim(coalesce(v_item->>'player_name','')),'') is not null then
      v_player_id:=public.resolve_or_create_sheet_player(v_item->>'player_name',v_match.gender,v_selection_id);
    end if;
    v_replacement_id:=case when nullif(v_item->>'replaced_by_player_id','') is null then null else (v_item->>'replaced_by_player_id')::uuid end;
    if v_replacement_id is null and nullif(trim(coalesce(v_item->>'replaced_by_name','')),'') is not null then
      v_replacement_id:=public.resolve_or_create_sheet_player(v_item->>'replaced_by_name',v_match.gender,v_selection_id);
    end if;

    if v_id is null and v_player_id is not null then
      select id into v_id from public.match_appearances where match_id=p_match_id and player_id=v_player_id limit 1;
    end if;

    if v_id is not null and exists(select 1 from public.match_appearances where id=v_id and match_id=p_match_id) then
      update public.match_appearances
      set player_id=v_player_id,
          player_name=nullif(trim(coalesce(v_item->>'player_name','')),''),
          starter=coalesce((v_item->>'starter')::boolean,false),
          appeared=false,
          lineup_slot=case when nullif(v_item->>'lineup_slot','') is null then null else (v_item->>'lineup_slot')::integer end,
          minutes=case when nullif(v_item->>'minutes','') is null then null else (v_item->>'minutes')::integer end,
          squad_status=nullif(v_item->>'squad_status',''),
          shirt_number=case when nullif(v_item->>'shirt_number','') is null then null else (v_item->>'shirt_number')::integer end,
          position_id=case when nullif(v_item->>'position_id','') is null then null else (v_item->>'position_id')::uuid end,
          position=nullif(v_item->>'position',''),
          captain=coalesce((v_item->>'captain')::boolean,false),
          replaced_by_player_id=v_replacement_id,
          replaced_by_name=nullif(trim(coalesce(v_item->>'replaced_by_name','')),'')
      where id=v_id;
    else
      insert into public.match_appearances(
        match_id,player_id,player_name,starter,appeared,lineup_slot,minutes,squad_status,
        shirt_number,position_id,position,captain,replaced_by_player_id,replaced_by_name
      ) values(
        p_match_id,v_player_id,nullif(trim(coalesce(v_item->>'player_name','')),''),
        coalesce((v_item->>'starter')::boolean,false),false,
        case when nullif(v_item->>'lineup_slot','') is null then null else (v_item->>'lineup_slot')::integer end,
        case when nullif(v_item->>'minutes','') is null then null else (v_item->>'minutes')::integer end,
        nullif(v_item->>'squad_status',''),
        case when nullif(v_item->>'shirt_number','') is null then null else (v_item->>'shirt_number')::integer end,
        case when nullif(v_item->>'position_id','') is null then null else (v_item->>'position_id')::uuid end,
        nullif(v_item->>'position',''),coalesce((v_item->>'captain')::boolean,false),
        v_replacement_id,nullif(trim(coalesce(v_item->>'replaced_by_name','')),'')
      );
    end if;
  end loop;

  delete from public.match_goal_events g
  where g.match_id=p_match_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb)) j
      where nullif(j->>'id','') is not null and (j->>'id')::uuid=g.id
    );

  for v_item in select value from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb)) loop
    v_id:=case when nullif(v_item->>'id','') is null then null else (v_item->>'id')::uuid end;
    v_player_id:=case when nullif(v_item->>'player_id','') is null then null else (v_item->>'player_id')::uuid end;
    v_assist_id:=case when nullif(v_item->>'assist_player_id','') is null then null else (v_item->>'assist_player_id')::uuid end;

    if public.sheet_name_key(v_item->>'team_name')='france' then
      if v_player_id is null then v_player_id:=public.resolve_or_create_sheet_player(v_item->>'scorer_name',v_match.gender,v_selection_id); end if;
      if v_assist_id is null and nullif(trim(coalesce(v_item->>'assist_name','')),'') is not null then
        v_assist_id:=public.resolve_or_create_sheet_player(v_item->>'assist_name',v_match.gender,v_selection_id);
      end if;
    else
      v_player_id:=null;v_assist_id:=null;
    end if;

    if v_id is not null and exists(select 1 from public.match_goal_events where id=v_id and match_id=p_match_id) then
      update public.match_goal_events
      set player_id=v_player_id,
          scorer_name=coalesce(nullif(trim(v_item->>'scorer_name'),''),'Inconnu'),
          team_name=nullif(v_item->>'team_name',''),
          minute_text=nullif(v_item->>'minute_text',''),
          score_after=nullif(v_item->>'score_after',''),
          assist_player_id=v_assist_id,
          assist_name=nullif(trim(coalesce(v_item->>'assist_name','')),''),
          goal_type=nullif(v_item->>'goal_type',''),
          body_part=nullif(v_item->>'body_part',''),
          is_penalty=coalesce((v_item->>'is_penalty')::boolean,false),
          is_own_goal=coalesce((v_item->>'is_own_goal')::boolean,false),
          updated_at=now()
      where id=v_id;
    else
      insert into public.match_goal_events(
        match_id,player_id,scorer_name,team_name,minute_text,score_after,
        assist_player_id,assist_name,goal_type,body_part,is_penalty,is_own_goal,updated_at
      ) values(
        p_match_id,v_player_id,coalesce(nullif(trim(v_item->>'scorer_name'),''),'Inconnu'),
        nullif(v_item->>'team_name',''),nullif(v_item->>'minute_text',''),nullif(v_item->>'score_after',''),
        v_assist_id,nullif(trim(coalesce(v_item->>'assist_name','')),''),nullif(v_item->>'goal_type',''),
        nullif(v_item->>'body_part',''),coalesce((v_item->>'is_penalty')::boolean,false),
        coalesce((v_item->>'is_own_goal')::boolean,false),now()
      );
    end if;
  end loop;

  delete from public.match_card_events c
  where c.match_id=p_match_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) j
      where nullif(j->>'id','') is not null and (j->>'id')::uuid=c.id
    );

  for v_item in select value from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) loop
    v_id:=case when nullif(v_item->>'id','') is null then null else (v_item->>'id')::uuid end;
    v_player_id:=case when nullif(v_item->>'player_id','') is null then null else (v_item->>'player_id')::uuid end;
    if public.sheet_name_key(v_item->>'team_name')='france' then
      if v_player_id is null then v_player_id:=public.resolve_or_create_sheet_player(v_item->>'player_name',v_match.gender,v_selection_id); end if;
    else
      v_player_id:=null;
    end if;

    if v_id is not null and exists(select 1 from public.match_card_events where id=v_id and match_id=p_match_id) then
      update public.match_card_events
      set player_id=v_player_id,
          player_name=coalesce(nullif(trim(v_item->>'player_name'),''),'Inconnu'),
          team_name=nullif(v_item->>'team_name',''),
          card_type=coalesce(nullif(v_item->>'card_type',''),'yellow'),
          minute_text=nullif(v_item->>'minute_text',''),updated_at=now()
      where id=v_id;
    else
      insert into public.match_card_events(match_id,player_id,player_name,team_name,card_type,minute_text,updated_at)
      values(p_match_id,v_player_id,coalesce(nullif(trim(v_item->>'player_name'),''),'Inconnu'),
             nullif(v_item->>'team_name',''),coalesce(nullif(v_item->>'card_type',''),'yellow'),
             nullif(v_item->>'minute_text',''),now());
    end if;
  end loop;

  v_affected:=public.sync_match_sheet_current_state(p_match_id,v_old_players);
  v_count:=coalesce(cardinality(v_affected),0);

  v_new_manager_key:=public.team_type_manager_key(p_match_id);
  if nullif(v_new_manager_key,'') is not null then
    perform public.enqueue_team_type_recalc_for_manager_from(
      v_new_manager_key,v_selection_id,v_match.match_date,p_match_id,'sheet_change'
    );
  else
    insert into public.team_type_recalc_queue(match_id,source_match_id,reason)
    values(p_match_id,p_match_id,'sheet_change')
    on conflict(match_id) do update set source_match_id=excluded.source_match_id,reason='sheet_change',requested_at=now(),available_at=now(),attempts=0,last_error=null;
  end if;

  if nullif(v_old_manager_key,'') is not null and v_old_manager_key is distinct from v_new_manager_key then
    perform public.enqueue_team_type_recalc_for_manager_from(
      v_old_manager_key,v_selection_id,v_match.match_date,p_match_id,'manager_changed'
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'match_id',p_match_id,
    'player_count',v_count,
    'team_type_queued',true,
    'chronological_number',(select chronological_number from public.matches where id=p_match_id)
  );
end
$$;

revoke all on function public.save_match_sheet(uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid) from public,anon;
grant execute on function public.save_match_sheet(uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Fallback automatique si une donnée de feuille est modifiée hors de la RPC
-- ---------------------------------------------------------------------------
create or replace function public.live_sheet_child_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_match_id uuid;
  v_extra uuid[]:=array[]::uuid[];
  v_key text;
  v_selection_id uuid;
  v_date timestamptz;
begin
  if current_setting('bleus.bulk_sheet_save',true)='1' or pg_trigger_depth()>1 then
    return case when tg_op='DELETE' then old else new end;
  end if;

  v_match_id:=case when tg_op='DELETE' then old.match_id else new.match_id end;

  if tg_table_name='match_appearances' then
    v_extra:=array_remove(array[
      case when tg_op='INSERT' then null else old.player_id end,
      case when tg_op='DELETE' then null else new.player_id end,
      case when tg_op='INSERT' then null else old.replaced_by_player_id end,
      case when tg_op='DELETE' then null else new.replaced_by_player_id end
    ],null);
  elsif tg_table_name='match_goal_events' then
    v_extra:=array_remove(array[
      case when tg_op='INSERT' then null else old.player_id end,
      case when tg_op='DELETE' then null else new.player_id end,
      case when tg_op='INSERT' then null else old.assist_player_id end,
      case when tg_op='DELETE' then null else new.assist_player_id end
    ],null);
  else
    v_extra:=array_remove(array[
      case when tg_op='INSERT' then null else old.player_id end,
      case when tg_op='DELETE' then null else new.player_id end
    ],null);
  end if;

  perform public.sync_match_sheet_current_state(v_match_id,v_extra);

  if tg_table_name='match_appearances' then
    select selection_team_id,match_date into v_selection_id,v_date from public.matches where id=v_match_id;
    v_key:=public.team_type_manager_key(v_match_id);
    if nullif(v_key,'') is not null then
      perform public.enqueue_team_type_recalc_for_manager_from(v_key,v_selection_id,v_date,v_match_id,'lineup_change');
    end if;
  end if;

  return case when tg_op='DELETE' then old else new end;
end
$$;

revoke all on function public.live_sheet_child_sync_trigger() from public,anon,authenticated;

drop trigger if exists trg_live_sheet_appearances_sync on public.match_appearances;
create trigger trg_live_sheet_appearances_sync
after insert or update or delete on public.match_appearances
for each row execute function public.live_sheet_child_sync_trigger();

drop trigger if exists trg_live_sheet_goals_sync on public.match_goal_events;
create trigger trg_live_sheet_goals_sync
after insert or update or delete on public.match_goal_events
for each row execute function public.live_sheet_child_sync_trigger();

drop trigger if exists trg_live_sheet_cards_sync on public.match_card_events;
create trigger trg_live_sheet_cards_sync
after insert or update or delete on public.match_card_events
for each row execute function public.live_sheet_child_sync_trigger();

create or replace function public.live_sheet_match_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_ids uuid[];
  v_key text;
begin
  if current_setting('bleus.bulk_sheet_save',true)='1' or pg_trigger_depth()>1 then return new; end if;

  select coalesce(array_agg(player_id),array[]::uuid[]) into v_ids
  from public.match_appearances
  where match_id=new.id and player_id is not null;
  perform public.refresh_players_from_match_sheets(v_ids);

  if old.coach_id is distinct from new.coach_id
     or old.competition_id is distinct from new.competition_id
     or old.competition_edition_id is distinct from new.competition_edition_id then
    v_key:=public.team_type_manager_key(new.id);
    if nullif(v_key,'') is not null then
      perform public.enqueue_team_type_recalc_for_manager_from(v_key,new.selection_team_id,new.match_date,new.id,'match_context_change');
    end if;
  end if;
  return new;
end
$$;

revoke all on function public.live_sheet_match_sync_trigger() from public,anon,authenticated;

drop trigger if exists trg_live_sheet_match_sync on public.matches;
create trigger trg_live_sheet_match_sync
after update of france_score,opponent_score,selection_team_id,competition_id,competition_edition_id,coach_id
on public.matches
for each row execute function public.live_sheet_match_sync_trigger();

-- ---------------------------------------------------------------------------
-- 7) Nettoyage total de l'ancien système de validation
-- ---------------------------------------------------------------------------
drop function if exists public.team_type_after_validation();
drop function if exists public.mark_match_sheet_child_dirty();
drop function if exists public.mark_match_sheet_match_dirty();
drop function if exists public.quick_validatable_match_sheets();
drop function if exists public.quick_validation_missing_fields(uuid);
drop function if exists public.match_sheet_missing_fields(uuid);
drop function if exists public.quick_validate_existing_match_sheet(uuid);
drop function if exists public.refresh_validated_player_stats(uuid);
drop function if exists public.refresh_player_from_validated_sheets(uuid);
drop function if exists public.validate_match_sheet(uuid,jsonb,jsonb,jsonb,jsonb,uuid);

-- Le Bleu Moyen ne dépend plus du statut de validation. Le champ de compatibilité
-- interne validated_appearances vaut simplement le nombre d'apparitions exploitées.
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='bleu_moyen_player_metrics' and p.prokind='f';
  if v_def is not null then
    v_def:=replace(v_def,'      m.sheet_validation_status,'||chr(10),'');
    v_def:=replace(v_def,$x$      count(*) filter(where x.sheet_validation_status='validated')::integer validated_appearances,$x$,$x$      count(*)::integer validated_appearances,$x$);
    execute v_def;
  end if;
end $$;

-- Le snapshot de validation n'a plus de rôle : la feuille courante est la seule source.
drop table if exists public.validated_match_player_stats;

-- Les colonnes de statut de validation disparaissent également de matches.
alter table public.matches
  drop column if exists sheet_validation_status,
  drop column if exists sheet_validated_at,
  drop column if exists sheet_validated_by,
  drop column if exists sheet_validation_revision;

-- Nettoyage des anciens libellés d'interface stockés.
update public.matches m
set lineup_status=case
  when x.n>0 then 'Feuille de match · '||x.n||' joueurs'
  else null
end,
updated_at=now()
from (
  select m2.id,count(a.id)::integer n
  from public.matches m2
  left join public.match_appearances a on a.match_id=m2.id
  group by m2.id
) x
where m.id=x.id
  and coalesce(m.lineup_status,'') ~* '(valid|revalid|brouillon)';

-- Rebuild unique et idempotent de tous les agrégats existants depuis les feuilles.
select public.refresh_players_from_match_sheets(array_agg(id)) from public.players;

commit;


-- === V1.3.13 — STATIC VISUALS CLEANUP ========================================
-- Les rendus actuels des cadres/bordures sont désormais figés localement.
drop table if exists public.calendar_feature_styles;
drop table if exists public.selection_photo_borders;
drop table if exists public.country_display_colors;
alter table public.matches drop column if exists feature_frame_mode;
