/* ==========================================================================
   Project Calendar — a Gantt-style weekly timeline across every active
   lead (still in the Pipeline) and won project, mirroring the old Excel
   tracker's production schedule sheet. Each row gets a bar from its
   Target Start to Target Finish date, with a diamond marking the finish
   (or a lone diamond if only one of those two dates is set). Rows missing
   both are listed separately below instead of silently vanishing from
   the view. A lead not yet won shows "(LEAD)" next to its name; that
   drops off automatically once its design contract is signed and it
   becomes a project.
   ========================================================================== */

/** The sticky "info" columns before the weekly bars — mirrors the old
 *  tracker's Project / Assigned To / Estimator / Field Mgr / Designer
 *  columns, plus Project Type. Target Start/Finish and the four Team
 *  fields are editable right in their cells (dates as date pickers, Team
 *  as dropdowns) — same underlying fields as everywhere else, so a change
 *  here shows up on the Lead page and Project Tracking too. Widths are
 *  explicit so header and body cells line up — kept compact (total ~785px)
 *  so the timeline itself still has room on a typical laptop screen; a
 *  wider set here was pushing every actual calendar bar off-screen. */
const GANTT_INFO_COLS = [
  { key: 'title', label: 'Project', width: 150 },
  { key: 'projectType', label: 'Project Type', width: 95 },
  { key: 'projectedStartDate', label: 'Target Start', width: 85, isDate: true },
  { key: 'targetCompletionDate', label: 'Target Finish', width: 85, isDate: true },
  { key: 'assignedTo', label: 'Assigned To', width: 95, isStaff: true },
  { key: 'estimator', label: 'Estimator', width: 95, isStaff: true },
  { key: 'fieldManager', label: 'Field Mgr', width: 90, isStaff: true },
  { key: 'designer', label: 'Designer', width: 90, isStaff: true },
];
const GANTT_INFO_OFFSETS = (() => {
  let acc = 0;
  return GANTT_INFO_COLS.map(c => { const left = acc; acc += c.width; return left; });
})();

/** Fields the Team filter can narrow by — a project's own person fields.
 *  Picking just the field (no name) means "this field is filled in, don't
 *  care by whom"; picking a name on top of that narrows to that person. */
const CALENDAR_FILTER_FIELDS = [
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'estimator', label: 'Estimator' },
  { key: 'fieldManager', label: 'Field Mgr' },
  { key: 'designer', label: 'Designer' },
];

