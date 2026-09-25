-- ============================================================================
-- 3615 BLEUS — SUPABASE BASELINE V1.1.61.15
-- Généré le 25/09/2026 à partir du setup historique et des migrations
-- présentes dans la V1.1.61.14 CLEANUP.
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
  role text not null default 'user' check (role in ('user','contributor','editor','admin','superadmin')),
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
as $$ select public.current_role() in ('contributor','admin','superadmin') $$;
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

create table if not exists public.user_display_preferences (
  user_id uuid primary key,
  flocking_style text not null default 'france-2024',
  updated_at timestamptz not null default now()
);

comment on table public.user_display_preferences is 'Préférences d’affichage utilisateur : style de flocage global pour tout le site.';
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
 gender text,competition_type text,competition_tag_id uuid not null references public.tags(id) on delete restrict,notes text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.competition_editions(
 id uuid primary key default gen_random_uuid(),competition_entity_id uuid not null references public.competition_entities(id) on delete cascade,
 edition_year integer not null,edition_label text,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
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
