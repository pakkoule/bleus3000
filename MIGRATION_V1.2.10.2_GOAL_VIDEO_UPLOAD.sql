-- 3615 Bleus V1.2.10.2 — Upload direct des vidéos de buts
-- Crée un bucket public dédié aux clips vidéo. Les URL sont enregistrées dans match_goal_events.video_url.

begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'goal-videos',
  'goal-videos',
  true,
  52428800,
  array['video/mp4','video/webm','video/quicktime','video/x-m4v']::text[]
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists goal_videos_select on storage.objects;
drop policy if exists goal_videos_insert on storage.objects;
drop policy if exists goal_videos_update on storage.objects;
drop policy if exists goal_videos_delete on storage.objects;

create policy goal_videos_select on storage.objects
for select to anon,authenticated
using(bucket_id='goal-videos');

create policy goal_videos_insert on storage.objects
for insert to authenticated
with check(bucket_id='goal-videos' and public.can_edit());

create policy goal_videos_update on storage.objects
for update to authenticated
using(bucket_id='goal-videos' and public.can_edit())
with check(bucket_id='goal-videos' and public.can_edit());

create policy goal_videos_delete on storage.objects
for delete to authenticated
using(bucket_id='goal-videos' and public.can_edit());

commit;
