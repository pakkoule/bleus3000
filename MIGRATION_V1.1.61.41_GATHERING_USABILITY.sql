-- 3615 Bleus V1.1.61.41 — état explicite « Non remplacé »
alter table public.callup_players
  add column if not exists not_replaced boolean not null default false;

comment on column public.callup_players.not_replaced is
  'Vrai quand un forfait est explicitement déclaré non remplacé. Distingue ce cas d un remplacement encore en attente.';
