-- 3615 Bleus V1.1.61.28 — tags Compétitions canoniques : ENTITÉ → ÉDITION
-- Règle métier :
--   • le tag ENTITÉ est le seul tag compétition visible sur les tuiles ;
--   • le tag ÉDITION est le lien technique précis pour matchs, feuilles de match, maillots, filtres et statistiques ;
--   • une édition hérite obligatoirement de son entité via tags.parent_tag_id ;
--   • les anciens tags compétition doublons sont réaffectés vers le tag canonique puis désactivés.

begin;

alter table public.tags
  add column if not exists competition_tag_level text,
  add column if not exists parent_tag_id uuid references public.tags(id) on delete set null;

alter table public.tags drop constraint if exists tags_competition_tag_level_check;
alter table public.tags add constraint tags_competition_tag_level_check
  check (competition_tag_level is null or competition_tag_level in ('entity','edition'));
create index if not exists tags_parent_tag_idx on public.tags(parent_tag_id);
create index if not exists tags_competition_level_idx on public.tags(competition_tag_level) where competition_tag_level is not null;

alter table public.competition_editions
  add column if not exists edition_tag_id uuid references public.tags(id) on delete set null;
create unique index if not exists competition_editions_edition_tag_uidx
  on public.competition_editions(edition_tag_id) where edition_tag_id is not null;

alter table public.tag_reference_links drop constraint if exists tag_reference_links_reference_type_check;
alter table public.tag_reference_links add constraint tag_reference_links_reference_type_check
check (reference_type in ('selection','competition','competition_entity','competition_edition','opponent','place','personnel','equipment','bibliography','match','callup','broadcast'));

