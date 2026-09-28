-- 3615 Bleus V1.1.61.44 — médias reliés aux matchs
create table if not exists public.match_media_assets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  asset_type text not null,
  title text,
  url text,
  image_path text,
  image_url text,
  source_url text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_media_assets_type_check check (asset_type = any(array['newspaper_front','ticket','youtube']::text[]))
);
create index if not exists match_media_assets_match_idx on public.match_media_assets(match_id,sort_order,created_at);
alter table public.match_media_assets enable row level security;
drop policy if exists match_media_assets_read on public.match_media_assets;
create policy match_media_assets_read on public.match_media_assets for select to anon,authenticated using(true);
drop policy if exists match_media_assets_insert on public.match_media_assets;
create policy match_media_assets_insert on public.match_media_assets for insert to authenticated with check((select public.can_edit()));
drop policy if exists match_media_assets_update on public.match_media_assets;
create policy match_media_assets_update on public.match_media_assets for update to authenticated using((select public.can_edit())) with check((select public.can_edit()));
drop policy if exists match_media_assets_delete on public.match_media_assets;
create policy match_media_assets_delete on public.match_media_assets for delete to authenticated using((select public.can_edit()));
grant select on public.match_media_assets to anon,authenticated;
grant insert,update,delete on public.match_media_assets to authenticated;
comment on table public.match_media_assets is 'Médias reliés à une tuile match : une de journal, billet historique ou vidéo YouTube.';
