/* ==========================================================================
   Companies — list view.
   ========================================================================== */

function renderCompanies(root) {
  let query = '';
  let filterType = '';

  function draw() {
    const all = Companies.all();
    const hasFilters = query || filterType;
    const filtered = all
      .filter(c => !filterType || c.type === filterType)
      .filter(c => !query || `${c.name} ${c.type} ${c.website} ${c.phone}`.toLowerCase().includes(query.toLowerCase()));

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Companies</h1>
          <p class="view-sub">${all.length} company profile${all.length === 1 ? '' : 's'}</p>
        </div>
        <div class="view-head__actions">
          <input id="company-search" class="search-input" type="search" placeholder="Search companies..." value="${esc(query)}">
          <button class="btn btn--primary" id="new-company-btn">+ New Company</button>
        </div>
      </div>

      <div class="filter-bar">
        <select id="filter-type" class="filter-select">${optionList(COMPANY_TYPES, filterType, { blank: 'All types' })}</select>
        ${hasFilters ? `<button type="button" id="clear-filters-btn" class="link-btn-inline">Clear filters</button>` : ''}
      </div>

      ${filtered.length ? `
        <div class="card-grid">
          ${filtered.map(co => {
            const contactsCount = Companies.contactsFor(co.id).length;
            const leads = Companies.leadsFor(co.id);
            const activeValue = leads.filter(l => l.status === 'active').reduce((s, l) => s + (Number(l.value) || 0), 0);
            return `
            <div class="entity-card row-link" data-nav="/companies/${co.id}">
              <div class="entity-card__top">
                <span class="avatar avatar--square">${esc((co.name || '?')[0].toUpperCase())}</span>
                <div>
                  <div class="cell-title">${esc(co.name)}</div>
                  <div class="cell-sub">${esc(co.type || 'Company')}</div>
                </div>
              </div>
              <div class="entity-card__stats">
                <div><span class="kpi-inline__num">${contactsCount}</span><span class="kpi-inline__label">Contacts</span></div>
                <div><span class="kpi-inline__num">${leads.length}</span><span class="kpi-inline__label">Leads</span></div>
                <div><span class="kpi-inline__num">${fmtMoney(activeValue)}</span><span class="kpi-inline__label">Active Value</span></div>
              </div>
            </div>`;
          }).join('')}
        </div>` : emptyState(hasFilters)}
    `;

    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', () => Router.navigate(node.dataset.nav)));
    qs('#new-company-btn', root).addEventListener('click', () => openCompanyForm(null, () => draw()));
    const search = qs('#company-search', root);
    search.addEventListener('input', debounce(e => {
      query = e.target.value;
      draw();
      const el = qs('#company-search', root);
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 200));
    qs('#filter-type', root).addEventListener('change', e => { filterType = e.target.value; draw(); });
    const clearBtn = qs('#clear-filters-btn', root);
    if (clearBtn) clearBtn.addEventListener('click', () => { query = ''; filterType = ''; draw(); });
  }

  function emptyState(hasFilters) {
    if (hasFilters) return `<div class="empty-state"><p>No companies match your search/filter.</p></div>`;
    return `
      <div class="empty-state">
        <p><strong>No company profiles yet.</strong></p>
        <p class="muted">Track property managers, developers, architects, and commercial clients here.</p>
        <button class="btn btn--primary" id="empty-new-company">+ Add your first company</button>
      </div>`;
  }

  draw();
  root.addEventListener('click', e => {
    if (e.target && e.target.id === 'empty-new-company') openCompanyForm(null, () => draw());
  });
}
