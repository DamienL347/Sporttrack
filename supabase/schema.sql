-- ============================================================
-- SPORT TRACKER — Schéma Supabase
-- Copie-colle ce SQL dans l'éditeur SQL de ton projet Supabase
-- ============================================================

-- TABLE SESSIONS (Sport)
create table if not exists sessions (
  id bigint generated always as identity primary key,
  date date not null,
  sport text not null,
  duree text,
  distance numeric,
  kcal_activite integer,
  kcal_totales integer not null,
  kcal_heure integer,
  fc_moyenne integer,
  fc_max integer,
  zone_cardiaque text,
  rythme text,
  cadence integer,
  denivele integer,
  observation text,
  energie integer check (energie between 1 and 10),
  douleurs text,
  recup integer check (recup between 1 and 10),
  created_at timestamptz default now(),
  unique(date, sport)
);

-- TABLE NUTRITION
create table if not exists nutrition (
  id bigint generated always as identity primary key,
  date date not null,
  repas text not null,
  description text,
  kcal integer,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  qualite integer check (qualite between 1 and 10),
  note text,
  created_at timestamptz default now(),
  unique(date, repas)
);

-- TABLE SLEEP (Sommeil)
create table if not exists sleep (
  id bigint generated always as identity primary key,
  date date not null unique,
  heure_coucher text,
  heure_lever text,
  duree_heures numeric,
  qualite integer check (qualite between 1 and 10),
  sport_veille text,
  kcal_veille integer,
  reveils integer default 0,
  fatigue_matin integer check (fatigue_matin between 1 and 10),
  note text,
  impact text,
  created_at timestamptz default now()
);

-- RLS (Row Level Security) — Désactiver si tu utilises uniquement l'anon key
alter table sessions enable row level security;
alter table nutrition enable row level security;
alter table sleep enable row level security;

-- Policies — Accès complet pour l'instant (usage personnel)
create policy "allow all sessions" on sessions for all using (true) with check (true);
create policy "allow all nutrition" on nutrition for all using (true) with check (true);
create policy "allow all sleep" on sleep for all using (true) with check (true);
