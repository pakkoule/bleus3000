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
