-- Bleus 3000 V1.1.19 — gestionnaire d'accomplissements + icônes + affiliations
alter table public.achievements
  add column if not exists is_active boolean not null default true;
alter table public.achievements
  add column if not exists icon_storage_path text;

create table if not exists public.achievement_reference_scopes (
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  reference_type text not null check (reference_type in (
    'selection','callup','match','competition','opponent',
    'personnel','equipment','statistics','place','bibliography'
  )),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (achievement_id, reference_type)
);
alter table public.achievement_reference_scopes enable row level security;
drop policy if exists achievement_reference_scopes_read on public.achievement_reference_scopes;
drop policy if exists achievement_reference_scopes_write on public.achievement_reference_scopes;
create policy achievement_reference_scopes_read on public.achievement_reference_scopes
  for select to anon,authenticated using(true);
create policy achievement_reference_scopes_write on public.achievement_reference_scopes
  for all to authenticated using(public.can_edit_selections()) with check(public.can_edit_selections());
create index if not exists achievement_reference_scopes_type_idx on public.achievement_reference_scopes(reference_type);

insert into public.achievement_reference_scopes(achievement_id,reference_type,created_by)
select a.id,'selection',a.created_by from public.achievements a where a.slug='capitanat'
on conflict do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('achievement-icons','achievement-icons',true,524288,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists achievement_icons_insert on storage.objects;
drop policy if exists achievement_icons_update on storage.objects;
drop policy if exists achievement_icons_delete on storage.objects;
create policy achievement_icons_insert on storage.objects for insert to authenticated
with check(bucket_id='achievement-icons' and public.can_edit_selections() and (storage.foldername(name))[1]=auth.uid()::text);
create policy achievement_icons_update on storage.objects for update to authenticated
using(bucket_id='achievement-icons' and (owner=auth.uid() or public.can_edit_selections()))
with check(bucket_id='achievement-icons' and (owner=auth.uid() or public.can_edit_selections()));
create policy achievement_icons_delete on storage.objects for delete to authenticated
using(bucket_id='achievement-icons' and (owner=auth.uid() or public.can_edit_selections()));

create index if not exists players_secondary_positions_gin on public.players using gin(secondary_positions);
