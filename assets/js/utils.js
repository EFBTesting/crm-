/* ==========================================================================
   Small shared helpers: formatting, DOM shortcuts, escaping.
   ========================================================================== */

function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Same as fmtDate, but for a plain "YYYY-MM-DD" date-only value (no time
 *  zone attached) — e.g. projected_start_date. Parsing that string directly
 *  reads it as UTC midnight, which renders as the day before in any
 *  timezone behind UTC (all of the US); anchoring it to local midnight
 *  first avoids that off-by-one. */
function fmtDateOnly(dateStr) {
  if (!dateStr) return '—';
  return fmtDate(`${dateStr}T00:00:00`);
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeAgo(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function initials(firstName, lastName) {
  const a = (firstName || '').trim()[0] || '';
  const b = (lastName || '').trim()[0] || '';
  return (a + b).toUpperCase() || '?';
}

function fullName(contact) {
  if (!contact) return 'Unassigned';
  const n = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  return n || 'Unnamed Contact';
}

function qs(sel, root = document) {
  return root.querySelector(sel);
}
function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Capitalizes the first letter of the string and of every word after a
 *  space — never touches letters mid-word, so "McDonald" typed as-is stays
 *  "McDonald" rather than being forced to "Mcdonald". */
function capitalizeWords(str) {
  return str.replace(/(^|\s)([a-z])/g, (m, sep, letter) => sep + letter.toUpperCase());
}

/** Wires an input to auto-capitalize the first letter of each word as the
 *  person types, preserving cursor position (since the transform never
 *  changes the string's length, restoring the same offset is always safe). */
function bindAutoCapitalize(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    const transformed = capitalizeWords(input.value);
    if (transformed !== input.value) {
      input.value = transformed;
      input.setSelectionRange(pos, pos);
    }
  });
}

/** Renders a contact's live-computed status (see Contacts.statusFor) as a pill. */
function contactStatusPillHtml(contactId) {
  const info = Contacts.statusFor(contactId);
  if (info.kind === 'none') return `<span class="pill pill--muted">No projects yet</span>`;
  if (info.kind === 'open') return `<span class="pill pill--navy">Open${info.count > 1 ? ` (${info.count})` : ''}</span>`;
  if (info.outcome === 'won') return `<span class="pill pill--green">Previous Project · Won</span>`;
  return `<span class="pill pill--red">Previous Project · Lost</span>`;
}

/** Project health / permit badges — shown on Project Tracking cards, the
 *  lead detail page, and reused for their color coding in analytics. */
function projectStatusPillHtml(lead) {
  const status = lead?.projectStatus || 'on_track';
  return status === 'delayed' ? `<span class="pill pill--red">Delayed</span>` : `<span class="pill pill--green">On Track</span>`;
}
/** A project can have any number of permits now, so this summarizes the
 *  whole list into one badge: how many, and the least-done status among
 *  them (a single "not submitted" permit is worth flagging even if the
 *  other seven are approved). */
function permitSummaryPillHtml(lead) {
  const permits = lead?.permits || [];
  if (!permits.length) return `<span class="pill pill--muted">No permits</span>`;
  const notSubmitted = permits.filter(p => p.status === 'not_submitted' || !p.status).length;
  const submitted = permits.filter(p => p.status === 'submitted').length;
  const label = `${permits.length} permit${permits.length === 1 ? '' : 's'}`;
  if (notSubmitted) return `<span class="pill pill--muted">${label} · ${notSubmitted} not submitted</span>`;
  if (submitted) return `<span class="pill pill--stage">${label} · ${submitted} submitted</span>`;
  return `<span class="pill pill--green">${label} · all approved</span>`;
}

/** Pre-Construction status pill — colors mirror the old tracker's color
 *  coding (green = ready to break ground, amber = starting soon, red = past
 *  projected start / lost). `progress` comes from preconProgress(lead). */
function preconStatusPillHtml(progress) {
  if (!progress) return `<span class="pill pill--muted">Not started</span>`;
  return `<span class="pill pill--${progress.statusTone}">${esc(progress.statusLabel)}</span>`;
}
/** A thin horizontal progress bar. `fraction` is 0–1 (or null → empty track). */
function progressBarHtml(fraction, extraClass = '') {
  const pct = Math.round(Math.max(0, Math.min(1, fraction || 0)) * 100);
  return `<div class="progress-bar ${extraClass}"><div class="progress-bar__fill" style="width:${pct}%"></div></div>`;
}

/** Debounce a function by `ms` milliseconds. */
function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Simple toast notification. */
function toast(message, tone = 'default') {
  const host = qs('#toast-host');
  if (!host) return;
  const node = el(`<div class="toast toast--${tone}">${esc(message)}</div>`);
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 250);
  }, 2600);
}
