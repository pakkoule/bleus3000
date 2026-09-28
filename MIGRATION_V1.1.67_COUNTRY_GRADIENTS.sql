-- 3615 Bleus V1.1.67 — dégradés des couleurs pays
begin;
alter table public.country_display_colors
  add column if not exists display_mode text not null default 'gradient',
  add column if not exists gradient_angle integer not null default 180;

alter table public.country_display_colors
  drop constraint if exists country_display_colors_display_mode_check;
alter table public.country_display_colors
  add constraint country_display_colors_display_mode_check
  check (display_mode in ('solid','gradient'));

alter table public.country_display_colors
  drop constraint if exists country_display_colors_gradient_angle_check;
alter table public.country_display_colors
  add constraint country_display_colors_gradient_angle_check
  check (gradient_angle between 0 and 360);
commit;
