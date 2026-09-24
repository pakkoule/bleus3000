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
