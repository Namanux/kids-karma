-- ============================================================
-- Kids Karma – Phase 3 Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── TASKS: photo evidence + kid-created tasks ────────────────
alter table tasks
  add column if not exists requires_photo boolean not null default false;
alter table tasks
  add column if not exists created_by_kid boolean not null default false;
alter table tasks
  add column if not exists pending_parent_review boolean not null default false;

-- ─── TASK COMPLETIONS: photo evidence ──────────────────────────
alter table task_completions
  add column if not exists photo_path text;  -- single "done" photo for task evidence

-- ─── INITIATIVES ────────────────────────────────────────────────
-- Kid-logged self-started activities: before/after photo + note,
-- reviewed by a parent who decides on a coin award.

create table if not exists initiatives (
  id                uuid primary key default gen_random_uuid(),
  kid_id            uuid references profiles(id) on delete cascade,
  note              text,
  before_photo_path text,
  after_photo_path  text,
  status            text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  coins_awarded     integer,
  decided_by        uuid references profiles(id),
  decided_at        timestamptz,
  created_at        timestamptz default now()
);

alter table initiatives enable row level security;
create policy "allow_all" on initiatives for all using (true) with check (true);

-- ─── STORAGE: task-photos bucket ───────────────────────────────
-- Private bucket (not public) — same "allow_all" MVP posture as the
-- rest of the app's RLS policies. If this insert fails due to plan
-- restrictions, create the bucket manually instead:
--   Dashboard → Storage → New bucket → name "task-photos" → Public: OFF
insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', false)
on conflict (id) do nothing;

-- Permissive policies on objects within this bucket only (MVP mode,
-- matches every other table's "allow_all" policy in this project).
create policy "allow_all_task_photos_select" on storage.objects
  for select using (bucket_id = 'task-photos');
create policy "allow_all_task_photos_insert" on storage.objects
  for insert with check (bucket_id = 'task-photos');
create policy "allow_all_task_photos_update" on storage.objects
  for update using (bucket_id = 'task-photos');
create policy "allow_all_task_photos_delete" on storage.objects
  for delete using (bucket_id = 'task-photos');

-- Done! ✅
-- After running this:
--   - Tasks can be marked "requires_photo" in the Task tab
--   - Kids can create their own tasks (pending_parent_review = true, is_active = false)
--   - The "initiatives" table is ready for the camera button feature
--   - The "task-photos" storage bucket exists for photo uploads
