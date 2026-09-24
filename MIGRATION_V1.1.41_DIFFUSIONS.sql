-- 3615 Bleus V1.1.41 — entités de chaînes de diffusion et tags/logo
alter table public.tags drop constraint if exists tags_reference_scope_check;
alter table public.tags add constraint tags_reference_scope_check
check (reference_scope is null or reference_scope in ('selection','competition','broadcast','general'));

alter table public.tag_reference_links drop constraint if exists tag_reference_links_reference_type_check;
alter table public.tag_reference_links add constraint tag_reference_links_reference_type_check
check (reference_type in ('selection','competition','opponent','place','personnel','equipment','bibliography','match','callup','broadcast'));

create table if not exists public.broadcast_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  aliases text[] not null default '{}'::text[],
  tag_id uuid references public.tags(id) on delete set null,
  website_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_broadcast_channels (
  match_id uuid not null references public.matches(id) on delete cascade,
  broadcast_channel_id uuid not null references public.broadcast_channels(id) on delete cascade,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (match_id,broadcast_channel_id)
);

alter table public.broadcast_channels enable row level security;
alter table public.match_broadcast_channels enable row level security;

drop policy if exists broadcast_channels_read on public.broadcast_channels;
create policy broadcast_channels_read on public.broadcast_channels for select to anon,authenticated using (active=true);
drop policy if exists broadcast_channels_write on public.broadcast_channels;
create policy broadcast_channels_write on public.broadcast_channels for all to authenticated
using ((select public.can_edit())) with check ((select public.can_edit()));

drop policy if exists match_broadcast_channels_read on public.match_broadcast_channels;
create policy match_broadcast_channels_read on public.match_broadcast_channels for select to anon,authenticated using (true);
drop policy if exists match_broadcast_channels_write on public.match_broadcast_channels;
create policy match_broadcast_channels_write on public.match_broadcast_channels for all to authenticated
using ((select public.can_edit())) with check ((select public.can_edit()));

grant select on public.broadcast_channels to anon,authenticated;
grant insert,update,delete on public.broadcast_channels to authenticated;
grant select on public.match_broadcast_channels to anon,authenticated;
grant insert,update,delete on public.match_broadcast_channels to authenticated;
grant select,insert,update,delete on public.broadcast_channels,public.match_broadcast_channels to service_role;

-- Nettoyage sûr des noms d'adversaires : la section est portée par le tag de sélection,
-- pas par le nom du pays. Les doublons sont fusionnés avant suppression de l'ancienne ligne.
do $$
declare
  r record;
  target_id uuid;
  base_name text;
begin
  for r in
    select id,name from public.opponents
    where name ~* '\s+(Women\s+)?U(16|17|18|19|20|21|23)$'
       or name ~* '\s+(Women|Woman|Féminine|Feminine|Espoirs)$'
  loop
    base_name := trim(regexp_replace(r.name,'\s+(Women\s+)?U(16|17|18|19|20|21|23)$','','i'));
    base_name := trim(regexp_replace(base_name,'\s+(Women|Woman|Féminine|Feminine|Espoirs)$','','i'));
    if base_name = '' or base_name = r.name then continue; end if;
    select id into target_id from public.opponents where lower(name)=lower(base_name) and id<>r.id limit 1;
    if target_id is not null then
      update public.matches set opponent_id=target_id,updated_at=now() where opponent_id=r.id;
      delete from public.opponents where id=r.id;
    else
      update public.opponents set name=base_name where id=r.id;
    end if;
    target_id := null;
  end loop;
end $$;
