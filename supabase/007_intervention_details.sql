-- Informations complémentaires des interventions
-- À exécuter dans le même projet Supabase après les migrations 001 à 006.

alter table interventions
  add column if not exists postal_code text,
  add column if not exists notes text,
  add column if not exists details jsonb not null default '{}'::jsonb;

create index if not exists interventions_details_idx
  on interventions using gin (details);
