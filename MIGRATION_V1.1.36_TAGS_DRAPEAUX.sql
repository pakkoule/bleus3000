-- Bleus 3000 V1.1.36
-- Tags de sections + tags de compétitions.
-- Les corrections de tag par match restent dans matches.manual_overrides.

alter table public.competitions
  add column if not exists tag_id uuid references public.tags(id) on delete set null;

create index if not exists competitions_tag_id_idx on public.competitions(tag_id);

-- Catalogue des sections Bleus 3000.
insert into public.tags
  (slug, kind, label_text, icon_text, aliases, appearance, color_start, color_end, text_color, border_color, gradient_angle, border_radius, border_width, created_by, is_active)
values
  ('international','tag','INTERNATIONAL','🇫🇷',array['France A','France A M','A Masculin'],'gradient','#00329e','#ff0000','#ffffff','#000000',135,8,1,null,true),
  ('espoirs','tag','ESPOIRS','🇫🇷',array['France Espoirs','France U21','France U23','Espoirs/U21'],'gradient','#2563eb','#0ea5c6','#ffffff','#feb500',135,8,1,null,true),
  ('u20','tag','U20','🇫🇷',array['France U20','U20M'],'gradient','#2563eb','#082654','#ffffff','#082654',135,8,1,null,true),
  ('u19','tag','U19','🇫🇷',array['France U19','U19M'],'gradient','#2563eb','#082654','#ffffff','#082654',135,8,1,null,true),
  ('u18','tag','U18','🇫🇷',array['France U18','U18M'],'gradient','#2563eb','#082654','#ffffff','#082654',135,8,1,null,true),
  ('u17','tag','U17','🇫🇷',array['France U17','U17M'],'gradient','#2563eb','#000000','#ffffff','#000000',135,8,1,null,true),
  ('u16','tag','U16','🇫🇷',array['France U16','U16M'],'gradient','#2563eb','#082654','#ffffff','#082654',135,8,1,null,true),
  ('internationale-f','tag','INTERNATIONALE F','🇫🇷',array['France A F','France A Féminine','Internationale féminine'],'gradient','#ffffff','#4d9aff','#ffffff','#ed9cdb',135,8,1,null,true),
  ('espoirs-f','tag','ESPOIRS F','🇫🇷',array['France U23 F','Espoirs Féminine','France Espoirs Féminine'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true),
  ('u20-feminin','tag','U20 F','🇫🇷',array['France U20 F','France U20 Féminine','U20F'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true),
  ('u19-feminin','tag','U19 F','🇫🇷',array['France U19 F','France U19 Féminine','U19F'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true),
  ('u18-feminin','tag','U18 F','🇫🇷',array['France U18 F','France U18 Féminine','U18F'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true),
  ('u17-feminin','tag','U17 F','🇫🇷',array['France U17 F','France U17 Féminine','U17F'],'gradient','#2563eb','#a9f0fe','#ffffff','#000000',135,8,1,null,true),
  ('u16-feminin','tag','U16 F','🇫🇷',array['France U16 F','France U16 Féminine','U16F'],'gradient','#2563eb','#a9f0fe','#ffffff','#ed9cdb',135,8,1,null,true)
on conflict (slug) do update
set label_text = excluded.label_text,
    aliases = excluded.aliases,
    is_active = true,
    updated_at = now();

with mapping(code, slug) as (
  values
    ('FRA-A-M','international'),
    ('FRA-ESP-M','espoirs'),
    ('FRA-U20-M','u20'),
    ('FRA-U19-M','u19'),
    ('FRA-U18-M','u18'),
    ('FRA-U17-M','u17'),
    ('FRA-U16-M','u16'),
    ('FRA-A-F','internationale-f'),
    ('FRA-U23-F','espoirs-f'),
    ('FRA-U20-F','u20-feminin'),
    ('FRA-U19-F','u19-feminin'),
    ('FRA-U18-F','u18-feminin'),
    ('FRA-U17-F','u17-feminin'),
    ('FRA-U16-F','u16-feminin')
)
update public.selection_teams s
set team_tag_id = t.id,
    updated_at = now()
from mapping m
join public.tags t on t.slug=m.slug
where s.code=m.code
  and s.team_tag_id is distinct from t.id;

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select s.team_tag_id,'selection',s.id,'membership',null
from public.selection_teams s
where s.team_tag_id is not null
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;

-- Une compétition = un tag global modifiable depuis le menu Profil > Tags & étiquettes.
insert into public.tags
  (slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active)
select
  'competition-' || left(replace(c.id::text,'-',''),12),
  'tag',
  left(c.name,40),
  '🏆',
  array_remove(array[c.name,c.edition],null),
  'gradient',
  '#eef4fb','#dce8f6','#18304e','#c5d4e6',135,16,1,null,true
from public.competitions c
on conflict (slug) do update
set aliases=excluded.aliases,
    is_active=true,
    updated_at=now();

update public.competitions c
set tag_id=t.id,
    updated_at=now()
from public.tags t
where t.slug='competition-' || left(replace(c.id::text,'-',''),12)
  and c.tag_id is distinct from t.id;

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select c.tag_id,'competition',c.id,'membership',null
from public.competitions c
where c.tag_id is not null
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;
