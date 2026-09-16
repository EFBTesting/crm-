# Erwin Forrest Builders — CRM

**Live app:** https://efbtesting.github.io/crm-/

A CRM built for Erwin Forrest Builders: contacts, company profiles, a 5-stage
lead pipeline, pre-construction/project tracking, and a high-level analytics
dashboard — plus two public-facing pages (a lead-capture form and a client
questionnaire) that write straight into the same database.

**No build step, real backend.** It's plain HTML/CSS/JS (no bundler, no
framework) with [Supabase](https://supabase.com) as the database, auth, and
realtime sync layer — so it's still trivial to host for free on GitHub Pages,
but data is shared live across everyone signed in, not per-browser.

## Features

- **Analytics dashboard** — pipeline value, win rate, avg. deal size, leads by
  stage, monthly trend, lead source mix, won/lost breakdown, recent activity,
  plus a Projects view once leads are won (in-production value, permits, etc).
- **Lead pipeline** — a drag-and-drop kanban across 5 stages, ending in
  **Won – Design Contract Signed**, which automatically converts a lead into a
  tracked project. Leads can be marked **Lost** from any stage (with a
  reason), and reopened later.
- **Project Tracking / Project Calendar** — a Pre-Construction checklist per
  won project, permit tracking, and a Gantt-style timeline of target
  start/finish dates.
- **Client Questionnaire** — a public, no-login page sent to leads by unique
  link; answers save into the CRM automatically (with client-side autosave so
  a closed tab doesn't cost them a redo), viewable and printable/exportable
  as a PDF from the lead's record.
- **Lead-capture form** (`lead-intake.html`) — a public "Get a Quote" page
  that writes straight into the Pipeline as a New Lead.
- **Mass Email** — compose one message and BCC it to any subset of Contacts.
- **Contacts / Companies** — searchable directories with full profile pages
  (info, notes, linked leads).

## Running locally

No install required — just open `index.html` in a browser, or serve it over
HTTP (recommended, avoids some browser quirks):

```bash
npx serve .
# or
python -m http.server 8080
```

You'll also need your own Supabase project — see **Backend setup** below.
Without it, the app shows a "Backend not connected yet" screen instead of the
login form.

## Backend setup

1. Create a free [Supabase](https://supabase.com) project.
2. Open the SQL Editor, paste in the entire contents of `supabase/schema.sql`,
   and run it. It's safe to re-run in full any time the schema changes —
   it only adds/updates what's actually different, never drops data.
3. Add your project's URL and anon (public) key to `assets/js/config.js`.
4. Create a user in Supabase Auth — that's the "shared team login" the app's
   sign-in screen expects (see `assets/js/auth.js`).

## Data & privacy

Contacts, companies, and leads live in Supabase, shared live across everyone
signed in (realtime sync — one person's edit shows up for everyone else
without a refresh). The two public pages (`questionnaire.html`,
`lead-intake.html`) write anonymously under tightly scoped Supabase Row Level
Security policies — an anonymous visitor can only ever insert their own
lead/response, never read or modify anything else in the database.

## Deploying a change

GitHub Pages serves straight from `main`, so a push is a deploy. One gotcha:
every script/stylesheet tag is loaded with a `?v=NNN` cache-busting query
string, since GitHub Pages doesn't support custom cache-control headers.
**Bump that number in `index.html`, `questionnaire.html`, and
`lead-intake.html` whenever you change a `.js`/`.css` file** — otherwise a
returning visitor's browser may keep serving the old cached copy.

## Tech

Vanilla HTML/CSS/JS, hash-based routing (works cleanly on static hosting),
[Supabase](https://supabase.com) (Postgres + Auth + Realtime) as the backend,
[Chart.js](https://www.chartjs.org/) via CDN for the analytics charts,
[flatpickr](https://flatpickr.js.org/) via CDN for date pickers.
