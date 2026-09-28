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