function renderProjectCalendar(root) {
  let activeFilters = {}; // { [fieldKey]: '' (any name) | 'Some, Name' }
  let pendingField = '';

  function applyFilters(projects) {
    const entries = Object.entries(activeFilters);
    if (!entries.length) return projects;
    return projects.filter(l => entries.every(([field, value]) => {
      const val = l[field];
      if (!val) return false;
      return value ? val === value : true;
    }));
  }

  function fieldValueOptions(field, projects) {
    if (!field) return [];
    const set = new Set();
    projects.forEach(l => { if (l[field]) set.add(l[field]); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  function fieldLabel(key) {
    return (CALENDAR_FILTER_FIELDS.find(f => f.key === key) || {}).label || key;
  }

  function draw() {
    // Won projects still in production, plus every active Pipeline lead —
    // a lead shows up here as soon as it has a Target Start/Finish date,
    // labeled "(LEAD)" until it's won (see ganttRowHtml/unscheduled list).
    const wonProjects = Leads.projects().filter(l => (l.preconStatus || 'active') === 'active');
    const rawPipelineLeads = Leads.active();
    // Any lead still missing an Assigned To (e.g. it existed before the
    // "default to Keith" behavior was added) defaults to Keith the moment
    // it shows up here — persisted in the background so it's consistent
    // everywhere (Team filter, sorting, Project Tracking), not just a
    // visual default on this page.
    rawPipelineLeads.filter(l => !l.assignedTo).forEach(l => {
      Leads.updatePreconMeta(l.id, { assignedTo: 'Hoeing, Keith' }).catch(() => {});
    });
    const pipelineLeads = rawPipelineLeads.map(l => l.assignedTo ? l : { ...l, assignedTo: 'Hoeing, Keith' });
    const allProjects = [...wonProjects, ...pipelineLeads];
    const projects = applyFilters(allProjects);
    const plottable = projects.filter(l => l.projectedStartDate || l.targetCompletionDate);
    const unscheduled = projects.filter(l => !l.projectedStartDate && !l.targetCompletionDate);
    const hasFilters = Object.keys(activeFilters).length > 0;

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Project Calendar</h1>
          <p class="view-sub">${plottable.length} project${plottable.length === 1 ? '' : 's'} on the timeline${unscheduled.length ? ` · ${unscheduled.length} not scheduled` : ''}</p>
        </div>
      </div>

      <div class="filter-bar">
        <select id="filter-field-select" class="filter-select">${optionList(CALENDAR_FILTER_FIELDS, pendingField, { valueKey: 'key', labelKey: 'label', blank: 'Filter by team...' })}</select>
        <select id="filter-value-select" class="filter-select" ${pendingField ? '' : 'disabled'}>${optionList(fieldValueOptions(pendingField, allProjects), '', { blank: 'Any name' })}</select>
        <button type="button" class="btn btn--ghost btn--sm" id="add-filter-btn" ${pendingField ? '' : 'disabled'}>Search filter</button>
        ${hasFilters ? `<button type="button" class="link-btn-inline" id="clear-filters-btn">Clear all</button>` : ''}
      </div>
      ${hasFilters ? `
        <div class="filter-chips mb-md">
          ${Object.entries(activeFilters).map(([field, value]) => `
            <span class="filter-chip">${esc(fieldLabel(field))}${value ? `: ${esc(value)}` : ''}
              <button type="button" class="filter-chip__remove" data-remove-filter="${esc(field)}" title="Remove filter">✕</button>
            </span>`).join('')}
        </div>` : ''}

      ${!plottable.length ? `
        <div class="empty-banner">
          ${hasFilters && !projects.length ? `
            <strong>No projects match these filters.</strong> Try removing one above.
          ` : `
            <strong>Nothing to plot yet.</strong> Add a Target Start or Target Finish date to a lead or project (from its own page, or right in this calendar's columns) and it'll show up here.
          `}
        </div>` : ganttHtml(plottable)}

      ${unscheduled.length ? `
        <div class="panel mt-lg">
          <h3>Not scheduled (${unscheduled.length})</h3>
          <ul class="side-panel-list">
            ${unscheduled.map(l => `
              <li class="row-link" data-nav="/leads/${l.id}">
                <div class="cell-title">${esc(l.title)}${l.status !== 'won' ? ' (LEAD)' : ''}</div>
                <div class="cell-sub">${fmtMoney(l.value)} — add a target start or finish date to plot it</div>
              </li>`).join('')}
          </ul>
        </div>` : ''}
    `;

    wire();
  }

  function ganttHtml(projects) {
    // A single mistyped year (e.g. "0027" instead of "2027") would blow the
    // range out to tens of thousands of weeks and hang the whole page — so
    // only plausible dates (within ~5 years back / 15 years out) count
    // toward the timeline's span. A row with an implausible date still
    // shows up (title, Target Start/Finish, Team), it just won't draw a
    // bar for that one date, making the bad value easy to spot and fix.
    const todayYear = new Date().getFullYear();
    const isPlausibleDate = d => d instanceof Date && !isNaN(d) && d.getFullYear() >= todayYear - 5 && d.getFullYear() <= todayYear + 15;

    const dates = [];
    projects.forEach(l => {
      if (l.projectedStartDate) { const d = dateOnlyToDate(l.projectedStartDate); if (isPlausibleDate(d)) dates.push(d); }
      if (l.targetCompletionDate) { const d = dateOnlyToDate(l.targetCompletionDate); if (isPlausibleDate(d)) dates.push(d); }
    });
    if (!dates.length) dates.push(new Date());
    // A couple weeks of breathing room on either side of the real range.
    const earliest = addDays(new Date(Math.min(...dates)), -14);
    const latest = addDays(new Date(Math.max(...dates)), 28);

    const rangeStart = startOfWeek(earliest);
    const rangeEnd = startOfWeek(latest);
    const weeks = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 7)) weeks.push(new Date(d));

    const yearGroups = groupConsecutive(weeks, w => w.getFullYear());
    const monthGroups = groupConsecutive(weeks, w => `${w.getFullYear()}-${w.getMonth()}`);

    // Ordered by Assigned To's last name, alphabetically — names are stored
    // "Last, First" so sorting the raw text already sorts by last name.
    // Unassigned projects fall to the bottom. Project Calendar only; every
    // other list (Project Tracking, Pipeline, etc.) keeps its own sort.
    const sorted = [...projects].sort((a, b) => {
      const aName = (a.assignedTo || '').trim();
      const bName = (b.assignedTo || '').trim();
      if (!aName && !bName) return 0;
      if (!aName) return 1;
      if (!bName) return -1;
      return aName.localeCompare(bName);
    });

    return `
      <div class="gantt-wrap">
        <table class="gantt-table">
          <thead>
            <tr class="gantt-row--year">
              ${GANTT_INFO_COLS.map((c, i) => `<th class="gantt-th-info${i === GANTT_INFO_COLS.length - 1 ? ' gantt-info--divider' : ''}" rowspan="3" style="left:${GANTT_INFO_OFFSETS[i]}px; min-width:${c.width}px; max-width:${c.width}px;">${esc(c.label)}</th>`).join('')}
              ${yearGroups.map(g => `<th colspan="${g.count}">${g.key}</th>`).join('')}
            </tr>
            <tr class="gantt-row--month">
              ${monthGroups.map(g => `<th colspan="${g.count}">${monthShortLabel(g.key)}</th>`).join('')}
            </tr>
            <tr class="gantt-row--week">
              ${weeks.map(w => `<th>${w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${sorted.map(l => ganttRowHtml(l, weeks)).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function ganttRowHtml(l, weeks) {
    const start = l.projectedStartDate ? dateOnlyToDate(l.projectedStartDate) : null;
    const end = l.targetCompletionDate ? dateOnlyToDate(l.targetCompletionDate) : null;
    const isLead = l.status !== 'won';
    const infoCells = GANTT_INFO_COLS.map((c, i) => {
      const dividerClass = i === GANTT_INFO_COLS.length - 1 ? ' gantt-info--divider' : '';
      const cellStyle = `style="left:${GANTT_INFO_OFFSETS[i]}px; min-width:${c.width}px; max-width:${c.width}px;"`;

      if (c.key === 'title') {
        const label = `${l.title}${isLead ? ' (LEAD)' : ''}`;
        return `<td data-nav="/leads/${l.id}" class="gantt-td-info gantt-td--name row-link" ${cellStyle} title="${esc(label)}">${esc(label)}</td>`;
      }
      if (c.isDate) {
        return `<td class="gantt-td-info${dividerClass}" ${cellStyle}>
          <input type="text" class="gantt-date-input js-datepicker" data-gantt-date="${c.key}" data-gantt-lead="${l.id}" value="${esc(l[c.key] || '')}" placeholder="—">
        </td>`;
      }
      if (c.isStaff) {
        return `<td class="gantt-td-info${dividerClass}" ${cellStyle}>
          <select class="gantt-staff-select" data-gantt-staff="${c.key}" data-gantt-lead="${l.id}">${optionList(STAFF_NAMES, l[c.key] || '', { blank: '—' })}</select>
        </td>`;
      }
      const val = l[c.key] || '—';
      return `<td class="gantt-td-info${dividerClass}" ${cellStyle} title="${esc(val)}">${esc(val)}</td>`;
    }).join('');
    return `
      <tr>
        ${infoCells}
        ${weeks.map(week => {
          const weekEnd = addDays(week, 6);
          let inBar = false, isMilestone = false;
          if (start && end) {
            inBar = week <= end && weekEnd >= start;
            isMilestone = end >= week && end <= weekEnd;
          } else if (start) {
            isMilestone = start >= week && start <= weekEnd;
          } else if (end) {
            isMilestone = end >= week && end <= weekEnd;
          }
          const label = `${l.title} — week of ${week.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          return `<td class="gantt-cell ${inBar ? 'is-bar' : ''} ${isMilestone ? 'is-milestone' : ''}" title="${esc(label)}"></td>`;
        }).join('')}
      </tr>`;
  }

  function wire() {
    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', e => { e.stopPropagation(); Router.navigate(node.dataset.nav); }));

    // Target Start / Target Finish, editable right in the cell — same
    // underlying field the Lead form sets and Project Tracking edits too.
    bindDatePickers(root, async (dateStr, input) => {
      const id = input.dataset.ganttLead;
      const field = input.dataset.ganttDate;
      try { await Leads.updatePreconMeta(id, { [field]: dateStr || null }); draw(); }
      catch (err) { toast(err.message || 'Could not update the date', 'warn'); }
    });
    // Team dropdowns — Assigned To / Estimator / Field Mgr / Designer.
    qsa('[data-gantt-staff]', root).forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.ganttLead;
        const field = sel.dataset.ganttStaff;
        try { await Leads.updatePreconMeta(id, { [field]: sel.value }); draw(); }
        catch (err) { toast(err.message || 'Could not update that field', 'warn'); }
      });
    });

    const fieldSelect = qs('#filter-field-select', root);
    if (fieldSelect) fieldSelect.addEventListener('change', e => { pendingField = e.target.value; draw(); });

    const addBtn = qs('#add-filter-btn', root);
    if (addBtn) addBtn.addEventListener('click', () => {
      if (!pendingField) return;
      const valueSelect = qs('#filter-value-select', root);
      activeFilters[pendingField] = valueSelect ? valueSelect.value : '';
      pendingField = '';
      draw();
    });

    const clearBtn = qs('#clear-filters-btn', root);
    if (clearBtn) clearBtn.addEventListener('click', () => { activeFilters = {}; pendingField = ''; draw(); });

    qsa('[data-remove-filter]', root).forEach(btn => btn.addEventListener('click', () => {
      delete activeFilters[btn.dataset.removeFilter];
      draw();
    }));
  }

  draw();
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}
/** Collapses a list into {key, count} runs of consecutive equal keys —
 *  used for the year/month header bands' colspans. */
function groupConsecutive(items, keyFn) {
  const groups = [];
  items.forEach(item => {
    const key = keyFn(item);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.count++;
    else groups.push({ key, count: 1 });
  });
  return groups;
}
function monthShortLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short' });
}
