# Remembering the Legacy

A culturally conscious memorial database and searchable web archive. Research and remembrance, openly accessible.
Author: Sydney Beane. Domain: Equity in Databases & Research.

## Features
- Fast client-side search (FlexSearch) with a fuzzy fallback for misspelled names
- Filters by state, decade and tag
- Profile dialogs with sources; written accounts are hidden until the visitor opts in
- Public submission form for new records, corrections and removal requests (moderated)
- PostgreSQL schema on Supabase with Row-Level Security: public read of published records, admin-only edits

## Stack
HTML5, CSS3 (Grid/Flexbox), vanilla ES6 JavaScript, FlexSearch 0.7.43 (CDN, no install), Supabase (PostgreSQL), GitHub Pages + GitHub Actions.
There are no npm dependencies to install.

## Run locally
```bash
git clone https://github.com/YOUR-USERNAME/remembering-the-legacy
cd remembering-the-legacy
python3 -m http.server 8000      # then open http://localhost:8000
```
With no database configured, the site runs on placeholder records in `data/sample.json`. These are not real people.

## Connect the database
1. Create a free project at supabase.com.
2. Paste `supabase/schema.sql` into the SQL editor and run it.
3. Insert records (status `published`) with at least one source each. Add moderators by setting `app_metadata` to `{"role":"admin"}` on their user.
4. Copy the Project URL and anon key into `config.js`. The anon key is safe to publish because of Row-Level Security.

## Deploy
Push to `main`. In the repo go to Settings > Pages > Source: GitHub Actions. `.github/workflows/deploy.yml` publishes the site.

## Structure
```
index.html  styles.css  app.js  config.js
data/sample.json            placeholder records
supabase/schema.sql         tables, indexes, RLS policies
.github/workflows/deploy.yml
```

## Data ethics
- Every published record requires a verifiable source.
- Written accounts are opt-in; surviving family members' personal details are not stored.
- Removal and correction requests go through the submission form.
- Multi-step review: submissions stay `pending` until an admin publishes them.

## Roadmap
Admin dashboard UI for moderation (Milestone M4), accessibility audit (M5).
