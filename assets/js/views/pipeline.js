/* ==========================================================================
   Pipeline — a dense table across the lead stages, same layout style as
   Project Tracking. Moving a lead to the last stage (Design Contract
   Signed) automatically wins it — it disappears from here and shows up
   on Project Tracking instead, so there's nothing sitting in two places.
   ========================================================================== */

function renderPipeline(root) {
  let showLost = false;
  let query = '';
  let filterProjectType = '';
  let filterSource = '';

  function matchesFilters(l) {
    if (filterProjectType && l.projectType !== filterProjectType) return false;
    if (filterSource && l.source !== filterSource) return false;
    if (query) {
      const contact = Contacts.get(l.contactId);
      const secondary = Contacts.get(l.secondaryContactId);
      const company = Companies.get(l.companyId);
      const hay = `${l.title} ${contact ? fullName(contact) : ''} ${secondary ? fullName(secondary) : ''} ${company ? company.name : ''}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  }

  function draw() {
    const active = Leads.active().filter(matchesFilters);
    const lost = Leads.all().filter(l => l.status === 'lost').filter(matchesFilters);
    const won = Leads.projects().sort((a, b) => new Date(b.wonAt || b.updatedAt) - new Date(a.wonAt || a.updatedAt));
    const totalActiveValue = active.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const hasFilters = query || filterProjectType || filterSource;

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Lead Pipeline</h1>
          <p class="view-sub">${active.length} active lead${active.length === 1 ? '' : 's'} · ${fmtMoney(totalActiveValue)} in motion</p>
        </div>
        <div class="view-head__actions">
          <button class="btn btn--ghost" id="toggle-lost-btn">${showLost ? 'Hide' : 'Show'} lost leads (${lost.length})</button>
          <button class="btn btn--primary" id="new-lead-btn">+ New Lead</button>
        </div>
      </div>

      <div class="filter-bar">
        <input type="search" id="pipeline-search" class="search-input" placeholder="Search leads, contacts, companies..." value="${esc(query)}">
        <select id="filter-project-type" class="filter-select">${optionList(PROJECT_TYPES, filterProjectType, { blank: 'All project types' })}</select>
        <select id="filter-source" class="filter-select">${optionList(LEAD_SOURCES, filterSource, { blank: 'All sources' })}</select>
        ${hasFilters ? `<button type="button" id="clear-filters-btn" class="link-btn-inline">Clear filters</button>` : ''}
      </div>

      <div class="side-panel-layout">
        ${listHtml(active, hasFilters)}

        <div class="side-panel">
          <h3>Won Projects</h3>
          <p class="view-sub mb-md">Design contract signed — now tracked on Project Tracking.</p>
          ${won.length ? `
            <ul class="side-panel-list">
              ${won.map(l => `
                <li class="row-link" data-nav="/leads/${l.id}">
                  <div class="cell-title">${esc(l.title)}</div>
                  <div class="cell-sub">${fmtMoney(l.value)} · ${timeAgo(l.wonAt || l.updatedAt)}</div>
                </li>`).join('')}
            </ul>` : `<p class="empty-inline">None yet — win a lead and it'll show up here.</p>`}
        </div>
      </div>

      ${showLost ? `
        <div class="panel mt-lg">
          <h3>Lost leads (${lost.length})</h3>
          ${lost.length ? `
            <table class="mini-table">
              <thead><tr><th>Lead</th><th>Reason</th><th>Value</th><th>Lost</th><th></th></tr></thead>
              <tbody>
                ${lost.map(l => `
                  <tr>
                    <td class="row-link" data-nav="/leads/${l.id}">${esc(l.title)}</td>
                    <td><span class="pill pill--red">${esc(l.lostReason || 'Other')}</span></td>
                    <td>${fmtMoney(l.value)}</td>
                    <td class="muted">${timeAgo(l.lostAt)}</td>
                    <td><button class="btn btn--ghost btn--sm" data-reopen="${l.id}">Reopen</button></td>
                  </tr>`).join('')}
              </tbody>
            </table>` : `<p class="empty-inline">No lost leads. Nice.</p>`}
        </div>` : ''}
    `;

    wire();
  }

  function listHtml(active, hasFilters) {
    if (!active.length) {
      return `<div class="table-wrap"><div class="empty-state">
        <p><strong>No active leads.</strong></p>
        <p class="muted">${hasFilters ? 'Try clearing your filters.' : 'Use "+ New Lead" to add your first one.'}</p>
      </div></div>`;
    }
    const sorted = [...active].sort((a, b) => {
      const stageA = STAGES.findIndex(s => s.id === a.stage);
      const stageB = STAGES.findIndex(s => s.id === b.stage);
      if (stageA !== stageB) return stageA - stageB;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    return `
      <div class="table-wrap">
        <table class="data-table project-table">
          <thead>
            <tr><th>Lead</th><th>Stage</th><th>Value</th><th>Project Type</th><th>Source</th><th></th></tr>
          </thead>
          <tbody>
            ${sorted.map(l => leadRowHtml(l)).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function leadRowHtml(l) {
    const contact = Contacts.get(l.contactId);
    const company = Companies.get(l.companyId);
    const who = contact ? fullName(contact) : (company ? company.name : 'Unassigned');
    return `
      <tr class="row-link" data-nav="/leads/${l.id}">
        <td>
          <div class="cell-title">${esc(l.title)}</div>
          <div class="cell-sub">${esc(who)}</div>
        </td>
        <td>
          <select class="stage-select" data-stage-select="${l.id}">${STAGES.map(s => `<option value="${s.id}" ${s.id === l.stage ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
        </td>
        <td class="cell-title">${fmtMoney(l.value)}</td>
        <td>${l.projectType ? esc(l.projectType) : '<span class="muted">—</span>'}</td>
        <td>${l.source ? esc(l.source) : '<span class="muted">—</span>'}</td>
        <td><button type="button" class="chip-btn chip-btn--lost" data-lost="${l.id}" title="Mark lost">✕</button></td>
      </tr>`;
  }

  function wire() {
    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', e => { e.stopPropagation(); Router.navigate(node.dataset.nav); }));
    qs('#new-lead-btn', root).addEventListener('click', () => openLeadForm(null, {}, () => draw()));
    qs('#toggle-lost-btn', root).addEventListener('click', () => { showLost = !showLost; draw(); });

    const searchInput = qs('#pipeline-search', root);
    searchInput.addEventListener('input', debounce(e => {
      query = e.target.value;
      draw();
      const el = qs('#pipeline-search', root);
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 200));
    qs('#filter-project-type', root).addEventListener('change', e => { filterProjectType = e.target.value; draw(); });
    qs('#filter-source', root).addEventListener('change', e => { filterSource = e.target.value; draw(); });
    const clearBtn = qs('#clear-filters-btn', root);
    if (clearBtn) clearBtn.addEventListener('click', () => { query = ''; filterProjectType = ''; filterSource = ''; draw(); });

    // Stage dropdown — reaching the last stage (Design Contract Signed)
    // wins the lead automatically and it drops off this table.
    qsa('[data-stage-select]', root).forEach(sel => {
      sel.addEventListener('click', e => e.stopPropagation());
      sel.addEventListener('change', async e => {
        e.stopPropagation();
        const id = sel.dataset.stageSelect;
        const stageId = e.target.value;
        const isFinal = stageId === STAGES[STAGES.length - 1].id;
        try {
          await Leads.moveStage(id, stageId);
          toast(isFinal ? '🎉 Design contract signed — moved to Project Tracking' : `Moved to "${stageLabel(stageId)}"`);
          draw();
        } catch (err) { toast(err.message || 'Could not update the lead', 'warn'); }
      });
    });

    qsa('[data-lost]', root).forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      openLostReasonPrompt(Leads.get(btn.dataset.lost), () => draw());
    }));
    qsa('[data-reopen]', root).forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await Leads.reopen(btn.dataset.reopen);
        toast('Lead reopened');
        draw();
      } catch (err) { toast(err.message || 'Could not update the lead', 'warn'); }
    }));
  }

  draw();
}
