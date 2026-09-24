-- 3615 Bleus V1.1.40
-- Portée explicite des tags pour garantir leur disponibilité dans les formulaires Calendrier.

alter table public.tags
  add column if not exists reference_scope text;

alter table public.tags
  drop constraint if exists tags_reference_scope_check;

alter table public.tags
  add constraint tags_reference_scope_check
  check (reference_scope is null or reference_scope in ('selection','competition','general'));

update public.tags t
set reference_scope='selection'
where exists (select 1 from public.selection_teams s where s.team_tag_id=t.id)
   or exists (select 1 from public.tag_reference_links l where l.tag_id=t.id and l.reference_type='selection');

update public.tags t
set reference_scope='competition'
where exists (select 1 from public.competitions c where c.tag_id=t.id)
   or exists (select 1 from public.tag_reference_links l where l.tag_id=t.id and l.reference_type='competition');

update public.tags
set reference_scope='general'
where slug='general';
