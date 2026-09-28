create or replace function public.validate_match_kit_components()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  if new.short_component_id is not null and not exists (
    select 1
    from public.kit_components c
    join public.jersey_kit_components l on l.component_id=c.id
    where c.id=new.short_component_id
      and c.component_type='short'
      and l.jersey_id=new.jersey_id
  ) then
    raise exception 'Le short sélectionné doit être un short associé au maillot.';
  end if;

  if new.socks_component_id is not null and not exists (
    select 1
    from public.kit_components c
    join public.jersey_kit_components l on l.component_id=c.id
    where c.id=new.socks_component_id
      and c.component_type='socks'
      and l.jersey_id=new.jersey_id
  ) then
    raise exception 'Les chaussettes sélectionnées doivent être associées au maillot.';
  end if;

  if new.jersey_variant_id is not null and not exists (
    select 1 from public.jersey_variants v
    where v.id=new.jersey_variant_id
      and v.jersey_id=new.jersey_id
  ) then
    raise exception 'La variante sélectionnée doit appartenir au maillot.';
  end if;

  return new;
end $$;

drop trigger if exists trg_validate_match_kit_components on public.match_jerseys;
create trigger trg_validate_match_kit_components
before insert or update of jersey_id,short_component_id,socks_component_id,jersey_variant_id
on public.match_jerseys
for each row execute function public.validate_match_kit_components();

revoke all on function public.validate_match_kit_components() from public,anon,authenticated;
