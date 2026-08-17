-- ============================================================
-- Kids Karma – Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── PROFILES ────────────────────────────────────────────────
-- Stores all family members (parents and kids).
-- Kids don't need a Supabase Auth account — they use PIN only.
-- Parents log in via Supabase Auth (email/password).

create table profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id) on delete set null, -- null for kids
  name          text not null,
  role          text not null check (role in ('admin', 'co-admin', 'kid')),
  email         text,          -- parents only, used for Supabase Auth
  pin           text,          -- kids only, plain 4-digit (hash in production!)
  avatar_emoji  text default '😊',
  avatar_color  text default '#4f8ef7',
  coin_balance  integer not null default 0,
  total_earned  integer not null default 0,  -- lifetime total (never decreases)
  streak_count  integer not null default 0,
  last_streak_date date,
  created_at    timestamptz default now()
);

-- ─── TASKS ───────────────────────────────────────────────────
create table tasks (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  description              text,
  icon                     text not null default '⭐',
  assigned_to              uuid references profiles(id) on delete cascade,
  days_of_week             integer[] not null default '{1,2,3,4,5}',
  -- 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  start_time               time not null,
  deadline_time            time not null,  -- full coins if done by here
  expiry_time              time not null,  -- task marked missed after this
  full_coins               integer not null default 20,
  min_coins                integer not null default 5,   -- coins at expiry edge
  penalty_coins            integer not null default 10,  -- deducted if missed
  requires_approval_every  integer not null default 3,   -- every Nth completion → parent review
  is_active                boolean not null default true,
  created_by               uuid references profiles(id),
  created_at               timestamptz default now()
);

-- ─── TASK COMPLETIONS ────────────────────────────────────────
create table task_completions (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid references tasks(id) on delete cascade,
  kid_id           uuid references profiles(id) on delete cascade,
  scheduled_date   date not null,
  completed_at     timestamptz default now(),
  coins_earned     integer not null,
  status           text not null default 'auto_approved'
                   check (status in ('auto_approved','pending_approval','approved','rejected')),
  completion_count integer,   -- which completion number for this task/kid
  approved_by      uuid references profiles(id),
  approved_at      timestamptz,
  parent_note      text,
  kid_note         text,
  unique (task_id, kid_id, scheduled_date)  -- one completion per task per day
);

-- ─── COIN TRANSACTIONS ───────────────────────────────────────
create table coin_transactions (
  id               uuid primary key default gen_random_uuid(),
  kid_id           uuid references profiles(id) on delete cascade,
  amount           integer not null,  -- positive = earned, negative = spent/penalty
  reason           text not null,
  transaction_type text not null
                   check (transaction_type in ('task_reward','penalty','redemption','bonus','adjustment','refund')),
  reference_id     uuid,   -- task_completion_id or reward_redemption_id
  created_at       timestamptz default now()
);

-- ─── REWARDS ─────────────────────────────────────────────────
create table rewards (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  icon         text default '🎁',
  coin_cost    integer not null,
  reward_type  text default 'custom'
               check (reward_type in ('screen_time','money','custom')),
  reward_value numeric,    -- minutes of screen time, or dollar amount
  is_active    boolean default true,
  created_by   uuid references profiles(id),
  created_at   timestamptz default now()
);

