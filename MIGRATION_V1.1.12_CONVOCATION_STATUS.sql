-- Bleus 3000 V1.1.12 — statut Convocation / International
alter table public.player_selection_stats
  add column if not exists appearance_status text not null default 'capped'
  check (appearance_status in ('capped','called_only'));

update public.player_selection_stats
set appearance_status='capped'
where appearance_status is null
   or selections > 0
   or international_number is not null;

create index if not exists pss_appearance_status_idx
  on public.player_selection_stats(selection_id, appearance_status);
