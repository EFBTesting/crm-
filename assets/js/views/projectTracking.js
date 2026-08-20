/* ==========================================================================
   Project Tracking — kanban board for won leads as they move through
   post-sale production: Design -> Pre-Construction -> Construction ->
   Completed. Mirrors the Lead Pipeline board's drag-and-drop UX.
   ========================================================================== */

function renderProjectTracking(root) {
  let query = '';
  let filterProjectType = '';
  let filterStatus = '';

  function matchesFilters(l) {
    if (filterProjectType && l.projectType !== filterProjectType) return false;
    if (filterStatus && (l.projectStatus || 'on_track') !== filterStatus) return false;
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
    const allProjects = Leads.projects();
    const projects = allProjects.filter(matchesFilters);
    const totalValue = projects.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const hasFilters = query || filterProjectType || filterStatus;

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Project Tracking</h1>
          <p class="view-sub">${projects.length} project${projects.length === 1 ? '' : 's'}${hasFilters ? ` matching (of ${allProjects.length})` : ' in production'} · ${fmtMoney(totalValue)} total</p>
        </div>
        <div class="view-head__actions">
          <a class="btn btn--ghost" href="#/pipeline">View Lead Pipeline</a>
        </div>
      </div>

      ${!allProjects.length ? `
        <div class="empty-banner">
          <strong>No projects yet.</strong> Once a lead is marked <strong>Won</strong> on the Lead Pipeline, it shows up here automatically to track through production.
        </div>` : `
        <div class="filter-bar">
          <input type="search" id="project-search" class="search-input" placeholder="Search projects, contacts, companies..." value="${esc(query)}">
          <select id="filter-project-type" class="filter-select">${optionList(PROJECT_TYPES, filterProjectType, { blank: 'All project types' })}</select>
          <select id="filter-status" class="filter-select">${optionList(PROJECT_STATUS_OPTIONS, filterStatus, { valueKey: 'id', labelKey: 'label', blank: 'All statuses' })}</select>
          ${hasFilters ? `<button type="button" id="clear-filters-btn" class="link-btn-inline">Clear filters</button>` : ''}
        </div>`}

      <div class="project-tracking-layout">
        <div class="kanban kanban--4col" id="project-kanban">
          ${PROJECT_STAGES.map(stage => {
            const items = projects.filter(l => (l.projectStage || PROJECT_STAGES[0].id) === stage.id).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            const value = items.reduce((s, l) => s + (Number(l.value) || 0), 0);
            return `
            <div class="kanban-col" data-stage="${stage.id}">
              <div class="kanban-col__head">
                <div>
                  <h3>${esc(stage.label)}</h3>
                  <p class="kanban-col__desc">${esc(stage.description)}</p>
                </div>
                <span class="pill pill--navy">${items.length}</span>
              </div>
              <div class="kanban-col__value">${fmtMoney(value)}</div>
              <div class="kanban-col__body" data-dropzone="${stage.id}">
                ${items.map(l => projectCardHtml(l)).join('') || `<div class="kanban-empty">${hasFilters ? 'No matches.' : 'Drop projects here.'}</div>`}
              </div>
            </div>`;
          }).join('')}
        </div>

        <div class="permit-summary-panel">
          <h3>Permits Across All Projects</h3>
          <p class="view-sub mb-md">In-progress only — completed projects drop off this live view (their permits are still on file, just click into the project to see them).</p>
          ${renderPermitSummary(permitBreakdown(allProjects.filter(l => (l.projectStage || PROJECT_STAGES[0].id) !== 'completed')))}
        </div>
      </div>
    `;

    wire();
  }

  function renderPermitSummary(breakdown) {
    if (!breakdown.length) return `<p class="empty-inline">No permits logged yet. Add some from any project card's Permit badge.</p>`;
    return breakdown.map(section => `
      <div class="permit-summary-section">
        <div class="permit-summary-section__title">${esc(section.label)}</div>
        <div class="permit-summary-group">
          <span class="pill pill--stage">Submitted (${section.submitted.length})</span>
          ${section.submitted.length ? `<ul class="permit-summary-list">${section.submitted.map(p => `<li class="row-link" data-nav="/leads/${p.id}">${esc(p.title)}</li>`).join('')}</ul>` : ''}
        </div>
        <div class="permit-summary-group">
          <span class="pill pill--green">Approved (${section.approved.length})</span>
          ${section.approved.length ? `<ul class="permit-summary-list">${section.approved.map(p => `<li class="row-link" data-nav="/leads/${p.id}">${esc(p.title)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>`).join('');
  }

  function projectCardHtml(l) {
    const contact = Contacts.get(l.contactId);
    const company = Companies.get(l.companyId);
    const who = contact ? fullName(contact) : (company ? company.name : 'Unassigned');
    const isCompleted = (l.projectStage || PROJECT_STAGES[0].id) === 'completed';
    return `
      <div class="lead-card" draggable="true" data-lead-id="${l.id}">
        <div class="lead-card__top">
          <span class="lead-card__title row-link" data-nav="/leads/${l.id}">${esc(l.title)}</span>
        </div>
        <div class="lead-card__who">${esc(who)}</div>
        ${isCompleted ? `
        <div class="lead-card__badges">
          <span class="pill pill--muted">🏁 Completed — click to view</span>
        </div>` : `
        <div class="lead-card__badges">
          <button type="button" class="pill-btn" data-edit-meta="${l.id}" title="Edit status">${projectStatusPillHtml(l)}</button>
          <button type="button" class="pill-btn" data-edit-meta="${l.id}" title="Edit permits">${permitSummaryPillHtml(l)}</button>
        </div>`}
        <div class="lead-card__meta">
          <span class="lead-card__value">${fmtMoney(l.value)}</span>
          ${l.projectType ? `<span class="pill pill--muted">${esc(l.projectType)}</span>` : ''}
        </div>
        ${!isCompleted ? `
        <div class="lead-card__actions">
          <button class="chip-btn chip-btn--won" data-complete="${l.id}" title="Mark completed">✓ Completed</button>
        </div>` : ''}
      </div>`;
  }

  function wire() {
    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', e => { e.stopPropagation(); Router.navigate(node.dataset.nav); }));

    const searchInput = qs('#project-search', root);
    if (searchInput) {
      searchInput.addEventListener('input', debounce(e => {
        query = e.target.value;
        draw();
        const el = qs('#project-search', root);
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }, 200));
    }
    const typeFilter = qs('#filter-project-type', root);
    if (typeFilter) typeFilter.addEventListener('change', e => { filterProjectType = e.target.value; draw(); });
    const statusFilter = qs('#filter-status', root);
    if (statusFilter) statusFilter.addEventListener('change', e => { filterStatus = e.target.value; draw(); });
    const clearBtn = qs('#clear-filters-btn', root);
    if (clearBtn) clearBtn.addEventListener('click', () => { query = ''; filterProjectType = ''; filterStatus = ''; draw(); });

    qsa('[data-complete]', root).forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await Leads.moveProjectStage(btn.dataset.complete, 'completed');
        toast('🏁 Project marked completed');
        draw();
      } catch (err) { toast(err.message || 'Could not update the project', 'warn'); }
    }));

    qsa('[data-edit-meta]', root).forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      openProjectMetaForm(Leads.get(btn.dataset.editMeta), () => draw());
    }));

    // Drag & drop
    let draggedId = null;
    qsa('.lead-card', root).forEach(card => {
      card.addEventListener('dragstart', () => {
        draggedId = card.dataset.leadId;
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
    });
    qsa('[data-dropzone]', root).forEach(zone => {
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('is-dragover');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
      zone.addEventListener('drop', async e => {
        e.preventDefault();
        zone.classList.remove('is-dragover');
        if (!draggedId) return;
        const targetStage = zone.dataset.dropzone;
        const lead = Leads.get(draggedId);
        const movingId = draggedId;
        draggedId = null;
        if (!lead || (lead.projectStage || PROJECT_STAGES[0].id) === targetStage) return;
        try {
          await Leads.moveProjectStage(movingId, targetStage);
          toast(`Moved to “${projectStageLabel(targetStage)}”`);
          draw();
        } catch (err) {
          toast(err.message || 'Could not move the project', 'warn');
        }
      });
    });
  }

  draw();
}
