/* ==========================================================================
   Project Tracking — won leads moving through post-sale production:
   Design -> Pre-Construction -> Construction -> Completed.

   A dense table, one row per project. New wins drop in as a line in
   Design and move down via the Stage dropdown — stays readable no
   matter how many projects pile up, nothing to scroll past, nothing
   that grows taller than its neighbors.

   Record Status is what drives whether a project sits in the main table
   or one of its three side lists: Lost (fully marked lost, app-wide),
   On Hold (paused), or Completed (archived — also closes out its
   production Stage). Active is the only Record Status that stays here.
   ========================================================================== */

let projectTrackingView = 'list';

function renderProjectTracking(root) {
  let showLost = false;
  let showOnHold = false;
  let showCompleted = false;
  let query = '';
  let filterProjectType = '';
  let filterStatus = '';
  const today = new Date();
  let calYear = today.getFullYear();
  let calMonth = today.getMonth();

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
    const inProduction = allProjects.filter(l => (l.preconStatus || 'active') === 'active');
    const projects = inProduction.filter(matchesFilters);
    const totalValue = projects.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const hasFilters = query || filterProjectType || filterStatus;

    // A project that was won and later fell through — status flips to
    // 'lost' app-wide, but wonAt stays set, which is what separates it
    // from a never-won lead sitting in the Pipeline's own Lost list.
    const lostProjects = Leads.all().filter(l => l.status === 'lost' && l.wonAt).filter(matchesFilters);
    const onHoldProjects = allProjects.filter(l => l.preconStatus === 'on_hold').filter(matchesFilters);
    const completedProjects = allProjects.filter(l => l.preconStatus === 'complete').filter(matchesFilters);

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Project Tracking</h1>
          <p class="view-sub">${projects.length} project${projects.length === 1 ? '' : 's'}${hasFilters ? ` matching (of ${inProduction.length})` : ' in production'} · ${fmtMoney(totalValue)} total</p>
        </div>
        <div class="view-head__actions">
          <div class="view-tabs" id="pt-view-tabs">
            <button class="view-tabs__btn ${projectTrackingView === 'list' ? 'is-active' : ''}" data-pt-view="list">List</button>
            <button class="view-tabs__btn ${projectTrackingView === 'calendar' ? 'is-active' : ''}" data-pt-view="calendar">Calendar</button>
          </div>
          <button class="btn btn--ghost" id="toggle-lost-btn">${showLost ? 'Hide' : 'Show'} lost (${lostProjects.length})</button>
          <button class="btn btn--ghost" id="toggle-onhold-btn">${showOnHold ? 'Hide' : 'Show'} on hold (${onHoldProjects.length})</button>
          <button class="btn btn--ghost" id="toggle-completed-btn">${showCompleted ? 'Hide' : 'Show'} completed (${completedProjects.length})</button>
          <a class="btn btn--ghost" href="#/pipeline">View Lead Pipeline</a>
          <button class="btn btn--primary" id="new-project-btn">+ New Project</button>
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
        ${projectTrackingView === 'calendar' ? calendarHtml(projects) : listHtml(projects, hasFilters)}
      </div>

      ${showLost ? sideListHtml({
        title: `Lost projects (${lostProjects.length})`, items: lostProjects, emptyText: 'No lost projects. Nice.',
        statusCol: l => `<span class="pill pill--red">${esc(l.lostReason || 'Other')}</span>`,
        dateCol: l => timeAgo(l.lostAt), actionAttr: 'data-reopen', actionLabel: 'Reopen',
      }) : ''}
      ${showOnHold ? sideListHtml({
        title: `On hold projects (${onHoldProjects.length})`, items: onHoldProjects, emptyText: 'Nothing on hold.',
        statusCol: () => `<span class="pill pill--muted">On Hold</span>`,
        dateCol: l => timeAgo(l.updatedAt), actionAttr: 'data-reactivate', actionLabel: 'Reactivate',
      }) : ''}
      ${showCompleted ? sideListHtml({
        title: `Completed projects (${completedProjects.length})`, items: completedProjects, emptyText: 'Nothing completed yet.',
        statusCol: () => `<span class="pill pill--green">🏁 Complete</span>`,
        dateCol: l => timeAgo(l.updatedAt), actionAttr: 'data-reactivate', actionLabel: 'Reactivate',
      }) : ''}
    `;

    wire();
  }

  /** One of the three side lists (Lost / On Hold / Completed) — same
   *  mini-table shape, just different status pill / date / reopen action. */
  function sideListHtml({ title, items, emptyText, statusCol, dateCol, actionAttr, actionLabel }) {
    return `
      <div class="panel mt-lg">
        <h3>${title}</h3>
        ${items.length ? `
          <table class="mini-table">
            <thead><tr><th>Project</th><th>Status</th><th>Value</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              ${items.map(l => `
                <tr>
                  <td class="row-link" data-nav="/leads/${l.id}">${esc(l.title)}</td>
                  <td>${statusCol(l)}</td>
                  <td>${fmtMoney(l.value)}</td>
                  <td class="muted">${dateCol(l)}</td>
                  <td><button class="btn btn--ghost btn--sm" ${actionAttr}="${l.id}">${actionLabel}</button></td>
                </tr>`).join('')}
            </tbody>
          </table>` : `<p class="empty-inline">${esc(emptyText)}</p>`}
      </div>`;
  }

  /** Calendar view — one cell per day, projects plotted on their
   *  Projected Start date. Anything without one is listed separately
   *  below rather than silently dropped. */
  function calendarHtml(projects) {
    const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const byDay = new Map();
    const unscheduled = [];
    projects.forEach(l => {
      if (!l.projectedStartDate) { unscheduled.push(l); return; }
      if (!byDay.has(l.projectedStartDate)) byDay.set(l.projectedStartDate, []);
      byDay.get(l.projectedStartDate).push(l);
    });

    const startWeekday = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const todayKey = fmtDateKey(new Date());

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, key, isToday: key === todayKey, items: byDay.get(key) || [] });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return `
      <div class="calendar">
        <div class="calendar__head">
          <div class="calendar__title">${monthLabel}</div>
          <div class="calendar__nav">
            <button type="button" class="btn btn--ghost btn--sm" id="cal-prev">‹</button>
            <button type="button" class="btn btn--ghost btn--sm" id="cal-today">Today</button>
            <button type="button" class="btn btn--ghost btn--sm" id="cal-next">›</button>
          </div>
        </div>
        <div class="calendar__grid">
          ${dow.map(d => `<div class="calendar__dow">${d}</div>`).join('')}
          ${cells.map(cell => !cell ? `<div class="calendar__cell calendar__cell--outside"></div>` : `
            <div class="calendar__cell ${cell.isToday ? 'is-today' : ''}">
              <div class="calendar__date">${cell.day}</div>
              <div class="calendar__items">
                ${cell.items.map(l => {
                  const tone = PROJECT_STATUS_TONES[l.projectStatus || 'on_track'] || 'muted';
                  return `<div class="calendar__chip calendar__chip--${tone} row-link" data-nav="/leads/${l.id}" title="${esc(l.title)}">${esc(l.title)}</div>`;
                }).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>
      ${unscheduled.length ? `
        <div class="panel mt-lg">
          <h3>No projected start date (${unscheduled.length})</h3>
          <ul class="side-panel-list">
            ${unscheduled.map(l => `
              <li class="row-link" data-nav="/leads/${l.id}">
                <div class="cell-title">${esc(l.title)}</div>
                <div class="cell-sub">${fmtMoney(l.value)}</div>
              </li>`).join('')}
          </ul>
        </div>` : ''}`;
  }

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
            <tr>
              <th>Project</th><th>Stage</th><th>Progress</th><th>Record Status</th><th>Steps</th><th>Current Step</th>
              <th>Status</th><th>Projected Start</th><th>Days</th><th>Value</th>
            </tr>
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
        <td>
          <select class="stage-select" data-precon-status-select="${l.id}" data-original="${l.preconStatus || 'active'}">${optionList(PRECON_RECORD_STATUS_OPTIONS, l.preconStatus || 'active', { valueKey: 'id', labelKey: 'label', blank: null })}</select>
        </td>
        <td>${precon ? `<span class="cell-sub">${precon.completed}/${precon.stepsInScope}</span>` : '—'}</td>
        <td class="project-table__step" title="${precon ? esc(precon.currentStep) : ''}">${precon ? esc(precon.currentStep) : '—'}</td>
        <td>
          ${isCompleted ? '' : `<select class="stage-select" data-project-status-select="${l.id}">${optionList(PROJECT_STATUS_OPTIONS, l.projectStatus || 'on_track', { valueKey: 'id', labelKey: 'label', blank: null })}</select>`}
        </td>
        <td>${l.projectedStartDate ? fmtDateOnly(l.projectedStartDate) : '—'}</td>
        <td>${precon && precon.daysToStart !== null ? (precon.daysToStart >= 0 ? `${precon.daysToStart}d` : `${Math.abs(precon.daysToStart)}d over`) : '—'}</td>
        <td class="cell-title">${fmtMoney(l.value)}</td>
      </tr>`;
  }

  function wire() {
    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', e => { e.stopPropagation(); Router.navigate(node.dataset.nav); }));
    qs('#new-project-btn', root).addEventListener('click', () => openLeadForm(null, { asProject: true }, () => draw()));
    qs('#toggle-lost-btn', root).addEventListener('click', () => { showLost = !showLost; draw(); });
    qs('#toggle-onhold-btn', root).addEventListener('click', () => { showOnHold = !showOnHold; draw(); });
    qs('#toggle-completed-btn', root).addEventListener('click', () => { showCompleted = !showCompleted; draw(); });
    qsa('[data-pt-view]', root).forEach(btn => btn.addEventListener('click', () => { projectTrackingView = btn.dataset.ptView; draw(); }));

    const calPrev = qs('#cal-prev', root);
    if (calPrev) calPrev.addEventListener('click', () => {
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
      draw();
    });
    const calNext = qs('#cal-next', root);
    if (calNext) calNext.addEventListener('click', () => {
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
      draw();
    });
    const calToday = qs('#cal-today', root);
    if (calToday) calToday.addEventListener('click', () => {
      const now = new Date();
      calYear = now.getFullYear(); calMonth = now.getMonth();
      draw();
    });

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

    // Lost table's Reopen — full reopen(), restores status='won' too.
    qsa('[data-reopen]', root).forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await Leads.reopen(btn.dataset.reopen);
        toast('Project reopened');
        draw();
      } catch (err) { toast(err.message || 'Could not update the project', 'warn'); }
    }));
    // On Hold / Completed tables' Reactivate — the project was never
    // actually marked lost, so this just resets Record Status to Active.
    qsa('[data-reactivate]', root).forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await Leads.updatePreconMeta(btn.dataset.reactivate, { preconStatus: 'active' });
        toast('Back to active');
        draw();
      } catch (err) { toast(err.message || 'Could not update the project', 'warn'); }
    }));

    // Stage dropdown — production phase (Design/Pre-Con/Construction/
    // Completed). Independent of Record Status below.
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

    // Status dropdown — set by hand now (On Track / Delayed / Starting
    // Soon / Ready to Break Ground / Past Projected Start).
    qsa('[data-project-status-select]', root).forEach(sel => {
      sel.addEventListener('click', e => e.stopPropagation());
      sel.addEventListener('change', async e => {
        e.stopPropagation();
        const id = sel.dataset.projectStatusSelect;
        try {
          await Leads.updateProjectMeta(id, { projectStatus: e.target.value });
          toast(`Status set to "${projectStatusLabel(e.target.value)}"`);
          draw();
        } catch (err) { toast(err.message || 'Could not update the status', 'warn'); }
      });
    });

    // Record Status dropdown — the single control for where a project
    // lives: Active (main table), On Hold / Completed (their own lists,
    // reactivate to bring back), or Lost (asks why, marks it lost
    // app-wide). Lost reverts the select until the reason is confirmed,
    // same as the Lead Pipeline's Status dropdown.
    qsa('[data-precon-status-select]', root).forEach(sel => {
      sel.addEventListener('click', e => e.stopPropagation());
      sel.addEventListener('change', e => {
        e.stopPropagation();
        const id = sel.dataset.preconStatusSelect;
        const value = e.target.value;
        if (value === 'lost') {
          e.target.value = sel.dataset.original;
          openLostReasonPrompt(Leads.get(id), () => draw());
          return;
        }
        const action = value === 'complete'
          ? Leads.markProjectComplete(id).then(() => toast('🏁 Project marked complete'))
          : Leads.updatePreconMeta(id, { preconStatus: value }).then(() => toast(`Record status set to "${preconRecordStatusLabel(value)}"`));
        action.then(draw).catch(err => toast(err.message || 'Could not update the record status', 'warn'));
      });
    });
  }

  draw();
}
