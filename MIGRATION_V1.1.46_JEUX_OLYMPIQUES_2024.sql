-- 3615 Bleus V1.1.46 — Jeux Olympiques 2024
insert into public.tags
(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope)
values
('jeux-olympiques','tag','JEUX OLYMPIQUES','🥇',
 array['Jeux Olympiques','Olympics Soccer','Olympic Games','JO'],
 'gradient','#082654','#2563eb',array['#082654','#2563eb','#ffffff','#ef3340'],
 '#ffffff','#082654',135,10,1,null,true,'competition')
on conflict (slug) do update
set label_text='JEUX OLYMPIQUES', aliases=excluded.aliases, reference_scope='competition', is_active=true, updated_at=now();

insert into public.competitions
(name,edition,organizer,competition_type,gender,selection_category,start_date,end_date,host_country,status,external_ids,tag_id)
select
  'Jeux Olympiques 2024','Paris 2024','CIO / FIFA','Tournoi olympique','M','Espoirs/U21',
  '2024-07-24'::date,'2024-08-09'::date,'France','finished',
  jsonb_build_object('thesportsdb_league_id','5039','thesportsdb_season','2024'),t.id
from public.tags t
where t.slug='jeux-olympiques'
  and not exists (select 1 from public.competitions c where c.name='Jeux Olympiques 2024' and coalesce(c.edition,'')='Paris 2024');

update public.competitions c
set tag_id=t.id,
    external_ids=coalesce(c.external_ids,'{}'::jsonb) || jsonb_build_object('thesportsdb_league_id','5039','thesportsdb_season','2024'),
    updated_at=now()
from public.tags t
where t.slug='jeux-olympiques' and c.name='Jeux Olympiques 2024' and coalesce(c.edition,'')='Paris 2024';

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select t.id,'competition',c.id,'membership',null
from public.tags t
join public.competitions c on c.name='Jeux Olympiques 2024' and coalesce(c.edition,'')='Paris 2024'
where t.slug='jeux-olympiques'
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;
