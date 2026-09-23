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
