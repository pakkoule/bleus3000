-- 3615 Bleus V1.1.38
-- Dégradés de tags jusqu'à 5 couleurs.
-- La création de matchs réutilise le schéma relationnel existant et ne nécessite pas de nouvelle table.

alter table public.tags
  add column if not exists gradient_colors text[] not null default '{}'::text[];

update public.tags
set gradient_colors = case
  when appearance = 'solid' then array[color_start]
  else array[color_start, color_end]
end
where cardinality(gradient_colors)=0;

alter table public.tags
  drop constraint if exists tags_gradient_colors_check;

alter table public.tags
  add constraint tags_gradient_colors_check
  check (cardinality(gradient_colors) between 0 and 5);
