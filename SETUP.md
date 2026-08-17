# Kids Karma – Setup Guide

## What you're deploying
A PWA (installable web app) with:
- Dark gamified UI optimised for iPad
- Coin rewards with time-decay engine
- Parent approval queue
- Ambient/kiosk clock mode
- Real-time sync via Supabase

Both **Supabase** (database) and **Vercel** (hosting) have free tiers that are more than enough for a family app.

---

## Step 1 – Supabase (database + auth)

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in with GitHub
2. Click **New project** → name it `kids-karma` → set a database password → choose the closest region (Australia/Singapore)
3. Wait ~2 minutes for it to spin up
4. Go to **SQL Editor** → **New query** → paste the entire contents of `supabase/schema.sql` → click **Run**
5. Go to **Project Settings → API** and copy:
   - `Project URL` → this is your `VITE_SUPABASE_URL`
   - `anon public` key → this is your `VITE_SUPABASE_ANON_KEY`

### Create parent accounts
6. Go to **Authentication → Users → Add user** and create:
   - Naman: `namanbiga@gmail.com` + a password you choose
   - Wife: her email + a password
7. Note both user IDs (shown in the users table)
8. Go to **Table Editor → profiles** and update the `auth_user_id` column for Naman and Wife rows with those IDs

### Set kid PINs
9. In **Table Editor → profiles**, update the `pin` column for Aaron and Aria to whatever 4-digit PINs you want them to use

### Add tasks
10. In the SQL Editor, uncomment the task insert block at the bottom of `schema.sql`, replace `AARON_ID` with Aaron's profile UUID, run it, then repeat for Aria

---

## Step 2 – Local .env

```bash
cp .env.example .env
```

Edit `.env` and paste your Supabase URL and anon key.

---

## Step 3 – Run locally (optional test)

```bash
cd kids-karma
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Test login, task flow, parent dashboard.

---

## Step 4 – Deploy to Vercel (free)

1. Push the `kids-karma` folder to a GitHub repo (or just drag-drop the folder to Vercel)
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy** — Vercel gives you a URL like `https://kids-karma-xyz.vercel.app`

---

## Step 5 – Install on iPads

### Aaron's iPad
1. Open Safari → go to your Vercel URL
2. Tap the **Share** button → **Add to Home Screen** → name it "Kids Karma"
3. The app now launches fullscreen with no browser UI — it's a proper app icon

### Aria's iPad
Same steps.

### Your iPad / phone (parent dashboard)
Same steps — when you log in as Naman or Wife, you get the parent dashboard automatically.

### Kiosk / always-on mode (optional)
On each kid's iPad:
- **Settings → Accessibility → Guided Access** → turn on → open Kids Karma → triple-click the home button → start Guided Access
- This locks the iPad to the app — kids can't switch to YouTube etc.

---

## Coin economy

| 100 coins | = $1 equivalent |
|---|---|
| Screen time | 100 coins = 30 min |
| Pocket money | 100 coins = $1 |
| Choose dinner | 300 coins |
| Late night | 250 coins |

You can edit these in the **Rewards** tab of the parent dashboard at any time.

---

## Routine design tips

Each task needs 3 times:
- **Start time** – when it appears as "do it now" (alarm)
- **Deadline** – last moment for full coins (they see a timer counting down)
- **Expiry** – after this it's "Missed" and penalty applies

Typical morning for Aaron:
| Task | Start | Deadline | Expiry | Full 🪙 | Penalty |
|---|---|---|---|---|---|
| Wake up | 7:00 | 7:10 | 7:30 | 15 | 10 |
| Brush teeth | 7:10 | 7:20 | 7:40 | 10 | 5 |
| Get dressed | 7:20 | 7:35 | 8:00 | 10 | 5 |
| Eat breakfast | 7:30 | 7:50 | 8:10 | 15 | 8 |
| Pack bag | 7:45 | 8:05 | 8:15 | 10 | 10 |

Add these via the **Tasks** tab in the parent dashboard.

---

## What's coming (Phase 2)
- Photo evidence on task completion
- Streak bonuses (5-day morning routine = 50 bonus coins)
- Coin history chart for kids
- Weekly summary email to parents
- Push notifications / alarm sounds for task start
