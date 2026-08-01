-- Expense Tracker initial schema
-- One household per user (v1), shared read visibility within a household,
-- write access restricted to the owning member. See src/docs/manual_budget_app_prd.md.

-- ---------------------------------------------------------------------------
-- Households & members
-- ---------------------------------------------------------------------------

create table households (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- One row per signed-up user, 1:1 with auth.users.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  email text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index profiles_household_id_idx on profiles (household_id);

-- A pending invite becomes a profile (in the inviter's household) once the
-- invitee signs up; see handle_new_user() below.
create table household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  invited_by uuid not null references profiles (id) on delete cascade,
  email text not null,
  name text,
  color text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (household_id, email)
);

-- Resolves the caller's household without recursing through profiles' own RLS.
create function my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from profiles where id = auth.uid()
$$;

-- New auth.users row -> join an inviter's household if one invited this
-- email, otherwise stand up a brand-new household of one.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite household_invites%rowtype;
  new_household_id uuid;
begin
  select * into invite
  from household_invites
  where email = new.email and status = 'pending'
  order by created_at asc
  limit 1;

  if found then
    update household_invites set status = 'accepted' where id = invite.id;
    insert into profiles (id, household_id, name, email, color)
    values (new.id, invite.household_id, coalesce(invite.name, split_part(new.email, '@', 1)), new.email, invite.color);
  else
    insert into households default values returning id into new_household_id;
    insert into profiles (id, household_id, name, email, color)
    values (new.id, new_household_id, split_part(new.email, '@', 1), new.email, '#38352f');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Categories & goals
-- ---------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  parent text not null check (parent in ('Needs', 'Wants', 'Savings')),
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index categories_household_id_idx on categories (household_id);
create index categories_user_id_idx on categories (user_id);

-- Historized goals: a row's amount is in effect from effective_month until
-- superseded by a later row, so editing a goal today doesn't rewrite past
-- goal-vs-actual charts. "Current" goal = latest row with effective_month <= today.
create table category_goals (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  amount numeric(10, 2) not null default 0,
  effective_month date not null,
  created_at timestamptz not null default now(),
  unique (category_id, effective_month)
);

create index category_goals_lookup_idx on category_goals (category_id, effective_month desc);

-- Goal in effect for a category during a given month (auto-rollover: carries
-- forward the most recent row at or before that month).
create function goal_for_month(p_category_id uuid, p_month date)
returns numeric
language sql
stable
as $$
  select amount
  from category_goals
  where category_id = p_category_id
    and effective_month <= date_trunc('month', p_month)::date
  order by effective_month desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  category_id uuid not null references categories (id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  description text not null check (char_length(trim(description)) > 0),
  date date not null,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx on transactions (user_id, date desc);
create index transactions_household_date_idx on transactions (household_id, date desc);
create index transactions_category_id_idx on transactions (category_id);

-- ---------------------------------------------------------------------------
-- Income (manual entry only for v1 — no paystub/OCR columns; add those back
-- in a later migration when that ships)
-- ---------------------------------------------------------------------------

create table income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  gross_pay numeric(10, 2) not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  net_override numeric(10, 2),
  updated_at timestamptz not null default now()
);

create index income_sources_household_id_idx on income_sources (household_id);

-- Pre-tax and post-tax deductions, distinguished by `phase`. A retirement-tagged
-- row may point at the Savings subcategory its auto-entry should land in.
create table income_deductions (
  id uuid primary key default gen_random_uuid(),
  income_source_id uuid not null references income_sources (id) on delete cascade,
  phase text not null check (phase in ('pre_tax', 'post_tax')),
  label text not null,
  amount numeric(10, 2) not null,
  tag text not null default 'other' check (tag in ('retirement', 'other')),
  category_id uuid references categories (id) on delete set null
);

create index income_deductions_source_id_idx on income_deductions (income_source_id);

create table income_tax_lines (
  id uuid primary key default gen_random_uuid(),
  income_source_id uuid not null references income_sources (id) on delete cascade,
  label text not null,
  amount numeric(10, 2) not null
);

create index income_tax_lines_source_id_idx on income_tax_lines (income_source_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: every member can read any household member's data
-- (shared visibility), but only ever write their own.
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table profiles enable row level security;
alter table household_invites enable row level security;
alter table categories enable row level security;
alter table category_goals enable row level security;
alter table transactions enable row level security;
alter table income_sources enable row level security;
alter table income_deductions enable row level security;
alter table income_tax_lines enable row level security;

create policy "read own household" on households
  for select using (id = my_household_id());

create policy "read household profiles" on profiles
  for select using (household_id = my_household_id());
create policy "update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "manage own household's invites" on household_invites
  for all using (household_id = my_household_id())
  with check (household_id = my_household_id());

create policy "read household categories" on categories
  for select using (household_id = my_household_id());
create policy "insert own categories" on categories
  for insert with check (user_id = auth.uid() and household_id = my_household_id());
create policy "update own categories" on categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own categories" on categories
  for delete using (user_id = auth.uid());

create policy "read household goals" on category_goals
  for select using (
    exists (select 1 from categories c where c.id = category_goals.category_id and c.household_id = my_household_id())
  );
create policy "write own goals" on category_goals
  for all using (
    exists (select 1 from categories c where c.id = category_goals.category_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from categories c where c.id = category_goals.category_id and c.user_id = auth.uid())
  );

create policy "read household transactions" on transactions
  for select using (household_id = my_household_id());
create policy "insert own transactions" on transactions
  for insert with check (user_id = auth.uid() and household_id = my_household_id());
create policy "update own transactions" on transactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own transactions" on transactions
  for delete using (user_id = auth.uid());

create policy "read household income" on income_sources
  for select using (household_id = my_household_id());
create policy "insert own income" on income_sources
  for insert with check (user_id = auth.uid() and household_id = my_household_id());
create policy "update own income" on income_sources
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own income" on income_sources
  for delete using (user_id = auth.uid());

create policy "read household income deductions" on income_deductions
  for select using (
    exists (select 1 from income_sources s where s.id = income_deductions.income_source_id and s.household_id = my_household_id())
  );
create policy "write own income deductions" on income_deductions
  for all using (
    exists (select 1 from income_sources s where s.id = income_deductions.income_source_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from income_sources s where s.id = income_deductions.income_source_id and s.user_id = auth.uid())
  );

create policy "read household tax lines" on income_tax_lines
  for select using (
    exists (select 1 from income_sources s where s.id = income_tax_lines.income_source_id and s.household_id = my_household_id())
  );
create policy "write own tax lines" on income_tax_lines
  for all using (
    exists (select 1 from income_sources s where s.id = income_tax_lines.income_source_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from income_sources s where s.id = income_tax_lines.income_source_id and s.user_id = auth.uid())
  );