-- ─── REWARD REDEMPTIONS ──────────────────────────────────────
create table reward_redemptions (
  id          uuid primary key default gen_random_uuid(),
  kid_id      uuid references profiles(id) on delete cascade,
  reward_id   uuid references rewards(id),
  coins_spent integer not null,
  status      text default 'pending'
              check (status in ('pending','approved','rejected')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at  timestamptz default now()
);

-- ─── MESSAGES ────────────────────────────────────────────────
create table messages (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid references profiles(id) on delete cascade,
  to_id      uuid references profiles(id) on delete cascade,  -- null = all kids
  content    text not null,
  is_read    boolean default false,
  created_at timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
-- Note: for the MVP, we disable RLS and rely on the app layer.
-- Enable and harden these policies before going to production.

alter table profiles          enable row level security;
alter table tasks             enable row level security;
alter table task_completions  enable row level security;
alter table coin_transactions enable row level security;
alter table rewards           enable row level security;
alter table reward_redemptions enable row level security;
alter table messages          enable row level security;

-- Permissive policy for MVP (tighten per-role later)
create policy "allow_all" on profiles          for all using (true) with check (true);
create policy "allow_all" on tasks             for all using (true) with check (true);
create policy "allow_all" on task_completions  for all using (true) with check (true);
create policy "allow_all" on coin_transactions for all using (true) with check (true);
create policy "allow_all" on rewards           for all using (true) with check (true);
create policy "allow_all" on reward_redemptions for all using (true) with check (true);
create policy "allow_all" on messages          for all using (true) with check (true);

-- ─── SEED DATA ───────────────────────────────────────────────
-- Replace UUIDs and emails with your actual values after running above.

-- 1. Create Supabase Auth users for Naman and Wife via Dashboard first,
--    then copy their auth.users UUIDs below.

-- Example seed (edit names/emails/colors/PINs as needed):
insert into profiles (name, role, email, avatar_emoji, avatar_color) values
  ('Naman',  'admin',    'namanbiga@gmail.com', '👨', '#f5c518'),
  ('Wife',   'co-admin', 'wife@email.com',       '👩', '#a855f7');

insert into profiles (name, role, pin, avatar_emoji, avatar_color) values
  ('Aaron',  'kid',  '1234', '🧒', '#4f8ef7'),
  ('Aria',   'kid',  '5678', '👧', '#ec4899');

-- Example rewards
insert into rewards (name, icon, coin_cost, description, reward_type, reward_value) values
  ('30 min screen time', '📱', 100, 'Extra 30 minutes on your device', 'screen_time', 30),
  ('1 hour screen time',  '🎮', 180, 'Extra hour on your device',       'screen_time', 60),
  ('Choose dinner',       '🍕', 300, 'You pick what we eat tonight!',   'custom',      null),
  ('$1 pocket money',     '💵', 100, 'Real dollar in your piggy bank',  'money',       1.00),
  ('Stay up 30 min late', '🌙', 250, 'Bedtime extended by 30 minutes',  'custom',      null);

-- Example tasks for Aaron (replace assigned_to with Aaron's profile id after insert)
-- Run: select id, name from profiles where name = 'Aaron'; to get the id
-- Then replace 'AARON_ID' below

-- insert into tasks (name, icon, assigned_to, days_of_week, start_time, deadline_time, expiry_time, full_coins, min_coins, penalty_coins) values
--   ('Wake up',          '⏰', 'AARON_ID', '{1,2,3,4,5}', '07:00', '07:10', '07:30', 15, 5,  10),
--   ('Brush teeth',      '🪥', 'AARON_ID', '{1,2,3,4,5}', '07:10', '07:20', '07:40', 10, 3,  5),
--   ('Get dressed',      '👕', 'AARON_ID', '{1,2,3,4,5}', '07:20', '07:35', '08:00', 10, 3,  5),
--   ('Eat breakfast',    '🥣', 'AARON_ID', '{1,2,3,4,5}', '07:30', '07:50', '08:10', 15, 5,  8),
--   ('Pack school bag',  '🎒', 'AARON_ID', '{1,2,3,4,5}', '07:45', '08:05', '08:15', 10, 3,  10),
--   ('Afternoon reading','📚', 'AARON_ID', '{1,2,3,4,5}', '15:30', '16:00', '17:00', 20, 8,  15),
--   ('Homework done',    '✏️',  'AARON_ID', '{1,2,3,4,5}', '15:30', '17:00', '18:00', 30, 10, 20),
--   ('Tidy room',        '🧹', 'AARON_ID', '{1,2,3,4,5,6}','17:00','17:30', '18:30', 15, 5,  10),
--   ('Shower',           '🚿', 'AARON_ID', '{1,2,3,4,5}', '18:00', '18:30', '19:00', 10, 3,  8),
--   ('In bed',           '🛏️', 'AARON_ID', '{1,2,3,4,5}', '20:30', '21:00', '21:30', 20, 5,  15);
