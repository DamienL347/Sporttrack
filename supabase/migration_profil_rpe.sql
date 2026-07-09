-- ============================================================
-- MIGRATION — Profil athlète + charge sRPE
-- À exécuter UNE FOIS dans Supabase → SQL Editor → Run
-- (sans danger si relancé : "if not exists" / "add column if not exists")
-- ============================================================

-- 1) Colonne RPE (intensité perçue 1-10) sur les séances → charge sRPE
alter table sessions add column if not exists rpe integer check (rpe between 1 and 10);

-- 2) Table profil athlète (une seule ligne, id = 1)
create table if not exists profile (
  id                bigint primary key default 1,
  nom               text,
  sexe              text,               -- 'H' | 'F'
  age               integer,
  poids_kg          numeric,
  taille_cm         numeric,
  fc_max            integer,
  fc_repos          integer,
  objectif          text,               -- ex : "Performance padel", "Perte de poids"
  calendrier        text,               -- prochains tournois / échéances
  blessures         text,               -- contraintes / antécédents
  preferences_alim  text,
  notes_coach       text,               -- mémoire libre lue par le coach
  updated_at        timestamptz default now(),
  constraint profile_singleton check (id = 1)
);

alter table profile enable row level security;
create policy "allow all profile" on profile for all using (true) with check (true);

-- Ligne par défaut
insert into profile (id) values (1) on conflict (id) do nothing;
