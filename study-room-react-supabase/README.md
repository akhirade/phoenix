# Study Room Manager (React + Supabase)

Shared, secure web app for managing a 45-seat study room:

- Admin login (Supabase Auth)
- Students (add/edit/inactive + seat allocation)
- Seats layout (available/occupied/payment pending)
- Payments (month-wise tracking)
- Reports + Settings

## 1) Supabase Setup

1. Create a Supabase project
2. In Supabase SQL Editor, run:
   - `supabase/schema.sql`
   - `supabase/rls.sql`
3. In Supabase Auth settings:
   - Disable public signups (invite only for your 2–3 users)
   - Create/invite accounts

## 2) Local Dev

1. Create `.env` from `.env.example`
2. Fill:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Install + run:

```bash
npm install
npm run dev
```

## 3) GitHub Pages Deploy (optional)

This repo includes a GitHub Actions workflow that deploys to GitHub Pages on every push to `main`.

1. Create a GitHub repo and push this project to the `main` branch.
2. In GitHub repo settings:
   - **Settings → Pages → Build and deployment → Source**: select **GitHub Actions**
3. Add repository secrets:
   - **Settings → Secrets and variables → Actions → New repository secret**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

The workflow sets `VITE_BASE` automatically to `/<repo-name>/`.

Supabase Auth:

- In **Supabase Dashboard → Authentication → URL Configuration** add your GitHub Pages URL:
  - Site URL: `https://<github-username>.github.io/<repo-name>/`
  - Redirect URLs: include the same URL