create or replace function public.competition_tag_key(p_value text) returns text
language sql immutable parallel safe set search_path=public as $$
  select regexp_replace(
    translate(lower(coalesce(p_value,'')),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+','','g'
  )
$$;

-- Rapproche d'abord l'ancienne couche competitions avec les entités canoniques.
-- Priorité au tag déjà partagé, puis au nom / aux alias normalisés.
with candidates as (
  select c.id as competition_id,ce.id as entity_id,
         row_number() over(partition by c.id order by
           case when c.tag_id=ce.competition_tag_id then 0
                when public.competition_tag_key(c.name)=public.competition_tag_key(ce.name) then 1
                else 2 end,
           ce.created_at,ce.id) as rn
  from public.competitions c
  join public.competition_entities ce
    on (c.gender is null or ce.gender is null or c.gender=ce.gender)
   and (
     c.tag_id=ce.competition_tag_id
     or public.competition_tag_key(c.name)=public.competition_tag_key(ce.name)
     or exists(select 1 from unnest(coalesce(ce.aliases,array[]::text[])) a where public.competition_tag_key(c.name)=public.competition_tag_key(a))
   )
  where c.canonical_entity_id is null
)
update public.competitions c
set canonical_entity_id=x.entity_id,updated_at=now()
from candidates x
where x.rn=1 and c.id=x.competition_id;

-- Une ancienne compétition peut déjà représenter une édition qui n'existe pas encore dans le catalogue
-- (ex. "2026-2027"). On crée l'édition canonique à partir de la première année rencontrée.
with legacy_years as (
  select c.id,c.canonical_entity_id,c.edition,
         coalesce(
           nullif(substring(coalesce(c.edition,'') from '((?:19|20)[0-9]{2})'),'')::integer,
           extract(year from c.start_date)::integer,
           extract(year from min(m.match_date))::integer
         ) as edition_year
  from public.competitions c
  left join public.matches m on m.competition_id=c.id
  where c.canonical_entity_id is not null
  group by c.id,c.canonical_entity_id,c.edition,c.start_date
)
insert into public.competition_editions(competition_entity_id,edition_year,edition_label,notes)
select y.canonical_entity_id,y.edition_year,coalesce(nullif(y.edition,''),y.edition_year::text),'Édition raccordée automatiquement depuis la couche historique competitions.'
from legacy_years y
where y.edition_year is not null
on conflict(competition_entity_id,edition_year) do nothing;

with legacy_years as (
  select c.id,c.canonical_entity_id,
         coalesce(
           nullif(substring(coalesce(c.edition,'') from '((?:19|20)[0-9]{2})'),'')::integer,
           extract(year from c.start_date)::integer,
           extract(year from min(m.match_date))::integer
         ) as edition_year
  from public.competitions c
  left join public.matches m on m.competition_id=c.id
  where c.canonical_entity_id is not null
  group by c.id,c.canonical_entity_id,c.edition,c.start_date
)
update public.competitions c
set canonical_edition_id=ed.id,updated_at=now()
from legacy_years y
join public.competition_editions ed on ed.competition_entity_id=y.canonical_entity_id and ed.edition_year=y.edition_year
where c.id=y.id and c.canonical_edition_id is distinct from ed.id;

-- Les matchs historiques héritent immédiatement de l'édition canonique de leur ancienne compétition.
update public.matches m
set competition_edition_id=c.canonical_edition_id,updated_at=now()
from public.competitions c
where m.competition_id=c.id
  and c.canonical_edition_id is not null
  and m.competition_edition_id is distinct from c.canonical_edition_id;

-- Les tags portés par les entités canoniques deviennent explicitement des tags ENTITÉ.
update public.tags t
set reference_scope='competition', competition_tag_level='entity', parent_tag_id=null, is_active=true, updated_at=now()
from public.competition_entities ce
where ce.competition_tag_id=t.id
  and (t.reference_scope is distinct from 'competition' or t.competition_tag_level is distinct from 'entity' or t.parent_tag_id is not null or t.is_active is distinct from true);

-- Table temporaire de fusion : vieux tag compétition -> tag ENTITÉ canonique.
create temp table _competition_tag_merge(old_id uuid primary key,new_id uuid not null) on commit drop;

insert into _competition_tag_merge(old_id,new_id)
select distinct c.tag_id,ce.competition_tag_id
from public.competitions c
join public.competition_entities ce on ce.id=c.canonical_entity_id
where c.tag_id is not null and c.tag_id<>ce.competition_tag_id
on conflict(old_id) do update set new_id=excluded.new_id;

-- Complète la fusion pour les doublons ayant le même libellé / alias que l'entité canonique.
insert into _competition_tag_merge(old_id,new_id)
select distinct dup.id,ce.competition_tag_id
from public.tags dup
join public.competition_entities ce on dup.id<>ce.competition_tag_id
join public.tags canon on canon.id=ce.competition_tag_id
where dup.competition_tag_level is null
  and (
    public.competition_tag_key(dup.label_text)=public.competition_tag_key(canon.label_text)
    or public.competition_tag_key(dup.label_text)=public.competition_tag_key(ce.name)
    or exists(select 1 from unnest(coalesce(ce.aliases,array[]::text[])) a where public.competition_tag_key(a)=public.competition_tag_key(dup.label_text))
    or exists(select 1 from unnest(coalesce(dup.aliases,array[]::text[])) a where public.competition_tag_key(a)=public.competition_tag_key(ce.name))
    or exists(select 1 from unnest(coalesce(dup.aliases,array[]::text[])) da cross join unnest(coalesce(ce.aliases,array[]::text[])) ca where public.competition_tag_key(da)=public.competition_tag_key(ca))
  )
on conflict(old_id) do nothing;

-- Réécrit les tags génériques déjà posés sur des tuiles sans perdre la relation.
insert into public.entity_tags(entity_type,entity_id,tag_id,added_by,created_at)
select et.entity_type,et.entity_id,m.new_id,et.added_by,et.created_at
from public.entity_tags et join _competition_tag_merge m on m.old_id=et.tag_id
on conflict(entity_type,entity_id,tag_id) do nothing;
delete from public.entity_tags et using _competition_tag_merge m where et.tag_id=m.old_id;

-- Réécrit les associations Tags ↔ Référentiels.
insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by,created_at)
select m.new_id,l.reference_type,l.reference_id,l.relation_kind,l.created_by,l.created_at
from public.tag_reference_links l join _competition_tag_merge m on m.old_id=l.tag_id
on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;
delete from public.tag_reference_links l using _competition_tag_merge m where l.tag_id=m.old_id;

-- L'ancienne couche public.competitions pointe toujours vers le tag ENTITÉ canonique.
update public.competitions c
set tag_id=ce.competition_tag_id,updated_at=now()
from public.competition_entities ce
where c.canonical_entity_id=ce.id and c.tag_id is distinct from ce.competition_tag_id;

-- Les overrides historiques de matchs ne doivent plus ressusciter un doublon.
update public.matches m
set manual_overrides=jsonb_set(coalesce(m.manual_overrides,'{}'::jsonb),'{competition_tag_id}',to_jsonb(ce.competition_tag_id::text),true),updated_at=now()
from public.competitions c
join public.competition_entities ce on ce.id=c.canonical_entity_id
where m.competition_id=c.id
  and coalesce(m.manual_overrides,'{}'::jsonb) ? 'competition_tag_id'
  and (m.manual_overrides->>'competition_tag_id') is distinct from ce.competition_tag_id::text;

