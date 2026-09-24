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
