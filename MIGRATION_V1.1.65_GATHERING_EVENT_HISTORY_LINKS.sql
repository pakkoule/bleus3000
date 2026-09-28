-- 3615 Bleus V1.1.65
-- Relie les événements explicites d'un rassemblement à son historique de liste.
-- Non destructif : uniquement un backfill des faits absents.

begin;

insert into public.callup_roster_history (
  callup_id,
  event_date,
  change_type,
  player_id,
  related_player_id,
  previous_status,
  new_status,
  note,
  created_by
)
select
  e.callup_id,
  e.event_date,
  e.event_type as change_type,
  case when e.event_type = 'replacement' then e.related_player_id else e.player_id end as player_id,
  case when e.event_type = 'replacement' then e.player_id else e.related_player_id end as related_player_id,
  null as previous_status,
  case
    when e.event_type = 'withdrawal' then 'withdrawn'
    when e.event_type = 'replacement' then 'replacement'
    when e.event_type = 'reinforcement' then 'reinforcement'
    else null
  end as new_status,
  nullif(concat_ws(' · ', nullif(e.title,''), nullif(e.description,'')), '') as note,
  null as created_by
from public.callup_events e
where e.event_type in ('withdrawal','replacement','reinforcement')
  and not exists (
    select 1
    from public.callup_roster_history h
    where h.callup_id = e.callup_id
      and h.change_type = e.event_type
      and h.event_date = e.event_date
      and h.player_id is not distinct from (case when e.event_type = 'replacement' then e.related_player_id else e.player_id end)
      and h.related_player_id is not distinct from (case when e.event_type = 'replacement' then e.player_id else e.related_player_id end)
  );

commit;