-- Garantit aussi les liens de l'ancienne couche vers le tag canonique.
delete from public.tag_reference_links l
using public.competitions c,public.competition_entities ce
where l.reference_type='competition' and l.reference_id=c.id and c.canonical_entity_id=ce.id and l.tag_id<>ce.competition_tag_id;
insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select ce.competition_tag_id,'competition',c.id,'membership',null::uuid
from public.competitions c join public.competition_entities ce on ce.id=c.canonical_entity_id
on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;

-- Métadonnées de liaison des tags ENTITÉ dans le gestionnaire de tags.
insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select ce.competition_tag_id,'competition_entity',ce.id,'membership',null::uuid
from public.competition_entities ce
on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;

-- Création déterministe d'un tag ÉDITION pour chaque édition canonique.
insert into public.tags(
  slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,
  gradient_angle,border_radius,border_width,created_by,is_active,reference_scope,competition_tag_level,parent_tag_id
)
select
  left('competition-edition-'||ce.slug||'-'||ed.edition_year::text,96),
  'tag',
  left(ce.name||' '||coalesce(nullif(ed.edition_label,''),ed.edition_year::text),40),
  coalesce(nullif(parent.icon_text,''),'🏆'),
  array[ce.name||' '||coalesce(nullif(ed.edition_label,''),ed.edition_year::text),ce.name,ed.edition_year::text],
  parent.appearance,parent.color_start,parent.color_end,parent.gradient_colors,parent.text_color,parent.border_color,
  parent.gradient_angle,parent.border_radius,parent.border_width,null::uuid,true,'competition','edition',ce.competition_tag_id
from public.competition_editions ed
join public.competition_entities ce on ce.id=ed.competition_entity_id
join public.tags parent on parent.id=ce.competition_tag_id
on conflict(slug) do update set
  reference_scope='competition',competition_tag_level='edition',parent_tag_id=excluded.parent_tag_id,is_active=true,
  aliases=(select coalesce(array_agg(distinct v order by v),array[]::text[]) from unnest(coalesce(public.tags.aliases,array[]::text[])||excluded.aliases) v),
  updated_at=now();

update public.competition_editions ed
set edition_tag_id=t.id,updated_at=now()
from public.competition_entities ce, public.tags t
where ed.competition_entity_id=ce.id
  and t.slug=left('competition-edition-'||ce.slug||'-'||ed.edition_year::text,96)
  and ed.edition_tag_id is distinct from t.id;

insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
select ed.edition_tag_id,'competition_edition',ed.id,'membership',null::uuid
from public.competition_editions ed where ed.edition_tag_id is not null
on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;

-- À l'avenir, toute nouvelle édition reçoit automatiquement son tag ÉDITION hérité du tag ENTITÉ.
create or replace function public.assign_competition_edition_tag() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  v_entity public.competition_entities%rowtype;
  v_parent public.tags%rowtype;
  v_tag uuid;
  v_slug text;
  v_full_label text;
begin
  select * into v_entity from public.competition_entities where id=new.competition_entity_id;
  if v_entity.id is null then return new; end if;
  select * into v_parent from public.tags where id=v_entity.competition_tag_id;
  if v_parent.id is null then return new; end if;
  v_slug:=left('competition-edition-'||v_entity.slug||'-'||new.edition_year::text,96);
  v_full_label:=v_entity.name||' '||coalesce(nullif(new.edition_label,''),new.edition_year::text);
  insert into public.tags(slug,kind,label_text,icon_text,aliases,appearance,color_start,color_end,gradient_colors,text_color,border_color,gradient_angle,border_radius,border_width,created_by,is_active,reference_scope,competition_tag_level,parent_tag_id)
  values(v_slug,'tag',left(v_full_label,40),coalesce(nullif(v_parent.icon_text,''),'🏆'),array[v_full_label,v_entity.name,new.edition_year::text],v_parent.appearance,v_parent.color_start,v_parent.color_end,v_parent.gradient_colors,v_parent.text_color,v_parent.border_color,v_parent.gradient_angle,v_parent.border_radius,v_parent.border_width,null,true,'competition','edition',v_entity.competition_tag_id)
  on conflict(slug) do update set reference_scope='competition',competition_tag_level='edition',parent_tag_id=v_entity.competition_tag_id,is_active=true,updated_at=now()
  returning id into v_tag;
  new.edition_tag_id:=v_tag;
  return new;
end $$;

drop trigger if exists trg_competition_editions_assign_tag on public.competition_editions;
create trigger trg_competition_editions_assign_tag
before insert or update of competition_entity_id,edition_year,edition_label on public.competition_editions
for each row execute function public.assign_competition_edition_tag();

