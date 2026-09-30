-- 3615 Bleus V1.2.7 — Copyright photos + référentiel Ballons
-- À exécuter sur une base existante avant le déploiement du front V1.2.7.

begin;

-- ---------------------------------------------------------------------------
-- 1) Copyright personnalisable des photos
-- ---------------------------------------------------------------------------
alter table public.players
  add column if not exists photo_copyright_source text,
  add column if not exists action_photo_copyright_source text;

alter table public.personnel
  add column if not exists photo_copyright_source text;

alter table public.places
  add column if not exists photo_copyright_source text;

alter table public.jerseys
  add column if not exists main_photo_copyright_source text;

alter table public.match_media_assets
  add column if not exists image_copyright_source text;

comment on column public.players.photo_copyright_source is 'Source du copyright affiché en capsule sur le portrait joueur.';
comment on column public.players.action_photo_copyright_source is 'Source du copyright affiché sur la photo en match du joueur.';
comment on column public.personnel.photo_copyright_source is 'Source du copyright affiché sur la photo du membre du personnel.';
comment on column public.places.photo_copyright_source is 'Source du copyright affiché sur la photo du lieu.';
comment on column public.jerseys.main_photo_copyright_source is 'Source du copyright de la photo principale du maillot.';
comment on column public.match_media_assets.image_copyright_source is 'Source du copyright de la photo du média de match.';

