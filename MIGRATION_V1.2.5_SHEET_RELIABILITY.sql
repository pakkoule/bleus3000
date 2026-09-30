-- 3615 Bleus V1.2.5 — fiabilisation des feuilles de match
-- Upgrades : centre qualité, contrôle ville, validation atomique, revalidation exhaustive,
-- numérotation chronologique canonique en base.

begin;

-- ---------------------------------------------------------------------------
-- 1) Champs complémentaires & numéro canonique
-- ---------------------------------------------------------------------------
alter table public.matches
  add column if not exists sheet_city_name text,
  add column if not exists chronological_number integer;

create index if not exists matches_chronological_number_idx
  on public.matches(chronological_number)
  where gender='M' and selection_category='A';

comment on column public.matches.sheet_city_name is
  'Ville saisie/confirmée dans la feuille de match ; utilisée par le contrôle qualité.';
comment on column public.matches.chronological_number is
  'Numéro canonique du match France A masculine, recalculé selon la date effective puis l UUID.';

-- ---------------------------------------------------------------------------
-- 2) Numérotation canonique : même logique que l interface, mais persistée en BDD
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_match_numbers()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  with ranked as (
    select
      m.id,
      row_number() over (
        order by
          case
            when m.manual_overrides ? 'match_date'
             and nullif(m.manual_overrides->>'match_date','') is not null
             and (m.manual_overrides->>'match_date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            then (m.manual_overrides->>'match_date')::timestamptz
            else m.match_date
          end asc nulls last,
          m.id::text asc
      )::integer as rn
    from public.matches m
    where m.gender='M' and m.selection_category='A'
  )
  update public.matches m
  set chronological_number=r.rn
  from ranked r
  where m.id=r.id
    and m.chronological_number is distinct from r.rn;

  update public.matches
  set chronological_number=null
  where chronological_number is not null
    and not (gender='M' and selection_category='A');
end
$$;

revoke all on function public.recalculate_match_numbers() from public,anon,authenticated;

create or replace function public.trg_recalculate_match_numbers()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  -- Trigger de niveau STATEMENT : un import de 200 matchs ne recalcule qu'une fois.
  perform public.recalculate_match_numbers();
  return null;
end
$$;

revoke all on function public.trg_recalculate_match_numbers() from public,anon,authenticated;

drop trigger if exists trg_matches_recalculate_numbers on public.matches;
create trigger trg_matches_recalculate_numbers
after insert or delete or update of match_date,manual_overrides,gender,selection_category
on public.matches
for each statement execute function public.trg_recalculate_match_numbers();

-- ---------------------------------------------------------------------------
-- 3) Revalidation exhaustive dès qu une donnée de feuille change
-- ---------------------------------------------------------------------------
create or replace function public.mark_match_sheet_child_dirty()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare v_match_id uuid;
begin
  if tg_op='UPDATE' and new is not distinct from old then return new; end if;
  v_match_id:=case when tg_op='DELETE' then old.match_id else new.match_id end;
  update public.matches
  set sheet_validation_status=case when sheet_validation_status='validated' then 'needs_validation' else sheet_validation_status end,
      updated_at=now()
  where id=v_match_id;
  return case when tg_op='DELETE' then old else new end;
end
$$;

drop trigger if exists trg_match_appearances_sheet_dirty on public.match_appearances;
create trigger trg_match_appearances_sheet_dirty after insert or update or delete on public.match_appearances
for each row execute function public.mark_match_sheet_child_dirty();

drop trigger if exists trg_match_goals_sheet_dirty on public.match_goal_events;
create trigger trg_match_goals_sheet_dirty after insert or update or delete on public.match_goal_events
for each row execute function public.mark_match_sheet_child_dirty();

drop trigger if exists trg_match_cards_sheet_dirty on public.match_card_events;
create trigger trg_match_cards_sheet_dirty after insert or update or delete on public.match_card_events
for each row execute function public.mark_match_sheet_child_dirty();

drop trigger if exists trg_match_officials_sheet_dirty on public.match_officials;
create trigger trg_match_officials_sheet_dirty after insert or update or delete on public.match_officials
for each row execute function public.mark_match_sheet_child_dirty();

drop trigger if exists trg_match_jerseys_sheet_dirty on public.match_jerseys;
create trigger trg_match_jerseys_sheet_dirty after insert or update or delete on public.match_jerseys
for each row execute function public.mark_match_sheet_child_dirty();

