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
