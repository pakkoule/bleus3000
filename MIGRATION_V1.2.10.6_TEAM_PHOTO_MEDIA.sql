-- 3615 Bleus V1.2.10.6 — Photo d’équipe dans les médias de match
-- À exécuter sur une base existante avant d’ajouter une Photo d’équipe.

begin;

alter table public.match_media_assets
  drop constraint if exists match_media_assets_type_check;

alter table public.match_media_assets
  add constraint match_media_assets_type_check
  check (asset_type = any(array['newspaper_front','team_photo','ticket','youtube','ball']::text[]));

comment on table public.match_media_assets is
  'Médias reliés à une tuile match : une de journal, photo d’équipe, ballon, billet historique ou lien vidéo YouTube.';

commit;