-- ---------------------------------------------------------------------------
-- 2) Référentiel canonique des ballons
-- ---------------------------------------------------------------------------
create table if not exists public.football_balls (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  manufacturer_id uuid references public.equipment_manufacturers(id) on delete set null,
  manufacturer_alias text,
  competition_entity_id uuid references public.competition_entities(id) on delete set null,
  competition_edition_id uuid references public.competition_editions(id) on delete set null,
  year_start integer,
  year_end integer,
  photo_path text,
  photo_url text,
  photo_copyright_source text,
  notes_short text,
  source_media_asset_id uuid references public.match_media_assets(id) on delete set null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists football_balls_comp_entity_idx on public.football_balls(competition_entity_id);
create index if not exists football_balls_comp_edition_idx on public.football_balls(competition_edition_id);
create index if not exists football_balls_manufacturer_idx on public.football_balls(manufacturer_id);
create index if not exists football_balls_year_idx on public.football_balls(year_start,year_end);
create unique index if not exists football_balls_source_media_uidx
  on public.football_balls(source_media_asset_id)
  where source_media_asset_id is not null;

create table if not exists public.match_balls (
  match_id uuid primary key references public.matches(id) on delete cascade,
  ball_id uuid not null references public.football_balls(id) on delete restrict,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists match_balls_ball_idx on public.match_balls(ball_id);

comment on table public.football_balls is 'Référentiel canonique des modèles de ballons utilisés par l’Équipe de France.';
comment on column public.football_balls.manufacturer_alias is 'Alias/libellé équipementier propre au ballon, par exemple adidas, Nike Football, Select.';
comment on table public.match_balls is 'Ballon canonique utilisé sur une feuille de match ; permet les ajouts rapides et les statistiques.';

alter table public.football_balls enable row level security;
alter table public.match_balls enable row level security;

drop policy if exists football_balls_read on public.football_balls;
create policy football_balls_read on public.football_balls for select to anon,authenticated using(true);
drop policy if exists football_balls_insert on public.football_balls;
create policy football_balls_insert on public.football_balls for insert to authenticated with check(public.can_edit());
drop policy if exists football_balls_update on public.football_balls;
create policy football_balls_update on public.football_balls for update to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists football_balls_delete on public.football_balls;
create policy football_balls_delete on public.football_balls for delete to authenticated using(public.can_edit());

drop policy if exists match_balls_read on public.match_balls;
create policy match_balls_read on public.match_balls for select to anon,authenticated using(true);
drop policy if exists match_balls_insert on public.match_balls;
create policy match_balls_insert on public.match_balls for insert to authenticated with check(public.can_edit());
drop policy if exists match_balls_update on public.match_balls;
create policy match_balls_update on public.match_balls for update to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists match_balls_delete on public.match_balls;
create policy match_balls_delete on public.match_balls for delete to authenticated using(public.can_edit());

grant select on public.football_balls,public.match_balls to anon,authenticated;
grant insert,update,delete on public.football_balls,public.match_balls to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Reprise automatique des ballons déjà présents comme médias de match
--    Une entrée par média historique : aucun ancien contenu n’est supprimé.
-- ---------------------------------------------------------------------------
insert into public.football_balls(
  model_name,manufacturer_alias,competition_entity_id,competition_edition_id,
  year_start,year_end,photo_path,photo_url,photo_copyright_source,notes_short,
  source_media_asset_id,created_by,created_at,updated_at
)
select
  coalesce(nullif(trim(a.title),''),'Ballon du match'),
  null,
  ed.competition_entity_id,
  m.competition_edition_id,
  extract(year from (m.match_date at time zone 'Europe/Paris'))::integer,
  extract(year from (m.match_date at time zone 'Europe/Paris'))::integer,
  a.image_path,
  coalesce(a.image_url,a.url),
  a.image_copyright_source,
  'Import automatique depuis un média ballon déjà présent sur une feuille de match.',
  a.id,
  a.created_by,
  coalesce(a.created_at,now()),
  now()
from public.match_media_assets a
join public.matches m on m.id=a.match_id
left join public.competition_editions ed on ed.id=m.competition_edition_id
where a.asset_type='ball'
  and not exists(select 1 from public.football_balls b where b.source_media_asset_id=a.id);

insert into public.match_balls(match_id,ball_id,created_by,created_at,updated_at)
select a.match_id,b.id,a.created_by,coalesce(a.created_at,now()),now()
from public.match_media_assets a
join public.football_balls b on b.source_media_asset_id=a.id
where a.asset_type='ball'
on conflict(match_id) do nothing;

-- Les futurs médias de type "ball" restent automatiquement synchronisés avec le référentiel.
create or replace function public.sync_match_media_ball_to_library()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_ball_id uuid;
  v_year integer;
  v_edition uuid;
  v_entity uuid;
begin
  if new.asset_type <> 'ball' then return new; end if;
  select extract(year from (m.match_date at time zone 'Europe/Paris'))::integer,
         m.competition_edition_id,
         ed.competition_entity_id
    into v_year,v_edition,v_entity
  from public.matches m
  left join public.competition_editions ed on ed.id=m.competition_edition_id
  where m.id=new.match_id;

  select id into v_ball_id from public.football_balls where source_media_asset_id=new.id limit 1;
  if v_ball_id is null then
    insert into public.football_balls(
      model_name,competition_entity_id,competition_edition_id,year_start,year_end,
      photo_path,photo_url,photo_copyright_source,notes_short,source_media_asset_id,created_by
    ) values(
      coalesce(nullif(trim(new.title),''),'Ballon du match'),v_entity,v_edition,v_year,v_year,
      new.image_path,coalesce(new.image_url,new.url),new.image_copyright_source,
      'Synchronisé depuis le média ballon de la feuille de match.',new.id,new.created_by
    ) returning id into v_ball_id;
  else
    update public.football_balls set
      model_name=coalesce(nullif(trim(new.title),''),model_name),
      competition_entity_id=coalesce(v_entity,competition_entity_id),
      competition_edition_id=coalesce(v_edition,competition_edition_id),
      year_start=coalesce(year_start,v_year),year_end=coalesce(year_end,v_year),
      photo_path=coalesce(new.image_path,photo_path),
      photo_url=coalesce(new.image_url,new.url,photo_url),
      photo_copyright_source=new.image_copyright_source,
      updated_at=now()
    where id=v_ball_id;
  end if;

  insert into public.match_balls(match_id,ball_id,created_by,updated_at)
  values(new.match_id,v_ball_id,new.created_by,now())
  on conflict(match_id) do update set ball_id=excluded.ball_id,updated_at=now();
  return new;
end
$$;

revoke all on function public.sync_match_media_ball_to_library() from public,anon,authenticated;
drop trigger if exists trg_match_media_ball_library on public.match_media_assets;
create trigger trg_match_media_ball_library
after insert or update of asset_type,title,image_path,image_url,url,image_copyright_source
on public.match_media_assets
for each row execute function public.sync_match_media_ball_to_library();

commit;
