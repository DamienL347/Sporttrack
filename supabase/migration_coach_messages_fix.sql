-- ============================================================
-- CORRECTIF — Cloisonnement par utilisateur des messages coach
-- La table coach_messages existait déjà (créée sans user_id ni
-- RLS par une ancienne migration) : le "create table if not
-- exists" de migration_coach_messages.sql n'a donc rien ajouté
-- et les messages étaient visibles par tous les comptes.
-- À exécuter dans Supabase → SQL Editor → Run. Idempotente.
-- ============================================================

-- 1) Colonnes manquantes
alter table coach_messages add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table coach_messages alter column user_id set default auth.uid();
alter table coach_messages add column if not exists image_data text;
alter table coach_messages add column if not exists image_media_type text;

-- 2) Messages existants : impossibles à attribuer à un compte.
--    Par défaut on les supprime (repart proprement, aucun risque de fuite).
--    Pour les récupérer sur TON compte à la place, décommente la ligne
--    ci-dessous avec ton email AVANT le delete (attention : les messages
--    des autres testeurs te seraient aussi attribués).
-- update coach_messages set user_id = (select id from auth.users where email = 'ton@email.com') where user_id is null;
delete from coach_messages where user_id is null;

-- 3) RLS : on supprime TOUTES les politiques existantes (quel que soit
--    leur nom, ex. "allow all"), puis on ne garde que le cloisonnement.
alter table coach_messages enable row level security;
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'coach_messages'
  loop
    execute format('drop policy if exists %I on coach_messages', pol.policyname);
  end loop;
end $$;
create policy "own coach_messages" on coach_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Index de lecture de l'historique
create index if not exists coach_messages_user_type_created on coach_messages(user_id, coach_type, created_at);