create or replace function public.sync_competition_tag_reference_links() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='competition_entities' then
    update public.tags set reference_scope='competition',competition_tag_level='entity',parent_tag_id=null,is_active=true,updated_at=now() where id=new.competition_tag_id;
    insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
    values(new.competition_tag_id,'competition_entity',new.id,'membership',null)
    on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;
  else
    if new.edition_tag_id is not null then
      insert into public.tag_reference_links(tag_id,reference_type,reference_id,relation_kind,created_by)
      values(new.edition_tag_id,'competition_edition',new.id,'membership',null)
      on conflict(tag_id,reference_type,reference_id,relation_kind) do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_competition_entities_tag_link on public.competition_entities;
create trigger trg_competition_entities_tag_link after insert or update of competition_tag_id on public.competition_entities
for each row execute function public.sync_competition_tag_reference_links();
drop trigger if exists trg_competition_editions_tag_link on public.competition_editions;
create trigger trg_competition_editions_tag_link after insert or update of edition_tag_id on public.competition_editions
for each row execute function public.sync_competition_tag_reference_links();

-- Ces fonctions sont réservées au moteur de triggers : pas d'appel direct via Data API.
revoke execute on function public.assign_competition_edition_tag() from public,anon,authenticated;
revoke execute on function public.sync_competition_tag_reference_links() from public,anon,authenticated;

-- Empêche l'ancienne table competitions de réintroduire un tag différent de celui de son entité canonique.
create or replace function public.sync_legacy_competition_entity_tag() returns trigger
language plpgsql security invoker set search_path=public as $$
declare v_tag uuid;
begin
  if new.canonical_entity_id is not null then
    select competition_tag_id into v_tag from public.competition_entities where id=new.canonical_entity_id;
    if v_tag is not null then new.tag_id:=v_tag; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_competitions_sync_entity_tag on public.competitions;
create trigger trg_competitions_sync_entity_tag
before insert or update of canonical_entity_id,tag_id on public.competitions
for each row execute function public.sync_legacy_competition_entity_tag();

-- Relation Maillots ↔ ÉDITIONS. L'affichage remontera ensuite automatiquement au tag ENTITÉ.
create table if not exists public.jersey_competition_editions(
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  competition_edition_id uuid not null references public.competition_editions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(jersey_id,competition_edition_id)
);
create index if not exists jersey_competition_editions_edition_idx on public.jersey_competition_editions(competition_edition_id);
alter table public.jersey_competition_editions enable row level security;
drop policy if exists jersey_competition_editions_public_read on public.jersey_competition_editions;
create policy jersey_competition_editions_public_read on public.jersey_competition_editions for select to anon,authenticated using(true);
drop policy if exists jersey_competition_editions_edit on public.jersey_competition_editions;
drop policy if exists jersey_competition_editions_insert on public.jersey_competition_editions;
drop policy if exists jersey_competition_editions_update on public.jersey_competition_editions;
drop policy if exists jersey_competition_editions_delete on public.jersey_competition_editions;
create policy jersey_competition_editions_insert on public.jersey_competition_editions for insert to authenticated with check(public.can_edit());
create policy jersey_competition_editions_update on public.jersey_competition_editions for update to authenticated using(public.can_edit()) with check(public.can_edit());
create policy jersey_competition_editions_delete on public.jersey_competition_editions for delete to authenticated using(public.can_edit());
grant select on public.jersey_competition_editions to anon,authenticated;
grant insert,update,delete on public.jersey_competition_editions to authenticated;

insert into public.jersey_competition_editions(jersey_id,competition_edition_id)
select distinct jc.jersey_id,c.canonical_edition_id
from public.jersey_competitions jc
join public.competitions c on c.id=jc.competition_id
where c.canonical_edition_id is not null
on conflict do nothing;

-- Les anciens tags réellement fusionnés restent dans l'historique mais ne polluent plus les sélecteurs.
update public.tags t
set is_active=false,updated_at=now()
where exists(select 1 from _competition_tag_merge m where m.old_id=t.id)
  and not exists(select 1 from public.competition_entities ce where ce.competition_tag_id=t.id)
  and not exists(select 1 from public.competition_editions ed where ed.edition_tag_id=t.id);

comment on column public.tags.competition_tag_level is 'entity = tag compétition visible ; edition = tag technique enfant utilisé pour relationner une édition précise.';
comment on column public.tags.parent_tag_id is 'Pour un tag édition, pointe vers le tag entité compétition parent.';
comment on column public.competition_editions.edition_tag_id is 'Tag canonique de l édition, enfant du tag entité.';
comment on table public.jersey_competition_editions is 'Affiliation précise Maillot ↔ édition canonique ; l UI affiche le tag entité parent.';

commit;
