-- 3615 Bleus V1.1.45 — tag de section OLYMPIQUE U23
insert into public.tags
(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope)
values
('olympique-u23','tag','OLYMPIQUE U23','🥇',
 array['France U23','France Olympique','Équipe de France Olympique','Olympics U23','Olympique U23'],
 'gradient','#082654','#2563eb',array['#082654','#2563eb','#ffffff','#ef3340'],
 '#ffffff','#082654',135,10,1,null,true,'selection')
on conflict (slug) do update
set label_text='OLYMPIQUE U23', aliases=excluded.aliases, is_active=true, reference_scope='selection', updated_at=now();

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select t.id,'selection',s.id,'membership',null
from public.tags t
join public.selection_teams s on s.code='FRA-ESP-M'
where t.slug='olympique-u23'
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;
