-- 3615 Bleus V1.1.37
-- Regroupement de toutes les compétitions amicales sous un tag unique « Match Amical ».
-- La partie rebranding / mentions légales est purement frontend et ne renomme aucune base technique.

insert into public.tags
  (slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active)
values
  ('match-amical','tag','Match Amical','⚽',
   array['Amical','Match amical','Matchs amicaux','International Friendlies','International Friendly'],
   'gradient','#eef4fb','#dce8f6','#18304e','#c5d4e6',135,16,1,null,true)
on conflict (slug) do update
set label_text='Match Amical',
    aliases=excluded.aliases,
    is_active=true,
    updated_at=now();

-- Si un match avait une correction manuelle pointant vers l'ancien tag automatique
-- de sa compétition amicale, bascule cette correction vers le nouveau tag partagé.
with match_tag as (
  select id from public.tags where slug='match-amical' limit 1
),
friendly_tags as (
  select distinct c.tag_id as id
  from public.competitions c
  where c.tag_id is not null
    and (c.name ilike '%amic%' or c.name ilike '%friendl%')
)
update public.matches m
set manual_overrides=jsonb_set(m.manual_overrides,'{competition_tag_id}',to_jsonb((select id::text from match_tag)),true),
    updated_at=now()
where m.manual_overrides ? 'competition_tag_id'
  and (m.manual_overrides->>'competition_tag_id') in (select id::text from friendly_tags)
  and exists (select 1 from match_tag);

-- Nettoie les anciennes liaisons spécifiques à chaque année / compétition amicale.
delete from public.tag_reference_links l
using public.competitions c
where l.reference_type='competition'
  and l.reference_id=c.id
  and (c.name ilike '%amic%' or c.name ilike '%friendl%');

-- Toutes les compétitions amicales utilisent désormais un même tag.
update public.competitions c
set tag_id=(select id from public.tags where slug='match-amical' limit 1),
    updated_at=now()
where c.name ilike '%amic%' or c.name ilike '%friendl%';

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select t.id,'competition',c.id,'membership',null
from public.competitions c
cross join public.tags t
where t.slug='match-amical'
  and (c.name ilike '%amic%' or c.name ilike '%friendl%')
on conflict (tag_id,reference_type,reference_id,relation_kind) do nothing;

-- Supprime les anciens tags annuels / automatiques devenus orphelins.
delete from public.tags t
where t.slug like 'competition-%'
  and (t.label_text ilike '%amic%' or t.label_text ilike '%friendl%')
  and not exists (select 1 from public.competitions c where c.tag_id=t.id)
  and not exists (select 1 from public.entity_tags e where e.tag_id=t.id)
  and not exists (select 1 from public.tag_reference_links l where l.tag_id=t.id);
