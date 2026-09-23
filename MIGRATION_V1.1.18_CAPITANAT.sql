-- Bleus 3000 V1.1.18 — Accomplissement Capitanat
alter table public.player_achievements
  add column if not exists achievement_value integer
  check (achievement_value is null or achievement_value >= 0);

insert into public.achievements(
  slug,label_text,icon_text,icon_image_path,description_short,appearance
)
values(
  'capitanat',
  'Capitanat',
  'C',
  'assets/achievement-capitanat.png',
  'Nombre de capitanats avec la sélection concernée.',
  jsonb_build_object(
    'badge_background','navy_duotone',
    'counter_prefix','×',
    'counter_position','top'
  )
)
on conflict (slug) do update set
  label_text=excluded.label_text,
  icon_text=excluded.icon_text,
  icon_image_path=excluded.icon_image_path,
  description_short=excluded.description_short,
  appearance=excluded.appearance,
  updated_at=now();
