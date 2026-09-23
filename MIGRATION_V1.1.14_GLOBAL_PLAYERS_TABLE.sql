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
