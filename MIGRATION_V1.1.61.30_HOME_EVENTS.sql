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
