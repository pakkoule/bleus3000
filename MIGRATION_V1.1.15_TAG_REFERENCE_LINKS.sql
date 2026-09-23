-- Bleus 3000 V1.1.15 — liaison explicite Tags ↔ Référentiels
create table if not exists public.tag_reference_links (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.tags(id) on delete cascade,
  reference_type text not null check (reference_type in ('selection','competition','opponent','place','personnel','equipment','bibliography','match','callup')),
  reference_id uuid not null,
  relation_kind text not null default 'membership' check (relation_kind in ('membership','status','topic')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(tag_id,reference_type,reference_id,relation_kind)
);
alter table public.tag_reference_links enable row level security;
drop policy if exists tag_reference_links_read on public.tag_reference_links;
drop policy if exists tag_reference_links_write on public.tag_reference_links;
create policy tag_reference_links_read on public.tag_reference_links for select to anon,authenticated using(true);
create policy tag_reference_links_write on public.tag_reference_links for all to authenticated using(public.can_contribute()) with check(public.can_contribute());
create index if not exists tag_reference_links_tag_idx on public.tag_reference_links(tag_id);
create index if not exists tag_reference_links_ref_idx on public.tag_reference_links(reference_type,reference_id,relation_kind);
