/* ==========================================================================
   Client Questionnaire — tracks sending/answering the Pre-Construction
   and Construction questionnaires per lead. (Internally these are still
   the 'quick'/'construction' type values — only the on-screen label
   changed from "Quick" to "Pre-Construction".) The actual public-facing form a lead fills out
   lives at questionnaire.html in the repo root (a separate, unauthenticated
   page — see its own comments); this view is the staff-facing tracker and
   response viewer.
   ========================================================================== */

// Hoisted to module scope (like dashboard.js's dashboardActiveTab) so a
// realtime-triggered re-render (any teammate's edit, anywhere in the app —
// see Router.rerender()) doesn't silently wipe an in-progress search/tab.
let questionnairesActiveTab = 'all'; // 'all' | 'not_sent' | 'waiting'
let questionnairesQuery = '';

function renderQuestionnaires(root) {
  function matchesQuery(l) {
    if (!questionnairesQuery) return true;
    const contact = Contacts.get(l.contactId);
    const secondary = Contacts.get(l.secondaryContactId);
    const company = Companies.get(l.companyId);
    const hay = `${l.title} ${contact ? fullName(contact) : ''} ${secondary ? fullName(secondary) : ''} ${company ? company.name : ''}`.toLowerCase();
    return hay.includes(questionnairesQuery.toLowerCase());
  }

  function draw() {
    const rows = Leads.all().filter(matchesQuery).map(l => ({ lead: l, progress: Questionnaires.progressFor(l.id) }));
    const notSent = rows.filter(x => x.progress.notSentTab);
    const waiting = rows.filter(x => x.progress.waitingTab);

    const TABS = [
      { id: 'all', label: 'All', count: rows.length },
      { id: 'not_sent', label: 'Not Sent', count: notSent.length },
      { id: 'waiting', label: 'Waiting on Response', count: waiting.length },
    ];
    const activeRows = questionnairesActiveTab === 'not_sent' ? notSent : questionnairesActiveTab === 'waiting' ? waiting : rows;
    const sorted = sortByProgress(activeRows);

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Client Questionnaire</h1>
          <p class="view-sub">${rows.length} lead${rows.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div class="filter-bar">
        <input type="search" id="q-search" class="search-input" placeholder="Search leads, contacts, companies..." value="${esc(questionnairesQuery)}">
      </div>

      <div class="view-tab-bar">
        ${TABS.map(t => `<button type="button" class="view-tab ${t.id === questionnairesActiveTab ? 'is-active' : ''}" data-tab="${t.id}">${t.label} (${t.count})</button>`).join('')}
      </div>

      ${listHtml(sorted)}
    `;

    wire();
  }

  // Anything not fully answered floats to the top; fully-answered leads
  // sink to the bottom. Newest activity (last send/answer, or the lead's
  // own last update if nothing's been sent yet) breaks ties within a group.
  function sortByProgress(rows) {
    return [...rows].sort((a, b) => {
      if (a.progress.fullyAnswered !== b.progress.fullyAnswered) return a.progress.fullyAnswered ? 1 : -1;
      const aTime = new Date((a.progress.status && a.progress.status.updatedAt) || a.lead.updatedAt);
      const bTime = new Date((b.progress.status && b.progress.status.updatedAt) || b.lead.updatedAt);
      return bTime - aTime;
    });
  }

  function listHtml(rows) {
    if (!rows.length) {
      return `<div class="table-wrap"><div class="empty-state">
        <p><strong>Nothing here.</strong></p>
        <p class="muted">${questionnairesQuery ? 'Try a different search.' : 'No leads match this filter.'}</p>
      </div></div>`;
    }
    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Lead</th><th>Pre-Construction</th><th>Construction</th></tr></thead>
          <tbody>${rows.map(x => rowHtml(x.lead, x.progress)).join('')}</tbody>
        </table>
      </div>`;
  }

  function indicatorHtml(answered, label) {
    return `<span class="q-indicator ${answered ? 'is-answered' : ''}" title="${esc(label)}${answered ? ' answered' : ' — not answered yet'}"></span>`;
  }

  function rowHtml(l, progress) {
    const contact = Contacts.get(l.contactId);
    const company = Companies.get(l.companyId);
    const who = contact ? fullName(contact) : (company ? company.name : 'Unassigned');
    const canOpen = progress.quickAnswered || progress.detailedAnswered;
    return `
      <tr>
        <td>
          <div class="q-name-cell">
            <span class="cell-title${canOpen ? ' row-link' : ''}" ${canOpen ? `data-open-responses="${l.id}"` : ''}>${esc(l.title)}</span>
            ${indicatorHtml(progress.quickAnswered, 'Pre-Construction')}
            ${indicatorHtml(progress.detailedAnswered, 'Construction')}
          </div>
          <div class="cell-sub">${esc(who)}</div>
        </td>
        <td>${buttonHtml(l, 'quick', progress)}</td>
        <td>${buttonHtml(l, 'construction', progress)}</td>
      </tr>`;
  }

  function buttonHtml(l, type, progress) {
    const sentAt = type === 'quick' ? progress.status?.quickSentAt : progress.status?.detailedSentAt;
    const answeredAt = type === 'quick' ? progress.status?.quickAnsweredAt : progress.status?.detailedAnsweredAt;
    if (answeredAt) return `<button type="button" class="btn btn--answered btn--sm" disabled>Answered ${fmtDate(answeredAt)}</button>`;
    if (sentAt) return `<button type="button" class="btn btn--ghost btn--sm" disabled>Sent ${fmtDate(sentAt)}</button>`;
    return `<button type="button" class="btn btn--primary btn--sm" data-send="${l.id}" data-send-type="${type}">Send</button>`;
  }

  function wire() {
    const searchInput = qs('#q-search', root);
    if (searchInput) {
      searchInput.addEventListener('input', debounce(e => {
        questionnairesQuery = e.target.value;
        draw();
        const el = qs('#q-search', root);
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }, 200));
    }

    qsa('[data-tab]', root).forEach(btn => btn.addEventListener('click', () => { questionnairesActiveTab = btn.dataset.tab; draw(); }));
    qsa('[data-open-responses]', root).forEach(el => el.addEventListener('click', () => openQuestionnaireResponses(Leads.get(el.dataset.openResponses))));
    qsa('[data-send]', root).forEach(btn => btn.addEventListener('click', () => sendQuestionnaire(btn.dataset.send, btn.dataset.sendType)));
  }

  function questionnaireLink(leadId, type) {
    const dir = window.location.pathname.replace(/[^/]*$/, ''); // strip the filename, keep the trailing slash
    return `${window.location.origin}${dir}questionnaire.html?lead=${leadId}&type=${type}`;
  }

  async function sendQuestionnaire(leadId, type) {
    const l = Leads.get(leadId);
    if (!l) return;
    const contact = Contacts.get(l.contactId);
    if (!contact || !contact.email) {
      toast('This lead has no email on file — add one on their Contact first.', 'warn');
      return;
    }
    const typeLabel = type === 'quick' ? 'Pre-Construction' : 'Construction';
    const link = questionnaireLink(leadId, type);
    const subject = encodeURIComponent(`${typeLabel} Questionnaire — Erwin Forrest Builders`);
    // Pre-Con and Construction currently have separate wording by design —
    // Pre-Con's was finalized 2026-08-31; Construction's still uses the
    // original generic wording until its own gets written.
    const body = encodeURIComponent(type === 'quick'
      ? `Hi ${contact.firstName},\n\nAs we prepare for your upcoming project journey, we'd appreciate it if you could take a few moments to complete the questionnaire below. Your responses will help us get to know you better and ensure we're fully prepared for our upcoming meetings together.\n\nWe're excited to partner with you and look forward to sharing this experience with you!\n\nQuestionnaire Link:\n${link}\n\nBest,\nErwin Forrest Builders`
      : `Hi ${contact.firstName},\n\nCould you take a few minutes to fill out this short questionnaire? It helps us prep for your project.\n\n${link}\n\nThanks!\nErwin Forrest Builders`);

    try {
      await Questionnaires.markSent(leadId, type);
      toast(`${typeLabel} questionnaire marked sent`);
      window.location.href = `mailto:${encodeURIComponent(contact.email)}?subject=${subject}&body=${body}`;
      draw();
    } catch (err) {
      toast(err.message || 'Could not mark this as sent', 'warn');
    }
  }

  draw();
}
