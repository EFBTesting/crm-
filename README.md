# Erwin Forrest Builders — CRM

**Live app:** https://efbtesting.github.io/erwin-forest-crm/

A lightweight CRM built for Erwin Forrest Builders: contacts, company profiles,
a 5-stage lead pipeline, and a high-level analytics dashboard.

**No build step, no backend.** It's plain HTML/CSS/JS and runs entirely in the
browser, with data persisted to `localStorage`. That makes it trivial to host
for free on GitHub Pages — just open `index.html`, or visit the deployed link.

## Features

- **Analytics dashboard** — pipeline value, win rate, avg. deal size, leads by
  stage, monthly trend, lead source mix, won/lost breakdown, recent activity.
- **Lead pipeline** — a drag-and-drop kanban across 5 stages:
  1. New Lead
  2. Site Visit Scheduled
  3. Estimate Sent
  4. Negotiation
  5. Won – Contract Signed

  Leads can be marked **Lost** from any stage (with a reason), and reopened later.
- **Contacts** — searchable directory with full profile pages (info, notes,
  linked leads).
- **Companies** — profiles for property managers, developers, architects,
  commercial clients, etc., with linked contacts and leads.

## Running locally

No install required — just open `index.html` in a browser. To serve it over
HTTP instead of `file://` (recommended, avoids some browser quirks):

```bash
npx serve .
# or
python -m http.server 8080
```

## Data & privacy

All contacts, companies, and leads are stored in your browser's `localStorage`
— nothing is sent to a server. This means data is **per-browser, per-device**
(clearing browser data will clear the CRM). It ships with **zero seed data** —
add your own contacts, companies, and leads from the UI.

If you outgrow this later and want shared, multi-user data with logins, the
natural next step is wiring this UI up to a real backend (e.g. Supabase or a
small API) instead of `localStorage` — the data layer lives entirely in
`assets/js/data.js`, so that's the one file that would need to change.

## Tech

Vanilla HTML/CSS/JS, hash-based routing (works cleanly on static hosting),
[Chart.js](https://www.chartjs.org/) via CDN for the analytics charts.
