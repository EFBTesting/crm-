/* ==========================================================================
   Project Calendar — a Gantt-style weekly timeline across all active
   projects, mirroring the old Excel tracker's production schedule sheet.
   Each project gets a bar from its Projected Start to Target Completion
   date, with a diamond marking the finish (or a lone diamond if only one
   of those two dates is set). Projects missing both are listed
   separately below instead of silently vanishing from the view.
   ========================================================================== */

/** The sticky "info" columns before the weekly bars — mirrors the old
 *  tracker's Project / Assigned To / Estimator / Field Mgr / Designer
 *  columns. Widths are explicit so header and body cells line up. */
const GANTT_INFO_COLS = [
  { key: 'title', label: 'Project', width: 190 },
  { key: 'assignedTo', label: 'Assigned To', width: 110 },
  { key: 'estimator', label: 'Estimator', width: 100 },
  { key: 'fieldManager', label: 'Field Mgr', width: 100 },
  { key: 'designer', label: 'Designer', width: 100 },
];
const GANTT_INFO_OFFSETS = (() => {
  let acc = 0;
  return GANTT_INFO_COLS.map(c => { const left = acc; acc += c.width; return left; });
})();

function renderProjectCalendar(root) {
  function draw() {
    const projects = Leads.projects().filter(l => (l.preconStatus || 'active') === 'active');
    const plottable = projects.filter(l => l.projectedStartDate || l.targetCompletionDate);
    const unscheduled = projects.filter(l => !l.projectedStartDate && !l.targetCompletionDate);

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Project Calendar</h1>
          <p class="view-sub">${plottable.length} project${plottable.length === 1 ? '' : 's'} on the timeline${unscheduled.length ? ` · ${unscheduled.length} not scheduled` : ''}</p>
        </div>
      </div>

      ${!plottable.length ? `
        <div class="empty-banner">
          <strong>Nothing to plot yet.</strong> Add a Projected Start or Target Completion date to a project (from its Pre-Construction Details on the project page) and it'll show up here.
        </div>` : ganttHtml(plottable)}

      ${unscheduled.length ? `
        <div class="panel mt-lg">
          <h3>Not scheduled (${unscheduled.length})</h3>
          <ul class="side-panel-list">
            ${unscheduled.map(l => `
              <li class="row-link" data-nav="/leads/${l.id}">
                <div class="cell-title">${esc(l.title)}</div>
                <div class="cell-sub">${fmtMoney(l.value)} — add a start or completion date to plot it</div>
              </li>`).join('')}
          </ul>
        </div>` : ''}
    `;

    wire();
  }

  function ganttHtml(projects) {
    const dates = [];
    projects.forEach(l => {
      if (l.projectedStartDate) dates.push(dateOnlyToDate(l.projectedStartDate));
      if (l.targetCompletionDate) dates.push(dateOnlyToDate(l.targetCompletionDate));
    });
    // A couple weeks of breathing room on either side of the real range.
    const earliest = addDays(new Date(Math.min(...dates)), -14);
    const latest = addDays(new Date(Math.max(...dates)), 28);

    const rangeStart = startOfWeek(earliest);
    const rangeEnd = startOfWeek(latest);
    const weeks = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 7)) weeks.push(new Date(d));

    const todayWeekKey = fmtDateKey(startOfWeek(new Date()));
    const yearGroups = groupConsecutive(weeks, w => w.getFullYear());
    const monthGroups = groupConsecutive(weeks, w => `${w.getFullYear()}-${w.getMonth()}`);

    const farFuture = new Date(8640000000000000);
    const sorted = [...projects].sort((a, b) => {
      const aStart = a.projectedStartDate ? dateOnlyToDate(a.projectedStartDate) : (a.targetCompletionDate ? dateOnlyToDate(a.targetCompletionDate) : farFuture);
      const bStart = b.projectedStartDate ? dateOnlyToDate(b.projectedStartDate) : (b.targetCompletionDate ? dateOnlyToDate(b.targetCompletionDate) : farFuture);
      return aStart - bStart;
    });

    return `
      <div class="gantt-wrap">
        <table class="gantt-table">
          <thead>
            <tr class="gantt-row--year">
              <th class="gantt-th--name" colspan="${GANTT_INFO_COLS.length}"></th>
              ${yearGroups.map(g => `<th colspan="${g.count}">${g.key}</th>`).join('')}
            </tr>
            <tr class="gantt-row--month">
              <th class="gantt-th--name" colspan="${GANTT_INFO_COLS.length}"></th>
              ${monthGroups.map(g => `<th colspan="${g.count}">${monthShortLabel(g.key)}</th>`).join('')}
            </tr>
            <tr class="gantt-row--week">
              ${GANTT_INFO_COLS.map((c, i) => `<th class="gantt-th-info" style="left:${GANTT_INFO_OFFSETS[i]}px; min-width:${c.width}px; max-width:${c.width}px;">${esc(c.label)}</th>`).join('')}
              ${weeks.map(w => `<th>${w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${sorted.map(l => ganttRowHtml(l, weeks, todayWeekKey)).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function ganttRowHtml(l, weeks, todayWeekKey) {
    const start = l.projectedStartDate ? dateOnlyToDate(l.projectedStartDate) : null;
    const end = l.targetCompletionDate ? dateOnlyToDate(l.targetCompletionDate) : null;
    const infoCells = GANTT_INFO_COLS.map((c, i) => {
      const val = c.key === 'title' ? l.title : (l[c.key] || '—');
      const nameAttrs = c.key === 'title' ? ' data-nav="' + `/leads/${l.id}` + '" class="gantt-td-info gantt-td--name row-link"' : ' class="gantt-td-info"';
      return `<td${nameAttrs} style="left:${GANTT_INFO_OFFSETS[i]}px; min-width:${c.width}px; max-width:${c.width}px;" title="${esc(val)}">${esc(val)}</td>`;
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
          const isCurrent = fmtDateKey(week) === todayWeekKey;
          const label = `${l.title} — week of ${week.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          return `<td class="gantt-cell ${inBar ? 'is-bar' : ''} ${isMilestone ? 'is-milestone' : ''} ${isCurrent ? 'is-current-week' : ''}" title="${esc(label)}"></td>`;
        }).join('')}
      </tr>`;
  }

  function wire() {
    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', e => { e.stopPropagation(); Router.navigate(node.dataset.nav); }));
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
