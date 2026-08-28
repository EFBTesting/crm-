/* ==========================================================================
   Contacts — list view.
   ========================================================================== */

const CONTACT_STATUS_FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'won', label: 'Previous Project · Won' },
  { id: 'lost', label: 'Previous Project · Lost' },
  { id: 'none', label: 'No projects yet' },
];

// Hoisted to module scope (like dashboard.js's dashboardActiveTab) so a
// realtime-triggered re-render (any teammate's edit, anywhere in the app —
// see Router.rerender()) doesn't silently wipe an in-progress search/filter.
let contactsQuery = '';
let contactsFilterStatus = '';

function renderContacts(root) {
  function matchesStatusFilter(c) {
    if (!contactsFilterStatus) return true;
    const info = Contacts.statusFor(c.id);
    if (contactsFilterStatus === 'open') return info.kind === 'open';
    if (contactsFilterStatus === 'none') return info.kind === 'none';
    return info.kind === 'previous' && info.outcome === contactsFilterStatus;
  }

  function draw() {
    const all = Contacts.all();
    const hasFilters = contactsQuery || contactsFilterStatus;
    const filtered = all
      .filter(matchesStatusFilter)
      .filter(c => {
        if (!contactsQuery) return true;
        const hay = `${fullName(c)} ${c.email} ${c.phone} ${c.title} ${Companies.get(c.companyId)?.name || ''}`.toLowerCase();
        return hay.includes(contactsQuery.toLowerCase());
      });

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Contacts</h1>
          <p class="view-sub">${all.length} total contact${all.length === 1 ? '' : 's'}</p>
        </div>
        <div class="view-head__actions">
          <input id="contact-search" class="search-input" type="search" placeholder="Search contacts..." value="${esc(contactsQuery)}">
          <button class="btn btn--primary" id="new-contact-btn">+ New Contact</button>
        </div>
      </div>

      <div class="filter-bar">
        <select id="filter-status" class="filter-select">${optionList(CONTACT_STATUS_FILTERS, contactsFilterStatus, { valueKey: 'id', labelKey: 'label', blank: 'All statuses' })}</select>
        ${hasFilters ? `<button type="button" id="clear-filters-btn" class="link-btn-inline">Clear filters</button>` : ''}
      </div>

      ${filtered.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Status</th><th>Added</th></tr>
            </thead>
            <tbody>
              ${filtered.map(c => {
                const company = Companies.get(c.companyId);
                return `
                <tr class="row-link" data-nav="/contacts/${c.id}">
                  <td>
                    <div class="cell-person">
                      <span class="avatar">${esc(initials(c.firstName, c.lastName))}</span>
                      <div>
                        <div class="cell-title">${esc(fullName(c))}</div>
                        <div class="cell-sub">${esc(c.title || '—')}</div>
                      </div>
                    </div>
                  </td>
                  <td>${company ? esc(company.name) : '<span class="muted">—</span>'}</td>
                  <td>${c.email ? `<a href="mailto:${esc(c.email)}" onclick="event.stopPropagation()">${esc(c.email)}</a>` : '<span class="muted">—</span>'}</td>
                  <td>${c.phone ? esc(c.phone) : '<span class="muted">—</span>'}</td>
                  <td>${contactStatusPillHtml(c.id)}</td>
                  <td class="muted">${fmtDate(c.createdAt)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : emptyState(hasFilters)}
    `;

    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', () => Router.navigate(node.dataset.nav)));
    qs('#new-contact-btn', root).addEventListener('click', () => openContactForm(null, () => draw()));
    const search = qs('#contact-search', root);
    search.addEventListener('input', debounce(e => {
      contactsQuery = e.target.value;
      draw();
      const el = qs('#contact-search', root);
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 200));
    qs('#filter-status', root).addEventListener('change', e => { contactsFilterStatus = e.target.value; draw(); });
    const clearBtn = qs('#clear-filters-btn', root);
    if (clearBtn) clearBtn.addEventListener('click', () => { contactsQuery = ''; contactsFilterStatus = ''; draw(); });
    // Attached here (inside draw(), on the just-rendered button) rather
    // than once on the persistent #app-root — see the removed outer
    // root.addEventListener at the bottom of this function's old version;
    // that pattern added a new permanent duplicate listener to #app-root
    // on every re-render (including every realtime-triggered rerender).
    const emptyBtn = qs('#empty-new-contact', root);
    if (emptyBtn) emptyBtn.addEventListener('click', () => openContactForm(null, () => draw()));
  }

  function emptyState(hasFilters) {
    if (hasFilters) return `<div class="empty-state"><p>No contacts match your search/filter.</p></div>`;
    return `
      <div class="empty-state">
        <p><strong>No contacts yet.</strong></p>
        <p class="muted">Add the people you talk to — homeowners, property managers, architects — and link them to leads and companies.</p>
        <button class="btn btn--primary" id="empty-new-contact">+ Add your first contact</button>
      </div>`;
  }

  draw();
}