create or replace function public.mark_match_sheet_match_dirty()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_override_changed boolean:=false;
begin
  if old.sheet_validation_status<>'validated' then return new; end if;

  v_override_changed :=
       (coalesce(old.manual_overrides,'{}'::jsonb)->'match_date') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'match_date')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'france_score') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'france_score')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'opponent_score') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'opponent_score')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'venue_name') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'venue_name')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'city') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'city')
    or (coalesce(old.manual_overrides,'{}'::jsonb)->'competition_name') is distinct from (coalesce(new.manual_overrides,'{}'::jsonb)->'competition_name');

  if old.france_score is distinct from new.france_score
     or old.opponent_score is distinct from new.opponent_score
     or old.selection_team_id is distinct from new.selection_team_id
     or old.competition_id is distinct from new.competition_id
     or old.competition_edition_id is distinct from new.competition_edition_id
     or old.place_id is distinct from new.place_id
     or old.coach_id is distinct from new.coach_id
     or old.sheet_stadium_name is distinct from new.sheet_stadium_name
     or old.sheet_city_name is distinct from new.sheet_city_name
     or old.sheet_referee_name is distinct from new.sheet_referee_name
     or old.sheet_coach_name is distinct from new.sheet_coach_name
     or old.sheet_competition_name is distinct from new.sheet_competition_name
     or old.sheet_competition_family_id is distinct from new.sheet_competition_family_id
     or v_override_changed then
    new.sheet_validation_status:='needs_validation';
  end if;
  return new;
end
$$;

drop trigger if exists trg_matches_sheet_dirty on public.matches;
create trigger trg_matches_sheet_dirty
before update of france_score,opponent_score,selection_team_id,competition_id,competition_edition_id,place_id,coach_id,
  sheet_stadium_name,sheet_city_name,sheet_referee_name,sheet_coach_name,sheet_competition_name,sheet_competition_family_id,manual_overrides
on public.matches
for each row execute function public.mark_match_sheet_match_dirty();

-- ---------------------------------------------------------------------------
-- 4) Résolution stade + ville
-- ---------------------------------------------------------------------------
create or replace function public.resolve_or_create_sheet_place(p_name text,p_city text)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare v_id uuid;
begin
  if nullif(trim(coalesce(p_name,'')),'') is null then return null; end if;
  select id into v_id
  from public.places
  where place_type='stadium' and public.sheet_name_key(name)=public.sheet_name_key(p_name)
  order by created_at limit 1;

  if v_id is null then
    insert into public.places(place_type,name,city)
    values('stadium',trim(p_name),nullif(trim(coalesce(p_city,'')),''))
    returning id into v_id;
  elsif nullif(trim(coalesce(p_city,'')),'') is not null then
    update public.places set city=trim(p_city),updated_at=now() where id=v_id and city is distinct from trim(p_city);
  end if;
  return v_id;
end
$$;

