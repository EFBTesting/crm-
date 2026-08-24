/* ==========================================================================
   Project Tracking — won leads moving through post-sale production:
   Design -> Pre-Construction -> Construction -> Completed.

   Two views, switched with the same tab control the Dashboard uses:
   - List (default): a dense table, one row per project. Stays readable
     no matter how many projects pile up — nothing to scroll past, nothing
     that grows taller than its neighbors.
   - Board: the original drag-and-drop kanban, good for quickly moving a
     handful of projects between stages. Each column scrolls on its own
     past a certain height so a busy stage doesn't stretch the whole page.
   ========================================================================== */

let projectTrackingView = 'list';

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
          <div class="view-tabs" id="pt-view-tabs">
            <button class="view-tabs__btn ${projectTrackingView === 'list' ? 'is-active' : ''}" data-pt-view="list">List</button>
            <button class="view-tabs__btn ${projectTrackingView === 'board' ? 'is-active' : ''}" data-pt-view="board">Board</button>
          </div>
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
        ${projectTrackingView === 'board' ? boardHtml(projects, hasFilters) : listHtml(projects, hasFilters)}

        <div class="permit-summary-panel">
          <h3>Permits Across All Projects</h3>
          <p class="view-sub mb-md">In-progress only — completed projects drop off this live view (their permits are still on file, just click into the project to see them).</p>
          ${renderPermitSummary(permitBreakdown(allProjects.filter(l => (l.projectStage || PROJECT_STAGES[0].id) !== 'completed')))}
        </div>
      </div>
    `;

    wire();
  }

  /* --------------------------- List view --------------------------- */

  function listHtml(projects, hasFilters) {
    if (!projects.length) {
      return `<div class="table-wrap"><div class="empty-state">
        <p><strong>No projects match.</strong></p>
        <p class="muted">${hasFilters ? 'Try clearing your filters.' : 'Mark a lead Won on the Lead Pipeline to see it here.'}</p>
      </div></div>`;
    }
    const sorted = [...projects].sort((a, b) => {
      const stageA = PROJECT_STAGES.findIndex(s => s.id === (a.projectStage || PROJECT_STAGES[0].id));
      const stageB = PROJECT_STAGES.findIndex(s => s.id === (b.projectStage || PROJECT_STAGES[0].id));
      if (stageA !== stageB) return stageA - stageB;
      const da = preconProgress(a)?.daysToStart;
      const db = preconProgress(b)?.daysToStart;
      if (da !== undefined && da !== null && db !== undefined && db !== null) return da - db;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    return `
      <div class="table-wrap">
        <table class="data-table project-table">
          <thead>
            <tr><th>Project</th><th>Stage</th><th>Progress</th><th>Status</th><th>Start</th><th>Value</th><th></th></tr>
          </thead>
          <tbody>
            ${sorted.map(l => projectRowHtml(l)).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function projectRowHtml(l) {
    const contact = Contacts.get(l.contactId);
    const company = Companies.get(l.companyId);
    const who = contact ? fullName(contact) : (company ? company.name : 'Unassigned');
    const stage = l.projectStage || PROJECT_STAGES[0].id;
    const isCompleted = stage === 'completed';
    // Not stage-gated — the checklist doesn't disappear once a project
    // moves past Pre-Construction, so keep showing its progress here too.
    const precon = preconProgress(l);
    return `
      <tr class="row-link" data-nav="/leads/${l.id}">
        <td>
          <div class="cell-title">${esc(l.title)}</div>
          <div class="cell-sub">${esc(who)}</div>
        </td>
        <td>
          <select class="stage-select" data-stage-select="${l.id}">${PROJECT_STAGES.map(s => `<option value="${s.id}" ${s.id === stage ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
        </td>
        <td>
          ${precon ? `
            <div class="progress-cell">${progressBarHtml(precon.progressPercent)}<span class="precon-summary__stat">${Math.round((precon.progressPercent || 0) * 100)}%</span></div>
          ` : isCompleted ? `<span class="pill pill--muted">🏁 Done</span>` : `<span class="muted">—</span>`}
        </td>
        <td>${precon ? preconStatusPillHtml(precon) : (isCompleted ? '' : projectStatusPillHtml(l))}</td>
        <td>${precon && precon.daysToStart !== null ? (precon.daysToStart >= 0 ? `${precon.daysToStart}d` : `${Math.abs(precon.daysToStart)}d over`) : '—'}</td>
        <td class="cell-title">${fmtMoney(l.value)}</td>
        <td>${!isCompleted ? `<button type="button" class="chip-btn chip-btn--won" data-complete="${l.id}" title="Mark completed">✓</button>` : ''}</td>
      </tr>`;
  }

  /* --------------------------- Board view --------------------------- */

  function boardHtml(projects, hasFilters) {
    return `
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
      </div>`;
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
    const stage = l.projectStage || PROJECT_STAGES[0].id;
    const isCompleted = stage === 'completed';
    // Not stage-gated, same reasoning as the List view's row — a checklist
    // started in Pre-Construction is still worth showing after the project
    // has moved on to Construction (or was never moved out of Design).
    const precon = preconProgress(l);
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
        ${precon ? `
        <div class="lead-card__precon row-link" data-nav="/leads/${l.id}">
          <div class="lead-card__precon-row">
            ${preconStatusPillHtml(precon)}
            <span class="precon-summary__stat">${Math.round((precon.progressPercent || 0) * 100)}%</span>
          </div>
          ${progressBarHtml(precon.progressPercent)}
          <div class="lead-card__precon-step">${esc(precon.currentStep)}</div>
        </div>` : ''}
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

    qsa('[data-pt-view]', root).forEach(btn => btn.addEventListener('click', () => {
      projectTrackingView = btn.dataset.ptView;
      draw();
    }));

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

    // List view's stage dropdown — the table's equivalent of dragging a
    // kanban card to another column.
    qsa('[data-stage-select]', root).forEach(sel => {
      sel.addEventListener('click', e => e.stopPropagation());
      sel.addEventListener('change', async e => {
        e.stopPropagation();
        const id = sel.dataset.stageSelect;
        try {
          await Leads.moveProjectStage(id, e.target.value);
          toast(`Moved to "${projectStageLabel(e.target.value)}"`);
          draw();
        } catch (err) { toast(err.message || 'Could not move the project', 'warn'); }
      });
    });

    // Drag & drop (Board view only)
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
