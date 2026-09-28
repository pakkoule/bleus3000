-- 3615 Bleus V1.1.61.33 — Couleurs éditoriales des pays
-- Déjà appliquée sur le projet Supabase bleus3000 le 28/09/2026.

create table if not exists public.country_display_colors (
  country_code text primary key,
  country_name text not null,
  primary_color text not null,
  secondary_color text,
  text_color text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint country_display_colors_code_check check (country_code ~ '^[a-z0-9-]{2,12}$'),
  constraint country_display_colors_primary_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint country_display_colors_secondary_check check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint country_display_colors_text_check check (text_color is null or text_color ~ '^#[0-9A-Fa-f]{6}$')
);

alter table public.country_display_colors enable row level security;
drop policy if exists country_display_colors_read on public.country_display_colors;
create policy country_display_colors_read on public.country_display_colors for select to anon,authenticated using (true);
drop policy if exists country_display_colors_insert on public.country_display_colors;
create policy country_display_colors_insert on public.country_display_colors for insert to authenticated with check ((select public.can_edit()));
drop policy if exists country_display_colors_update on public.country_display_colors;
create policy country_display_colors_update on public.country_display_colors for update to authenticated using ((select public.can_edit())) with check ((select public.can_edit()));
drop policy if exists country_display_colors_delete on public.country_display_colors;
create policy country_display_colors_delete on public.country_display_colors for delete to authenticated using ((select public.can_edit()));
grant select on public.country_display_colors to anon,authenticated;
grant insert,update,delete on public.country_display_colors to authenticated;

comment on table public.country_display_colors is
'Overrides éditoriaux des couleurs de pays pour les scoreboards. Sans ligne : maillot France / couleur dominante du drapeau adverse.';
