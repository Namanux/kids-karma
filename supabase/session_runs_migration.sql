-- ============================================================
-- Kids Karma – Session Runs Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── SESSION RUNS ────────────────────────────────────────────
-- Tracks every individual Start→Stop timer run for session tasks.
-- Multiple runs per task per day stack up to show total focus time.

create table if not exists session_runs (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid references tasks(id) on delete cascade,
  kid_id         uuid references profiles(id) on delete cascade,
  scheduled_date date not null,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  duration_secs  integer,     -- set when run ends (ended_at - started_at)
  created_at     timestamptz default now()
);

alter table session_runs enable row level security;
create policy "allow_all" on session_runs for all using (true) with check (true);

-- ─── task_type column on tasks (if not already present) ──────
-- 'session' = timed focus session (has start + end time)
-- 'task'    = quick checkbox task (start time only)
-- Existing rows default to 'task'

alter table tasks
  add column if not exists task_type text not null default 'task'
    check (task_type in ('task', 'session', 'focus'));  -- 'focus' kept for backward compat

-- ─── target_duration on tasks (if not already present) ───────
-- Stores the session duration in seconds (end_time - start_time).
-- Computed and stored when task is saved/imported.

alter table tasks
  add column if not exists target_duration integer;

-- Done! ✅
-- After running this, existing tasks stay as 'task' type (no change for kids).
-- New sessions will have task_type = 'session' and target_duration set.
