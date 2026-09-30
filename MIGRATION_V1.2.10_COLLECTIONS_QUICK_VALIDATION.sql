-- 3615 Bleus V1.2.10 — Validation rapide + Livres + Buts notés + Panini
-- À exécuter sur une base existante avant le déploiement du front V1.2.10.

begin;

-- ---------------------------------------------------------------------------
-- 1) Livres
-- ---------------------------------------------------------------------------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  isbn text,
  edition_text text,
  publication_year integer,
  publisher text,
  photo_path text,
  photo_url text,
  photo_copyright_source text,
  notes_short text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists books_year_idx on public.books(publication_year);
create index if not exists books_title_idx on public.books(lower(title));
alter table public.books enable row level security;
drop policy if exists books_read on public.books;
create policy books_read on public.books for select to anon,authenticated using(true);
drop policy if exists books_write on public.books;
create policy books_write on public.books for all to authenticated using(public.can_edit()) with check(public.can_edit());
grant select on public.books to anon,authenticated;
grant insert,update,delete on public.books to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Buts : lecteur interne + notes 1 → 100
-- ---------------------------------------------------------------------------
alter table public.match_goal_events
  add column if not exists video_url text,
  add column if not exists video_title text;

create table if not exists public.goal_ratings (
  goal_id uuid not null references public.match_goal_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check(rating between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(goal_id,user_id)
);
create index if not exists goal_ratings_goal_idx on public.goal_ratings(goal_id);
alter table public.goal_ratings enable row level security;
drop policy if exists goal_ratings_read on public.goal_ratings;
create policy goal_ratings_read on public.goal_ratings for select to anon,authenticated using(true);
drop policy if exists goal_ratings_insert on public.goal_ratings;
create policy goal_ratings_insert on public.goal_ratings for insert to authenticated with check(user_id=auth.uid());
drop policy if exists goal_ratings_update on public.goal_ratings;
create policy goal_ratings_update on public.goal_ratings for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists goal_ratings_delete on public.goal_ratings;
create policy goal_ratings_delete on public.goal_ratings for delete to authenticated using(user_id=auth.uid());
grant select on public.goal_ratings to anon,authenticated;
grant insert,update,delete on public.goal_ratings to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Panini : albums + stickers
-- ---------------------------------------------------------------------------
create table if not exists public.panini_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  edition_text text,
  publication_year integer,
  publisher text not null default 'Panini',
  competition_entity_id uuid references public.competition_entities(id) on delete set null,
  competition_edition_id uuid references public.competition_editions(id) on delete set null,
  cover_path text,
  cover_url text,
  cover_copyright_source text,
  notes_short text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists panini_albums_year_idx on public.panini_albums(publication_year);

create table if not exists public.panini_stickers (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.panini_albums(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  sticker_number text,
  title text,
  image_path text,
  image_url text,
  image_copyright_source text,
  notes_short text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists panini_stickers_album_idx on public.panini_stickers(album_id,sort_order);
create unique index if not exists panini_stickers_album_number_uidx
  on public.panini_stickers(album_id,sticker_number)
  where sticker_number is not null and trim(sticker_number)<>'';

alter table public.panini_albums enable row level security;
alter table public.panini_stickers enable row level security;
drop policy if exists panini_albums_read on public.panini_albums;
create policy panini_albums_read on public.panini_albums for select to anon,authenticated using(true);
drop policy if exists panini_albums_write on public.panini_albums;
create policy panini_albums_write on public.panini_albums for all to authenticated using(public.can_edit()) with check(public.can_edit());
drop policy if exists panini_stickers_read on public.panini_stickers;
create policy panini_stickers_read on public.panini_stickers for select to anon,authenticated using(true);
drop policy if exists panini_stickers_write on public.panini_stickers;
create policy panini_stickers_write on public.panini_stickers for all to authenticated using(public.can_edit()) with check(public.can_edit());
grant select on public.panini_albums,public.panini_stickers to anon,authenticated;
grant insert,update,delete on public.panini_albums,public.panini_stickers to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Validation rapide : uniquement une feuille déjà complète en base
-- ---------------------------------------------------------------------------
create or replace function public.quick_validatable_match_sheets()
returns table(
  match_id uuid,
  chronological_number integer,
  match_date timestamptz,
  opponent_name text,
  sheet_validation_status text
)
language sql
stable
security invoker
set search_path=public
as $$
  select m.id,m.chronological_number,m.match_date,o.name,m.sheet_validation_status
  from public.matches m
  left join public.opponents o on o.id=m.opponent_id
  where m.gender='M'
    and m.selection_category='A'
    and m.match_date < now()
    and coalesce(m.sheet_validation_status,'draft') <> 'validated'
    and cardinality(public.match_sheet_missing_fields(m.id))=0
  order by m.match_date desc,m.chronological_number desc;
$$;
revoke all on function public.quick_validatable_match_sheets() from public,anon;
grant execute on function public.quick_validatable_match_sheets() to authenticated;

create or replace function public.quick_validate_existing_match_sheet(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_match public.matches%rowtype;
  v_selection_id uuid;
  v_missing text[];
  v_result text;
  v_player_id uuid;
  v_affected uuid[]:=array[]::uuid[];
  v_count integer:=0;
  v_revision integer:=0;
  v_france_score integer;
  v_opponent_score integer;
begin
  if auth.uid() is null or not public.can_edit() then
    raise exception 'Modification non autorisée';
  end if;

  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'Match introuvable'; end if;
  v_selection_id:=v_match.selection_team_id;
  if v_selection_id is null then raise exception 'Sélection interne manquante'; end if;

  v_missing:=public.match_sheet_missing_fields(p_match_id);
  if cardinality(v_missing)>0 then
    raise exception 'Feuille incomplète : %',array_to_string(v_missing,', ');
  end if;

  select coalesce(array_agg(distinct player_id),array[]::uuid[]) into v_affected
  from public.validated_match_player_stats
  where match_id=p_match_id and player_id is not null;

  -- Les titulaires ont nécessairement joué.
  update public.match_appearances
  set appeared=true
  where match_id=p_match_id and starter=true;

  -- Les entrants explicitement liés comme remplaçants ont joué.
  update public.match_appearances a
  set appeared=true
  where a.match_id=p_match_id
    and a.player_id is not null
    and exists(
      select 1 from public.match_appearances x
      where x.match_id=p_match_id and x.replaced_by_player_id=a.player_id
    );

  -- Un buteur/passeur/cartonné français présent dans la feuille a joué.
  update public.match_appearances a
  set appeared=true
  where a.match_id=p_match_id and a.player_id is not null
    and (
      exists(select 1 from public.match_goal_events g where g.match_id=p_match_id and (g.player_id=a.player_id or g.assist_player_id=a.player_id))
      or exists(select 1 from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id)
    );

  update public.match_appearances a
  set goals=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.player_id=a.player_id and coalesce(g.is_own_goal,false)=false),
      assists=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.assist_player_id=a.player_id),
      yellow_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('yellow','second_yellow')),
      red_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('red','second_yellow'))
  where a.match_id=p_match_id and a.player_id is not null;

  v_france_score:=case
    when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'france_score'
      then (v_match.manual_overrides->>'france_score')::integer
    else v_match.france_score
  end;
  v_opponent_score:=case
    when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score'
      then (v_match.manual_overrides->>'opponent_score')::integer
    else v_match.opponent_score
  end;
  v_result:=case when v_france_score>v_opponent_score then 'V' when v_france_score<v_opponent_score then 'D' else 'N' end;

  delete from public.validated_match_player_stats where match_id=p_match_id;
  insert into public.validated_match_player_stats(
    match_id,player_id,selection_id,appeared,starter,minutes,goals,shirt_number,
    position_id,position_text,captain,result_code,validated_at
  )
  select a.match_id,a.player_id,v_selection_id,true,a.starter,a.minutes,
         coalesce(a.goals,0),a.shirt_number,a.position_id,a.position,a.captain,v_result,now()
  from public.match_appearances a
  where a.match_id=p_match_id and a.appeared=true and a.player_id is not null;
  get diagnostics v_count=row_count;

  select coalesce(v_affected,array[]::uuid[]) || coalesce(array_agg(distinct player_id),array[]::uuid[])
  into v_affected
  from public.validated_match_player_stats
  where match_id=p_match_id;

  for v_player_id in
    select distinct u.pid from unnest(coalesce(v_affected,array[]::uuid[])) as u(pid) where u.pid is not null
  loop
    perform public.refresh_player_from_validated_sheets(v_player_id);
  end loop;

  update public.matches
  set sheet_validation_status='validated',
      sheet_validated_at=now(),
      sheet_validated_by=auth.uid(),
      sheet_validation_revision=coalesce(sheet_validation_revision,0)+1,
      lineup_status='Feuille validée · statistiques synchronisées',
      updated_at=now()
  where id=p_match_id
  returning sheet_validation_revision into v_revision;

  return jsonb_build_object('ok',true,'match_id',p_match_id,'player_count',v_count,'revision',v_revision);
end
$$;
revoke all on function public.quick_validate_existing_match_sheet(uuid) from public,anon,authenticated;
grant execute on function public.quick_validate_existing_match_sheet(uuid) to authenticated;

commit;
