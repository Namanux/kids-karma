# Kids Karma — Project Brief

## Who I am working with
- **Naman** (namanbiga@gmail.com) — owner, admin, learning to become a developer
- Goal: build real products, understand every decision, grow into a pro developer over time

## How we work together
- I am Naman's **co-developer and mentor** — not just a code generator
- **Always edit files directly on Naman's machine** via the device bridge (device_stage_files → edit → device_commit_files). Never just send files for manual copy-paste.
- Before any code change: explain what I'm going to do, why, and what it affects
- Help Naman understand every tool, concept, and decision along the way
- Show the plan, get sign-off, then build
- Flag anything irreversible before doing it
- **Git push must be done manually by Naman** — the device bridge blocks git operations (lock file issue). Tell him the exact commands to run.

## The App — Kids Karma
A gamified daily routine and rewards app for the Bhatt family. Kids earn coins for completing tasks on time. Parents approve, allocate points, and manage rewards.

### Live URLs
- **App:** https://kids-karma.vercel.app
- **GitHub:** https://github.com/Namanux/kids-karma
- **Supabase project:** https://yslgspwragsntkawvewc.supabase.co

### Tech stack
- **Frontend:** React + Vite (no Tailwind config — custom CSS variables in src/index.css)
- **Database:** Supabase (PostgreSQL + Realtime)
- **Hosting:** Vercel (auto-deploys on every `git push` in ~60 seconds)
- **PWA:** installable on iPad via Safari → Add to Home Screen

### Project folder
`C:\Users\email\OneDrive\Desktop\Claude Project\HUB\kids-karma`

### Key files
```
src/
  index.css          — all CSS variables and global styles
  App.jsx            — routing (login → kid or parent dashboard)
  main.jsx           — entry point
  lib/
    supabase.js      — Supabase client
    points.js        — coin calculation engine
  contexts/
    AuthContext.jsx  — login state, profile management, refreshCurrentProfile
  pages/
    Login.jsx        — profile picker + PIN/password entry
    KidDashboard.jsx — kid view with tasks, coins, ambient clock
    ParentDashboard.jsx — parent view: overview, approve, tasks, rewards, message
public/
  favicon.svg        — app favicon (fixed — was pointing to missing coin.svg)
  icons/
    icon-192.png     — PWA icon (gold coin, dark bg, "K")
    icon-512.png     — PWA icon large
  manifest.json      — PWA manifest
supabase/
  schema.sql         — full database schema
.env                 — Supabase URL and anon key (not in GitHub)
```

## Family profiles
| Name | Role | Login | Avatar |
|---|---|---|---|
| Naman | admin | Password (Supabase Auth) | 👨 gold |
| Hetal | co-admin | Password (Supabase Auth) | 👩 purple |
| Aaron | kid | PIN (check Supabase profiles table) | 🧒 blue |
| Aarya | kid | PIN (check Supabase profiles table) | 👧 pink |

**Direct login URLs:**
- `https://kids-karma.vercel.app?user=Aaron`
- `https://kids-karma.vercel.app?user=Aarya`
- `https://kids-karma.vercel.app?user=Naman`
- `https://kids-karma.vercel.app?user=Hetal`

## Coin / scoring system
- **On time** (before deadline_time) → full_coins
- **Late** (after deadline_time, before or after expiry_time) → `Math.max(1, Math.floor(full_coins / 2))`
- **Honest miss** (kid taps 😔 Missed) → 1 coin for honesty
- Kids choose Done or Missed for late/missed tasks — two buttons shown
- Coin balance is clamped to 0 (never goes negative)
- Every Nth completion (default: every 3rd) → goes to parent approval queue
- Balance is always fetched fresh from DB before updating (no stale state)

## Levels
| Level | Coins needed |
|---|---|
| 🌱 Rookie | 0 |
| 🚀 Explorer | 200 |
| ⚔️ Warrior | 600 |
| 🏆 Champion | 1200 |
| 👑 Legend | 2500 |

## Task system
- Tasks have: name, icon (emoji), assigned_to (kid), days_of_week, start_time, deadline_time, expiry_time, full_coins, min_coins, penalty_coins, requires_approval_every, is_active
- Soft delete: `is_active = false` (never hard delete)
- Queries always filter `.neq('is_active', false)` to exclude soft-deleted tasks
- Tasks imported from Excel via xlsx npm package
- Clear All uses `.not('id', 'is', null)` to catch tasks with is_active = null or true

## What was built — Phase 1 & 2

### Phase 1 (foundation)
- Supabase schema: profiles, tasks, task_completions, coin_transactions, rewards, reward_redemptions, messages
- Login screen with profile picker, PIN numpad for kids, password for parents
- Kid Dashboard: task list, coin balance, level bar, progress bar, ambient clock mode
- Parent Dashboard tabs: Overview, Approve, Tasks, Rewards, Message
- Coin calculation engine with time-based scoring
- PWA manifest + app icons

### Phase 2 (completed this session)
1. ✅ **Emoji picker** — dropdown grid in TaskForm and RewardsTab
2. ✅ **Excel import/export** — bulk task management via .xlsx
3. ✅ **Direct login URLs** — `?user=Name` param auto-selects profile
4. ✅ **Ambient clock mode** — black screen, white clock, auto after 2 min idle
5. ✅ **App icons** — gold coin PNG icons for PWA/iPad home screen
6. ✅ **Favicon fixed** — was pointing to missing coin.svg, now uses favicon.svg
7. ✅ **Reward shop** — kids can browse and request rewards from parent dashboard
8. ✅ **Message tab** — parents send messages to one or all kids
9. ✅ **Done/Missed choice** — late tasks show two buttons: ✅ Done (half coins) or 😔 Missed (1 honesty coin)
10. ✅ **Scoring fixes** — no negative scores, fresh DB fetch before balance update, Math.max(0) clamp

## Known issues / pending for Phase 3
- No profile management tab in Parent Dashboard (PIN/avatar changes require Supabase dashboard)
- Aarya's 39 daily routine tasks may need re-importing (name was "Aria" in DB during initial import)
- Run this SQL if Aarya's balance is negative: `UPDATE profiles SET coin_balance = 0 WHERE coin_balance < 0;`
- No streak bonus system yet
- No coin history chart for kids
- No push notifications / alarm sounds
- No weekly summary email
- No photo evidence for task completion

## Phase 3 — planned features
- **Kids profile tab** in Parent Dashboard (manage PIN, name, avatar emoji, colour)
- **Streak bonuses** — full week completed = bonus coins
- **Coin history chart** — kids see earnings over time (line chart)
- **Push notifications** — iPad alarm when task becomes active
- **Weekly summary** — Sunday email/report with both kids' performance + hours per subject
- **Photo evidence** — camera on task completion, download option, auto-delete to save storage

## Supabase notes
- RLS is enabled with permissive "allow_all" policies (MVP mode — tighten later)
- Kids use PIN only (no Supabase Auth account)
- Parents need Supabase Auth accounts created manually: Dashboard → Authentication → Users
- To check/edit PINs: Table Editor → profiles table
