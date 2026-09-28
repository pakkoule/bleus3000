-- 3615 Bleus V1.1.61.36 — Maillots : bibliothèque d'équipement complète
begin;

alter table public.jerseys
  add column if not exists family_key text,
  add column if not exists flocking_example_name text,
  add column if not exists flocking_example_number integer,
  add column if not exists flocking_example_photo_url text;

create index if not exists jerseys_family_key_idx on public.jerseys(family_key) where family_key is not null;

create table if not exists public.kit_components (
  id uuid primary key default gen_random_uuid(),
  component_type text not null,
  title text not null,
  selection_team_id uuid references public.selection_teams(id) on delete set null,
  season_label text,
  year_start integer,
  year_end integer,
  usage_type text,
  primary_color text,
  secondary_color text,
  image_path text,
  image_url text,
  notes_short text,
  source_urls text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kit_components_type_check check (component_type in ('short','socks'))
);
create index if not exists kit_components_type_year_idx on public.kit_components(component_type,year_start,year_end);
create index if not exists kit_components_team_idx on public.kit_components(selection_team_id);

create table if not exists public.jersey_kit_components (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  component_id uuid not null references public.kit_components(id) on delete cascade,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(jersey_id,component_id)
);
create index if not exists jersey_kit_components_component_idx on public.jersey_kit_components(component_id);

create table if not exists public.jersey_variants (
  id uuid primary key default gen_random_uuid(),
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  label text not null,
  variant_kind text not null default 'sleeve',
  usage_type text,
  sleeve_type text,
  primary_color text,
  secondary_color text,
  image_path text,
  image_url text,
  notes_short text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jersey_variants_kind_check check (variant_kind in ('sleeve','usage','goalkeeper','special'))
);
create index if not exists jersey_variants_jersey_idx on public.jersey_variants(jersey_id,variant_kind);

create table if not exists public.jersey_opponents (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  opponent_id uuid not null references public.opponents(id) on delete cascade,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(jersey_id,opponent_id)
);
create index if not exists jersey_opponents_opponent_idx on public.jersey_opponents(opponent_id);

create table if not exists public.competition_patches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_path text,
  image_url text,
  valid_from date,
  valid_to date,
  notes_short text,
  source_urls text[] not null default '{}',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competition_patch_tags (
  patch_id uuid not null references public.competition_patches(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  relation_kind text not null default 'competition',
  created_at timestamptz not null default now(),
  primary key(patch_id,tag_id)
);
create index if not exists competition_patch_tags_tag_idx on public.competition_patch_tags(tag_id);

create table if not exists public.jersey_patches (
  jersey_id uuid not null references public.jerseys(id) on delete cascade,
  patch_id uuid not null references public.competition_patches(id) on delete cascade,
  placement text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(jersey_id,patch_id)
);
create index if not exists jersey_patches_patch_idx on public.jersey_patches(patch_id);

alter table public.match_jerseys
  add column if not exists short_component_id uuid references public.kit_components(id) on delete set null,
  add column if not exists socks_component_id uuid references public.kit_components(id) on delete set null,
  add column if not exists jersey_variant_id uuid references public.jersey_variants(id) on delete set null;

create index if not exists match_jerseys_short_idx on public.match_jerseys(short_component_id) where short_component_id is not null;
create index if not exists match_jerseys_socks_idx on public.match_jerseys(socks_component_id) where socks_component_id is not null;
create index if not exists match_jerseys_variant_idx on public.match_jerseys(jersey_variant_id) where jersey_variant_id is not null;

create table if not exists public.match_jersey_patches (
  match_id uuid not null,
  jersey_id uuid not null,
  role text not null default 'outfield',
  patch_id uuid not null references public.competition_patches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(match_id,jersey_id,role,patch_id),
  constraint match_jersey_patches_kit_fk foreign key(match_id,jersey_id,role)
    references public.match_jerseys(match_id,jersey_id,role) on delete cascade
);
create index if not exists match_jersey_patches_patch_idx on public.match_jersey_patches(patch_id);

alter table public.kit_components enable row level security;
alter table public.jersey_kit_components enable row level security;
alter table public.jersey_variants enable row level security;
alter table public.jersey_opponents enable row level security;
alter table public.competition_patches enable row level security;
alter table public.competition_patch_tags enable row level security;
alter table public.jersey_patches enable row level security;
alter table public.match_jersey_patches enable row level security;

-- Lecture publique ; écriture ADMIN / SUPERADMIN via public.can_edit().
do $$
declare t text;
begin
  foreach t in array array['kit_components','jersey_kit_components','jersey_variants','jersey_opponents','competition_patches','competition_patch_tags','jersey_patches','match_jersey_patches'] loop
    execute format('drop policy if exists %I_public_read on public.%I',t,t);
    execute format('create policy %I_public_read on public.%I for select to anon,authenticated using(true)',t,t);
    execute format('drop policy if exists %I_insert on public.%I',t,t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check((select public.can_edit()))',t,t);
    execute format('drop policy if exists %I_update on public.%I',t,t);
    execute format('create policy %I_update on public.%I for update to authenticated using((select public.can_edit())) with check((select public.can_edit()))',t,t);
    execute format('drop policy if exists %I_delete on public.%I',t,t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using((select public.can_edit()))',t,t);
    execute format('grant select on public.%I to anon,authenticated',t);
    execute format('grant insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

comment on table public.kit_components is 'Bibliothèque réutilisable des shorts et chaussettes des sélections françaises.';
comment on table public.jersey_kit_components is 'Associations multiples maillot ↔ shorts / chaussettes.';
comment on table public.jersey_variants is 'Variantes directement rattachées à un maillot : manches, usage, gardien, édition spéciale.';
comment on table public.jersey_opponents is 'Adversaires pour lesquels un maillot est recommandé ou documenté.';
comment on table public.competition_patches is 'Bibliothèque des patchs compétition sans duplication.';
comment on table public.competition_patch_tags is 'Relation patch ↔ tag compétition ENTITÉ ou ÉDITION.';
comment on table public.jersey_patches is 'Patchs compatibles / documentés pour un maillot.';
comment on table public.match_jersey_patches is 'Patchs réellement portés avec le maillot sur un match.';
comment on column public.match_jerseys.short_component_id is 'Short réellement porté pour ce match.';
comment on column public.match_jerseys.socks_component_id is 'Chaussettes réellement portées pour ce match.';
comment on column public.match_jerseys.jersey_variant_id is 'Variante de maillot réellement portée (ex. manches longues).';

commit;