-- ---------------------------------------------------------------------------
-- 5) Contrôle qualité canonique d une feuille
-- ---------------------------------------------------------------------------
create or replace function public.match_sheet_missing_fields(p_match_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_match public.matches%rowtype;
  v_place public.places%rowtype;
  v_missing text[]:=array[]::text[];
  v_starters integer:=0;
  v_referee boolean:=false;
  v_jersey boolean:=false;
  v_score_f text;
  v_score_o text;
  v_venue_override text;
  v_city_override text;
begin
  select * into v_match from public.matches where id=p_match_id;
  if not found then return array['match_introuvable']; end if;

  if v_match.place_id is not null then select * into v_place from public.places where id=v_match.place_id; end if;

  select count(*)::integer into v_starters
  from public.match_appearances
  where match_id=p_match_id
    and starter=true
    and (player_id is not null or nullif(trim(coalesce(player_name,'')),'') is not null);
  if v_starters<11 then v_missing:=array_append(v_missing,'composition'); end if;

  v_venue_override:=case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'venue_name' then v_match.manual_overrides->>'venue_name' else null end;
  v_city_override:=case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'city' then v_match.manual_overrides->>'city' else null end;

  if nullif(trim(coalesce(v_match.sheet_stadium_name,v_venue_override,v_place.name,'')),'') is null then
    v_missing:=array_append(v_missing,'stade');
  end if;
  if nullif(trim(coalesce(v_match.sheet_city_name,v_city_override,v_place.city,'')),'') is null then
    v_missing:=array_append(v_missing,'ville');
  end if;

  select exists(
    select 1 from public.match_officials mo
    where mo.match_id=p_match_id
      and mo.role ~* '(arbitre|referee)'
      and mo.role !~* '(assistant|assistante|video|var|linesman|lineswoman|fourth|quatri|4e|4eme|reserve)'
  ) into v_referee;
  if nullif(trim(coalesce(v_match.sheet_referee_name,'')),'') is null and not v_referee then
    v_missing:=array_append(v_missing,'arbitre');
  end if;

  if nullif(trim(coalesce(v_match.sheet_coach_name,'')),'') is null and v_match.coach_id is null then
    v_missing:=array_append(v_missing,'selectionneur');
  end if;
  if v_match.competition_edition_id is null then v_missing:=array_append(v_missing,'edition_competition'); end if;

  select exists(select 1 from public.match_jerseys mj where mj.match_id=p_match_id and coalesce(mj.role,'outfield')='outfield') into v_jersey;
  if not v_jersey then v_missing:=array_append(v_missing,'maillot'); end if;

  if coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'france_score' then
    v_score_f:=v_match.manual_overrides->>'france_score';
  else
    v_score_f:=v_match.france_score::text;
  end if;
  if coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then
    v_score_o:=v_match.manual_overrides->>'opponent_score';
  else
    v_score_o:=v_match.opponent_score::text;
  end if;
  if nullif(trim(coalesce(v_score_f,'')),'') is null or nullif(trim(coalesce(v_score_o,'')),'') is null then
    v_missing:=array_append(v_missing,'score');
  end if;

  return v_missing;
end
$$;

revoke all on function public.match_sheet_missing_fields(uuid) from public,anon;
grant execute on function public.match_sheet_missing_fields(uuid) to authenticated;

-- Les anciennes feuilles déjà marquées VALIDÉES sont ré-auditées une fois à l'installation.
-- Si un des 8 champs obligatoires manque réellement, elles passent en À REVALIDER.
update public.matches m
set sheet_validation_status='needs_validation',
    updated_at=now()
where m.gender='M'
  and m.selection_category='A'
  and m.sheet_validation_status='validated'
  and cardinality(public.match_sheet_missing_fields(m.id))>0;

-- ---------------------------------------------------------------------------
-- 6) Validation atomique : sauvegarde + matérialisation + stats dans 1 transaction
-- ---------------------------------------------------------------------------
create or replace function public.validate_match_sheet(
  p_match_id uuid,
  p_appearances jsonb,
  p_goals jsonb,
  p_cards jsonb,
  p_context jsonb,
  p_jersey_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_match public.matches%rowtype;
  v_item jsonb;
  v_id uuid;
  v_player_id uuid;
  v_replacement_id uuid;
  v_assist_id uuid;
  v_place_id uuid;
  v_coach_id uuid;
  v_referee_id uuid;
  v_edition_id uuid;
  v_competition_id uuid;
  v_existing_jersey uuid;
  v_selection_id uuid;
  v_result text;
  v_missing text[];
  v_affected uuid[]:=array[]::uuid[];
  v_appeared uuid[]:=array[]::uuid[];
  v_player_count integer:=0;
  v_revision integer:=0;
  v_stadium text:=nullif(trim(coalesce(p_context->>'stadium','')),'');
  v_city text:=nullif(trim(coalesce(p_context->>'city','')),'');
  v_coach text:=nullif(trim(coalesce(p_context->>'coach','')),'');
  v_referee text:=nullif(trim(coalesce(p_context->>'referee','')),'');
  v_competition text:=nullif(trim(coalesce(p_context->>'competition_name','')),'');
begin
  if auth.uid() is null or not public.can_edit() then raise exception 'Modification non autorisée'; end if;
  if jsonb_typeof(coalesce(p_appearances,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_goals,'[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(p_cards,'[]'::jsonb))<>'array' then
    raise exception 'Payload de feuille invalide';
  end if;

  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'Match introuvable'; end if;
  v_selection_id:=v_match.selection_team_id;
  if v_selection_id is null then raise exception 'Sélection interne manquante pour ce match'; end if;

  select coalesce(array_agg(distinct x.pid),array[]::uuid[]) into v_affected
  from (
    select player_id pid from public.validated_match_player_stats where match_id=p_match_id and player_id is not null
    union
    select player_id from public.match_appearances where match_id=p_match_id and player_id is not null
    union
    select replaced_by_player_id from public.match_appearances where match_id=p_match_id and replaced_by_player_id is not null
  ) x;

  -- Contexte feuille : stade/ville, sélectionneur, arbitre, compétition.
  if v_stadium is not null then
    v_place_id:=public.resolve_or_create_sheet_place(v_stadium,v_city);
  else
    v_place_id:=null;
  end if;
  if v_coach is not null then v_coach_id:=public.resolve_or_create_sheet_personnel(v_coach,'selectionneur'); end if;
  if v_referee is not null then v_referee_id:=public.resolve_or_create_sheet_personnel(v_referee,'arbitre'); end if;

  if nullif(p_context->>'competition_edition_id','') is not null then
    v_edition_id:=(p_context->>'competition_edition_id')::uuid;
    select c.id into v_competition_id
    from public.competitions c
    where c.canonical_edition_id=v_edition_id
      and (c.gender is null or c.gender=v_match.gender)
      and (c.selection_category is null or c.selection_category=v_match.selection_category)
    order by c.created_at nulls last,c.id limit 1;
  elsif v_competition is not null then
    select c.id,c.canonical_edition_id into v_competition_id,v_edition_id
    from public.competitions c
    where public.sheet_name_key(c.name)=public.sheet_name_key(v_competition)
      and (c.gender is null or c.gender=v_match.gender)
      and (c.selection_category is null or c.selection_category=v_match.selection_category)
    order by c.created_at nulls last,c.id limit 1;
  end if;

  update public.matches
  set place_id=v_place_id,
      coach_id=v_coach_id,
      competition_id=coalesce(v_competition_id,competition_id),
      competition_edition_id=v_edition_id,
      sheet_stadium_name=v_stadium,
      sheet_city_name=v_city,
      sheet_referee_name=v_referee,
      sheet_coach_name=v_coach,
      sheet_competition_name=v_competition,
      updated_at=now()
  where id=p_match_id;

  delete from public.match_officials mo
  where mo.match_id=p_match_id
    and mo.role ~* '(arbitre|referee)'
    and mo.role !~* '(assistant|assistante|video|var|linesman|lineswoman|fourth|quatri|4e|4eme|reserve)';
  if v_referee_id is not null then
    insert into public.match_officials(match_id,person_id,role)
    values(p_match_id,v_referee_id,'Arbitre principal')
    on conflict(match_id,person_id,role) do nothing;
  end if;

  -- Maillot France : préserver les composants si le maillot ne change pas.
  select jersey_id into v_existing_jersey
  from public.match_jerseys
  where match_id=p_match_id and coalesce(role,'outfield')='outfield'
  order by updated_at desc nulls last limit 1;
  if p_jersey_id is null then
    delete from public.match_jerseys where match_id=p_match_id and coalesce(role,'outfield')='outfield';
  elsif v_existing_jersey is null then
    insert into public.match_jerseys(match_id,jersey_id,selection_team_id,role,created_by,updated_at)
    values(p_match_id,p_jersey_id,v_selection_id,'outfield',auth.uid(),now());
  elsif v_existing_jersey is distinct from p_jersey_id then
    delete from public.match_jerseys where match_id=p_match_id and coalesce(role,'outfield')='outfield';
    insert into public.match_jerseys(match_id,jersey_id,selection_team_id,role,created_by,updated_at)
    values(p_match_id,p_jersey_id,v_selection_id,'outfield',auth.uid(),now());
  else
    update public.match_jerseys
    set selection_team_id=v_selection_id
    where match_id=p_match_id and jersey_id=p_jersey_id and coalesce(role,'outfield')='outfield';
  end if;

  -- Supprime uniquement les lignes retirées de l éditeur.
  delete from public.match_appearances a
  where a.match_id=p_match_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_appearances,'[]'::jsonb)) j
      where nullif(j->>'id','') is not null and (j->>'id')::uuid=a.id
    );

  -- Composition.
  for v_item in select value from jsonb_array_elements(coalesce(p_appearances,'[]'::jsonb)) loop
    v_id:=case when nullif(v_item->>'id','') is null then null else (v_item->>'id')::uuid end;
    v_player_id:=case when nullif(v_item->>'player_id','') is null then null else (v_item->>'player_id')::uuid end;
    if v_player_id is null and nullif(trim(coalesce(v_item->>'player_name','')),'') is not null then
      v_player_id:=public.resolve_or_create_sheet_player(v_item->>'player_name',v_match.gender,v_selection_id);
    end if;
    v_replacement_id:=case when nullif(v_item->>'replaced_by_player_id','') is null then null else (v_item->>'replaced_by_player_id')::uuid end;
    if v_replacement_id is null and nullif(trim(coalesce(v_item->>'replaced_by_name','')),'') is not null then
      v_replacement_id:=public.resolve_or_create_sheet_player(v_item->>'replaced_by_name',v_match.gender,v_selection_id);
    end if;
    if v_player_id is not null then v_affected:=array_append(v_affected,v_player_id); end if;
    if v_replacement_id is not null then
      v_affected:=array_append(v_affected,v_replacement_id);
      v_appeared:=array_append(v_appeared,v_replacement_id);
    end if;

    if v_id is null and v_player_id is not null then
      select id into v_id from public.match_appearances where match_id=p_match_id and player_id=v_player_id limit 1;
    end if;

    if v_id is not null and exists(select 1 from public.match_appearances where id=v_id and match_id=p_match_id) then
      update public.match_appearances
      set player_id=v_player_id,
          player_name=nullif(trim(coalesce(v_item->>'player_name','')),''),
          starter=coalesce((v_item->>'starter')::boolean,false),
          appeared=false,
          lineup_slot=case when nullif(v_item->>'lineup_slot','') is null then null else (v_item->>'lineup_slot')::integer end,
          minutes=case when nullif(v_item->>'minutes','') is null then null else (v_item->>'minutes')::integer end,
          squad_status=nullif(v_item->>'squad_status',''),
          shirt_number=case when nullif(v_item->>'shirt_number','') is null then null else (v_item->>'shirt_number')::integer end,
          position_id=case when nullif(v_item->>'position_id','') is null then null else (v_item->>'position_id')::uuid end,
          position=nullif(v_item->>'position',''),
          captain=coalesce((v_item->>'captain')::boolean,false),
          replaced_by_player_id=v_replacement_id,
          replaced_by_name=nullif(trim(coalesce(v_item->>'replaced_by_name','')),''),
          verification=coalesce(nullif(v_item->>'verification',''),'manual')
      where id=v_id;
    else
      insert into public.match_appearances(
        match_id,player_id,player_name,starter,appeared,lineup_slot,minutes,squad_status,shirt_number,
        position_id,position,captain,replaced_by_player_id,replaced_by_name,verification
      ) values(
        p_match_id,v_player_id,nullif(trim(coalesce(v_item->>'player_name','')),''),coalesce((v_item->>'starter')::boolean,false),false,
        case when nullif(v_item->>'lineup_slot','') is null then null else (v_item->>'lineup_slot')::integer end,
        case when nullif(v_item->>'minutes','') is null then null else (v_item->>'minutes')::integer end,
        nullif(v_item->>'squad_status',''),
        case when nullif(v_item->>'shirt_number','') is null then null else (v_item->>'shirt_number')::integer end,
        case when nullif(v_item->>'position_id','') is null then null else (v_item->>'position_id')::uuid end,
        nullif(v_item->>'position',''),coalesce((v_item->>'captain')::boolean,false),v_replacement_id,
        nullif(trim(coalesce(v_item->>'replaced_by_name','')),''),coalesce(nullif(v_item->>'verification',''),'manual')
      );
    end if;

    if coalesce((v_item->>'starter')::boolean,false) and v_player_id is not null then
      v_appeared:=array_append(v_appeared,v_player_id);
    end if;
  end loop;

  -- Buts : mise à jour par ID, insertion des nouveaux, suppression des lignes retirées.
  delete from public.match_goal_events g
  where g.match_id=p_match_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb)) j
      where nullif(j->>'id','') is not null and (j->>'id')::uuid=g.id
    );

  for v_item in select value from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb)) loop
    v_id:=case when nullif(v_item->>'id','') is null then null else (v_item->>'id')::uuid end;
    v_player_id:=case when nullif(v_item->>'player_id','') is null then null else (v_item->>'player_id')::uuid end;
    v_assist_id:=case when nullif(v_item->>'assist_player_id','') is null then null else (v_item->>'assist_player_id')::uuid end;
    if public.sheet_name_key(v_item->>'team_name')='france' then
      if v_player_id is null then v_player_id:=public.resolve_or_create_sheet_player(v_item->>'scorer_name',v_match.gender,v_selection_id); end if;
      if v_assist_id is null and nullif(trim(coalesce(v_item->>'assist_name','')),'') is not null then
        v_assist_id:=public.resolve_or_create_sheet_player(v_item->>'assist_name',v_match.gender,v_selection_id);
      end if;
      if v_player_id is not null then v_affected:=array_append(v_affected,v_player_id);v_appeared:=array_append(v_appeared,v_player_id); end if;
      if v_assist_id is not null then v_affected:=array_append(v_affected,v_assist_id);v_appeared:=array_append(v_appeared,v_assist_id); end if;
    else
      v_player_id:=null;v_assist_id:=null;
    end if;

    if v_id is not null and exists(select 1 from public.match_goal_events where id=v_id and match_id=p_match_id) then
      update public.match_goal_events
      set player_id=v_player_id,scorer_name=coalesce(nullif(trim(v_item->>'scorer_name'),''),'Inconnu'),team_name=nullif(v_item->>'team_name',''),
          minute_text=nullif(v_item->>'minute_text',''),score_after=nullif(v_item->>'score_after',''),assist_player_id=v_assist_id,
          assist_name=nullif(trim(coalesce(v_item->>'assist_name','')),''),goal_type=nullif(v_item->>'goal_type',''),
          body_part=nullif(v_item->>'body_part',''),is_penalty=coalesce((v_item->>'is_penalty')::boolean,false),
          is_own_goal=coalesce((v_item->>'is_own_goal')::boolean,false),updated_at=now()
      where id=v_id;
    else
      insert into public.match_goal_events(match_id,player_id,scorer_name,team_name,minute_text,score_after,assist_player_id,assist_name,goal_type,body_part,is_penalty,is_own_goal,updated_at)
      values(p_match_id,v_player_id,coalesce(nullif(trim(v_item->>'scorer_name'),''),'Inconnu'),nullif(v_item->>'team_name',''),nullif(v_item->>'minute_text',''),nullif(v_item->>'score_after',''),v_assist_id,nullif(trim(coalesce(v_item->>'assist_name','')),''),nullif(v_item->>'goal_type',''),nullif(v_item->>'body_part',''),coalesce((v_item->>'is_penalty')::boolean,false),coalesce((v_item->>'is_own_goal')::boolean,false),now());
    end if;
  end loop;

  -- Cartons.
  delete from public.match_card_events c
  where c.match_id=p_match_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) j
      where nullif(j->>'id','') is not null and (j->>'id')::uuid=c.id
    );

  for v_item in select value from jsonb_array_elements(coalesce(p_cards,'[]'::jsonb)) loop
    v_id:=case when nullif(v_item->>'id','') is null then null else (v_item->>'id')::uuid end;
    v_player_id:=case when nullif(v_item->>'player_id','') is null then null else (v_item->>'player_id')::uuid end;
    if public.sheet_name_key(v_item->>'team_name')='france' then
      if v_player_id is null then v_player_id:=public.resolve_or_create_sheet_player(v_item->>'player_name',v_match.gender,v_selection_id); end if;
      if v_player_id is not null then v_affected:=array_append(v_affected,v_player_id);v_appeared:=array_append(v_appeared,v_player_id); end if;
    else
      v_player_id:=null;
    end if;

    if v_id is not null and exists(select 1 from public.match_card_events where id=v_id and match_id=p_match_id) then
      update public.match_card_events
      set player_id=v_player_id,player_name=coalesce(nullif(trim(v_item->>'player_name'),''),'Inconnu'),team_name=nullif(v_item->>'team_name',''),
          card_type=coalesce(nullif(v_item->>'card_type',''),'yellow'),minute_text=nullif(v_item->>'minute_text',''),updated_at=now()
      where id=v_id;
    else
      insert into public.match_card_events(match_id,player_id,player_name,team_name,card_type,minute_text,updated_at)
      values(p_match_id,v_player_id,coalesce(nullif(trim(v_item->>'player_name'),''),'Inconnu'),nullif(v_item->>'team_name',''),coalesce(nullif(v_item->>'card_type',''),'yellow'),nullif(v_item->>'minute_text',''),now());
    end if;
  end loop;

  -- Toute personne dont un événement ou un remplacement prouve l entrée en jeu doit avoir une ligne d apparition.
  for v_player_id in
    select distinct u.pid from unnest(coalesce(v_appeared,array[]::uuid[])) as u(pid) where u.pid is not null
  loop
    if not exists(select 1 from public.match_appearances where match_id=p_match_id and player_id=v_player_id) then
      insert into public.match_appearances(match_id,player_id,player_name,starter,appeared,squad_status,verification)
      select p_match_id,p.id,p.display_name,false,true,'Remplaçant(e)','validated-event'
      from public.players p where p.id=v_player_id;
    end if;
  end loop;

  update public.match_appearances set appeared=false where match_id=p_match_id;
  update public.match_appearances
  set appeared=true
  where match_id=p_match_id
    and (starter=true or player_id=any(coalesce(v_appeared,array[]::uuid[])));

  -- Compteurs événementiels cohérents avec les événements détaillés.
  update public.match_appearances
  set goals=0,assists=0,yellow_cards=0,red_cards=0
  where match_id=p_match_id;

  update public.match_appearances a
  set goals=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.player_id=a.player_id),
      assists=(select count(*)::integer from public.match_goal_events g where g.match_id=p_match_id and g.assist_player_id=a.player_id),
      yellow_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('yellow','second_yellow')),
      red_cards=(select count(*)::integer from public.match_card_events c where c.match_id=p_match_id and c.player_id=a.player_id and c.card_type in('red','second_yellow'))
  where a.match_id=p_match_id and a.player_id is not null;

  -- Contrôle avant tout recalcul statistique. Toute erreur annule la transaction entière.
  v_missing:=public.match_sheet_missing_fields(p_match_id);
  if cardinality(v_missing)>0 then
    raise exception 'Feuille incomplète : %',array_to_string(v_missing,', ');
  end if;

  select * into v_match from public.matches where id=p_match_id;
  if coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'france_score' then
    v_result:=case
      when (v_match.manual_overrides->>'france_score')::integer>(case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then (v_match.manual_overrides->>'opponent_score')::integer else v_match.opponent_score end) then 'V'
      when (v_match.manual_overrides->>'france_score')::integer<(case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then (v_match.manual_overrides->>'opponent_score')::integer else v_match.opponent_score end) then 'D'
      else 'N' end;
  else
    v_result:=case
      when v_match.france_score>(case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then (v_match.manual_overrides->>'opponent_score')::integer else v_match.opponent_score end) then 'V'
      when v_match.france_score<(case when coalesce(v_match.manual_overrides,'{}'::jsonb) ? 'opponent_score' then (v_match.manual_overrides->>'opponent_score')::integer else v_match.opponent_score end) then 'D'
      else 'N' end;
  end if;

  delete from public.validated_match_player_stats where match_id=p_match_id;

  insert into public.validated_match_player_stats(
    match_id,player_id,selection_id,appeared,starter,minutes,goals,shirt_number,position_id,position_text,captain,result_code,validated_at
  )
  select
    a.match_id,a.player_id,v_selection_id,true,a.starter,a.minutes,
    coalesce((select count(*)::integer from public.match_goal_events g where g.match_id=a.match_id and g.player_id=a.player_id),0),
    a.shirt_number,a.position_id,a.position,a.captain,v_result,now()
  from public.match_appearances a
  where a.match_id=p_match_id and a.appeared=true and a.player_id is not null;

  get diagnostics v_player_count=row_count;

  select coalesce(array_agg(distinct player_id),array[]::uuid[]) into v_appeared
  from public.validated_match_player_stats where match_id=p_match_id;
  v_affected:=coalesce(v_affected,array[]::uuid[])||coalesce(v_appeared,array[]::uuid[]);

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

  perform public.recalculate_match_numbers();

  return jsonb_build_object(
    'ok',true,
    'match_id',p_match_id,
    'player_count',v_player_count,
    'revision',v_revision,
    'chronological_number',(select chronological_number from public.matches where id=p_match_id)
  );
end
$$;

revoke all on function public.validate_match_sheet(uuid,jsonb,jsonb,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.validate_match_sheet(uuid,jsonb,jsonb,jsonb,jsonb,uuid) to authenticated;

-- Recalcule immédiatement la numérotation existante.
select public.recalculate_match_numbers();

commit;
