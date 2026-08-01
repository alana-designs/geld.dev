-- Tracks onboarding completion independently of category count, since a new
-- profile gets starter categories seeded before onboarding even runs.
alter table profiles add column onboarded boolean not null default false;
