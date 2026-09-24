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
