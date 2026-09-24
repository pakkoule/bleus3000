-- 3615 Bleus V1.1.42 — cadres de mise en avant du calendrier
alter table public.matches
  add column if not exists feature_frame_mode text not null default 'auto';

alter table public.matches
  drop constraint if exists matches_feature_frame_mode_check;

alter table public.matches
  add constraint matches_feature_frame_mode_check
  check (feature_frame_mode in ('auto','on','off'));

create table if not exists public.calendar_feature_styles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_text text not null,
  gradient_colors text[] not null default array['#123b8f','#2563eb','#ef3340']::text[],
  gradient_angle integer not null default 135 check (gradient_angle between 0 and 360),
  border_width integer not null default 2 check (border_width between 1 and 8),
  border_radius integer not null default 12 check (border_radius between 0 and 32),
  glow_color text not null default '#2563eb',
  glow_strength integer not null default 12 check (glow_strength between 0 and 40),
  is_default boolean not null default false,
  active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_feature_styles_colors_check check (cardinality(gradient_colors) between 1 and 5)
);

alter table public.calendar_feature_styles enable row level security;

drop policy if exists calendar_feature_styles_read on public.calendar_feature_styles;
create policy calendar_feature_styles_read
on public.calendar_feature_styles for select to anon,authenticated
using (active=true);

drop policy if exists calendar_feature_styles_write on public.calendar_feature_styles;
create policy calendar_feature_styles_write
on public.calendar_feature_styles for all to authenticated
using ((select public.can_edit()))
with check ((select public.can_edit()));

grant select on public.calendar_feature_styles to anon,authenticated;
grant insert,update,delete on public.calendar_feature_styles to authenticated;
grant select,insert,update,delete on public.calendar_feature_styles to service_role;

insert into public.calendar_feature_styles
(slug,label_text,gradient_colors,gradient_angle,border_width,border_radius,glow_color,glow_strength,is_default,active)
values
('international','Affiche internationale',array['#123b8f','#2563eb','#ffffff','#ef3340']::text[],135,2,12,'#2563eb',12,true,true)
on conflict (slug) do update set is_default=true,active=true,updated_at=now();
