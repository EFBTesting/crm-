/* ==========================================================================
   Analytics dashboard — high-level view of the whole business.
   Two views sharing one page: Sales (the lead pipeline) and Projects
   (won leads moving through production), switched with a tab control.
   ========================================================================== */

let dashboardActiveTab = 'sales';

function computeSalesAnalytics() {
  const leads = Leads.all();
  const active = leads.filter(l => l.status === 'active');
  const won = leads.filter(l => l.status === 'won');
  const lost = leads.filter(l => l.status === 'lost');
  const closed = won.length + lost.length;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const wonThisMonth = won.filter(l => new Date(l.wonAt || l.updatedAt) >= startOfMonth);

  const pipelineValue = active.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
  const wonValue = won.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
  const avgDealSize = won.length ? wonValue / won.length : 0;
  const winRate = closed ? Math.round((won.length / closed) * 100) : null;

  const byStage = STAGES.map(s => ({
    stage: s,
    count: active.filter(l => l.stage === s.id).length,
    value: active.filter(l => l.stage === s.id).reduce((sum, l) => sum + (Number(l.value) || 0), 0),
  }));

  const bySource = {};
  leads.forEach(l => {
    const key = l.source || 'Unspecified';
    bySource[key] = (bySource[key] || 0) + 1;
  });

  // last 6 months, leads created per month
  const months = monthBuckets(now);
  leads.forEach(l => bumpMonthBucket(months, l.createdAt));

  const recentActivity = leads
    .flatMap(l => l.history.map(h => ({ ...h, leadId: l.id, leadTitle: l.title })))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);

  const topActiveLeads = [...active].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5);

  return {
    totals: {
      totalLeads: leads.length, activeLeads: active.length, won: won.length,
      wonThisMonth: wonThisMonth.length, lost: lost.length, pipelineValue, wonValue, avgDealSize, winRate,
    },
    byStage, bySource, months, recentActivity, topActiveLeads,
  };
}

function computeProjectAnalytics() {
  const projects = Leads.projects();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const byStage = PROJECT_STAGES.map(s => {
    const items = projects.filter(l => (l.projectStage || PROJECT_STAGES[0].id) === s.id);
    return { stage: s, count: items.length, value: items.reduce((sum, l) => sum + (Number(l.value) || 0), 0) };
  });

  const completed = projects.filter(l => (l.projectStage || PROJECT_STAGES[0].id) === 'completed');
  // "In Production" / "Total Projects" only count Record-Status-Active
  // projects — On Hold, Lost, and Complete each have their own place on
  // Project Tracking now and shouldn't inflate these totals. They come
  // back into these numbers automatically the moment they're reactivated.
  const activeProjects = projects.filter(l => (l.preconStatus || 'active') === 'active');
  const inProduction = activeProjects;
  const completedThisMonth = completed.filter(l => new Date(l.updatedAt) >= startOfMonth);

  const totalValue = projects.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
  const completedValue = completed.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
  const inProductionValue = inProduction.reduce((sum, l) => sum + (Number(l.value) || 0), 0);

  // last 6 months, projects completed per month (approximated by last-updated date)
  const months = monthBuckets(now);
  completed.forEach(l => bumpMonthBucket(months, l.updatedAt));

  const inProductionSorted = [...inProduction].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 8);

  // Status breakdowns only reflect projects still in progress — a
  // completed project drops off these the moment it's marked Completed,
  // and reappears automatically if it's ever moved back to another stage
  // (both computed fresh from current data, nothing to manually restore).
  const projectStatusCounts = PROJECT_STATUS_OPTIONS.map(opt => ({
    opt, count: activeProjects.filter(l => (l.projectStatus || 'on_track') === opt.id).length,
  }));
  // Record Status counts need the FULL project list, not just
  // activeProjects — otherwise On Hold/Lost/Complete would always read 0.
  const preconRecordCounts = PRECON_RECORD_STATUS_OPTIONS.map(opt => ({
    opt, count: projects.filter(l => (l.preconStatus || 'active') === opt.id).length,
  }));

  // How many active (non-completed) projects sit in each stage right now.
  const stageCounts = byStage.filter(b => b.stage.id !== 'completed');

  return {
    totals: {
      totalProjects: activeProjects.length, inProduction: inProduction.length, completed: completed.length,
      completedThisMonth: completedThisMonth.length, totalValue, completedValue, inProductionValue,
    },
    byStage, months, inProductionSorted, stageCounts, projectStatusCounts, preconRecordCounts,
  };
}

function monthBuckets(now) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }), count: 0 });
  }
  return months;
}
function bumpMonthBucket(months, iso) {
  const d = new Date(iso);
  const key = `${d.getFullYear()}-${d.getMonth()}`;
  const bucket = months.find(m => m.key === key);
  if (bucket) bucket.count += 1;
}

function renderDashboard(root) {
  root.innerHTML = `
    <div class="view-head">
      <div>
        <h1>Business Overview</h1>
        <p class="view-sub">Erwin Forrest Builders — everything happening across the CRM, at a glance.</p>
      </div>
      <div class="view-tabs" id="dashboard-tabs">
        <button class="view-tabs__btn ${dashboardActiveTab === 'sales' ? 'is-active' : ''}" data-tab="sales">Sales</button>
        <button class="view-tabs__btn ${dashboardActiveTab === 'projects' ? 'is-active' : ''}" data-tab="projects">Projects</button>
      </div>
    </div>
    <div id="dashboard-body"></div>
  `;

  qsa('[data-tab]', root).forEach(btn => btn.addEventListener('click', () => {
    dashboardActiveTab = btn.dataset.tab;
    renderDashboard(root);
  }));

  const body = qs('#dashboard-body', root);
  if (dashboardActiveTab === 'projects') {
    renderProjectsTab(body);
  } else {
    renderSalesTab(body);
  }
}

function renderSalesTab(root) {
  const a = computeSalesAnalytics();
  const t = a.totals;
  const hasAnyLeads = t.totalLeads > 0;

  root.innerHTML = `
    <div class="kpi-grid">
      ${kpiTile('Active Pipeline', fmtMoney(t.pipelineValue), `${t.activeLeads} open lead${t.activeLeads === 1 ? '' : 's'}`, 'navy')}
      ${kpiTile('Won (All Time)', fmtMoney(t.wonValue), `${t.won} contract${t.won === 1 ? '' : 's'} signed · ${t.wonThisMonth} this month`, 'green')}
      ${winRateTile(t)}
      ${kpiTile('Avg. Deal Size', t.won ? fmtMoney(t.avgDealSize) : '—', 'Across won contracts', 'slate')}
    </div>

    ${!hasAnyLeads ? `
      <div class="empty-banner">
        <strong>No leads yet.</strong> Add your first lead from the Pipeline tab and this dashboard will fill in automatically —
        stage breakdown, monthly trend, sources, and win rate all update live.
      </div>` : ''}

    <div class="chart-row">
      <div class="chart-box chart-box--wide">
        <h3>Active pipeline by stage</h3>
        <canvas id="chart-stage"></canvas>
      </div>
      <div class="chart-box">
        <h3>Lead source mix</h3>
        <canvas id="chart-source"></canvas>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-box chart-box--wide">
        <h3>New leads, last 6 months</h3>
        <canvas id="chart-trend"></canvas>
      </div>
      <div class="chart-box">
        <h3>Outcomes</h3>
        <canvas id="chart-outcome"></canvas>
      </div>
    </div>

    <div class="panel-row">
      <div class="panel">
        <h3>Top active leads by value</h3>
        ${a.topActiveLeads.length ? `
          <table class="mini-table">
            <thead><tr><th>Lead</th><th>Stage</th><th>Value</th></tr></thead>
            <tbody>
              ${a.topActiveLeads.map(l => `
                <tr class="row-link" data-nav="/leads/${l.id}">
                  <td>${esc(l.title)}</td>
                  <td><span class="pill pill--stage">${esc(stageLabel(l.stage))}</span></td>
                  <td>${fmtMoney(l.value)}</td>
                </tr>`).join('')}
            </tbody>
          </table>` : `<p class="empty-inline">No active leads yet.</p>`}
      </div>
      <div class="panel">
        <h3>Recent activity</h3>
        ${a.recentActivity.length ? `
          <ul class="activity-list">
            ${a.recentActivity.map(h => `
              <li class="row-link" data-nav="/leads/${h.leadId}">
                <span class="activity-dot activity-dot--${h.event}"></span>
                <div>
                  <div class="activity-line"><strong>${esc(h.leadTitle)}</strong> — ${esc(h.detail)}</div>
                  <div class="activity-time">${timeAgo(h.at)}</div>
                </div>
              </li>`).join('')}
          </ul>` : `<p class="empty-inline">Activity will show up here as leads move through the pipeline.</p>`}
      </div>
    </div>
  `;

  qsa('[data-nav]', root).forEach(node => node.addEventListener('click', () => Router.navigate(node.dataset.nav)));
  drawSalesCharts(a);
}

function renderProjectsTab(root) {
  const a = computeProjectAnalytics();
  const t = a.totals;
  const hasAnyProjects = t.totalProjects > 0;

  root.innerHTML = `
    <div class="kpi-grid">
      ${kpiTile('In Production', fmtMoney(t.inProductionValue), `${t.inProduction} project${t.inProduction === 1 ? '' : 's'} underway`, 'navy')}
      ${kpiTile('Completed (All Time)', fmtMoney(t.completedValue), `${t.completed} project${t.completed === 1 ? '' : 's'} · ${t.completedThisMonth} this month`, 'green')}
      ${kpiTile('Total Projects', String(t.totalProjects), '', 'amber')}
      ${kpiTile('Total Project Value', fmtMoney(t.totalValue), 'In production + completed', 'slate')}
    </div>

    ${!hasAnyProjects ? `
      <div class="empty-banner">
        <strong>No projects yet.</strong> Mark a lead <strong>Won</strong> on the Lead Pipeline and it'll show up here, tracked through Design → Pre-Construction → Construction → Completed.
      </div>` : ''}

    <h3 class="mb-sm">Projects by Stage</h3>
    <div class="kpi-grid kpi-grid--3col mb-md">
      ${a.stageCounts.map((b, i) => kpiTile(b.stage.label, String(b.count), `${fmtMoney(b.value)} in this stage`, ['slate', 'navy', 'amber'][i] || 'slate')).join('')}
    </div>

    <div class="chart-row">
      <div class="chart-box chart-box--wide">
        <h3>Projects by stage</h3>
        <canvas id="chart-project-stage"></canvas>
      </div>
      <div class="chart-box">
        <h3>Completions, last 6 months</h3>
        <canvas id="chart-project-trend"></canvas>
      </div>
    </div>

    <div class="panel-row">
      <div class="panel panel--wide">
        <h3>Projects in production</h3>
        ${a.inProductionSorted.length ? `
          <table class="mini-table">
            <thead><tr><th>Project</th><th>Stage</th><th>Value</th></tr></thead>
            <tbody>
              ${a.inProductionSorted.map(l => `
                <tr class="row-link" data-nav="/leads/${l.id}">
                  <td>${esc(l.title)}</td>
                  <td><span class="pill pill--stage">${esc(projectStageLabel(l.projectStage || PROJECT_STAGES[0].id))}</span></td>
                  <td>${fmtMoney(l.value)}</td>
                </tr>`).join('')}
            </tbody>
          </table>` : `<p class="empty-inline">Nothing in production right now.</p>`}
      </div>
      <div class="panel">
        <h3 class="panel-title--lg">Project Health</h3>
        <div class="kpi-inline-subtitle">Status</div>
        <div class="kpi-inline kpi-inline--wrap mb-md">
          ${a.projectStatusCounts.map(({ opt, count }) => `<div><span class="kpi-inline__num">${count}</span><span class="kpi-inline__label">${esc(opt.label)}</span></div>`).join('')}
        </div>
        <div class="panel-divider"></div>
        <div class="kpi-inline-subtitle">Record Status</div>
        <div class="kpi-inline kpi-inline--wrap mt-sm">
          ${a.preconRecordCounts.map(({ opt, count }) => `<div><span class="kpi-inline__num">${count}</span><span class="kpi-inline__label">${esc(opt.label)}</span></div>`).join('')}
        </div>
      </div>
    </div>
  `;

  qsa('[data-nav]', root).forEach(node => node.addEventListener('click', () => Router.navigate(node.dataset.nav)));
  drawProjectCharts(a);
}

function kpiTile(label, value, sub, tone) {
  return `
    <div class="kpi-tile kpi-tile--${tone}">
      <div class="kpi-tile__label">${esc(label)}</div>
      <div class="kpi-tile__value">${value}</div>
      <div class="kpi-tile__sub">${esc(sub)}</div>
    </div>`;
}

/** The Win Rate tile spells out the math behind the percentage — Total
 *  (closed jobs, won + lost, which is what the percentage is out of),
 *  Won, and Lost — instead of just a bare number that needs explaining. */
function winRateTile(t) {
  const closed = t.won + t.lost;
  return `
    <div class="kpi-tile kpi-tile--amber">
      <div class="kpi-tile__label">Win Rate</div>
      <div class="kpi-tile__value">${t.winRate === null ? '—' : `${t.winRate}%`}</div>
      <div class="kpi-tile__breakdown">
        <div><span class="kpi-tile__breakdown-num">${closed}</span><span class="kpi-tile__breakdown-label">Total</span></div>
        <div><span class="kpi-tile__breakdown-num">${t.won}</span><span class="kpi-tile__breakdown-label">Won</span></div>
        <div><span class="kpi-tile__breakdown-num">${t.lost}</span><span class="kpi-tile__breakdown-label">Lost</span></div>
      </div>
    </div>`;
}

function drawSalesCharts(a) {
  const t = a.totals;

  Charts.render('chart-stage', {
    type: 'bar',
    data: {
      labels: a.byStage.map(s => s.stage.label),
      datasets: [{
        label: 'Leads',
        data: a.byStage.map(s => s.count),
        backgroundColor: PALETTE.stageColors,
        borderRadius: 6,
        maxBarThickness: 46,
      }],
    },
    options: baseChartOptions({
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.x} lead(s) · ${fmtMoney(a.byStage[ctx.dataIndex].value)}` } } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: PALETTE.grid } }, y: { grid: { display: false } } },
    }),
  });

  const sourceEntries = Object.entries(a.bySource);
  Charts.render('chart-source', {
    type: 'doughnut',
    data: {
      labels: sourceEntries.map(([k]) => k),
      datasets: [{ data: sourceEntries.map(([, v]) => v), backgroundColor: chartPalette(sourceEntries.length), borderWidth: 0 }],
    },
    options: baseChartOptions({ cutout: '62%', scales: {}, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }, !sourceEntries.length),
  });

  Charts.render('chart-trend', {
    type: 'line',
    data: {
      labels: a.months.map(m => m.label),
      datasets: [{
        label: 'New leads',
        data: a.months.map(m => m.count),
        borderColor: PALETTE.amber,
        backgroundColor: PALETTE.amberSoft,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: PALETTE.amber,
      }],
    },
    options: baseChartOptions({
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: PALETTE.grid } } },
    }),
  });

  Charts.render('chart-outcome', {
    type: 'doughnut',
    data: {
      labels: ['Active', 'Won', 'Lost'],
      datasets: [{ data: [t.activeLeads, t.won, t.lost], backgroundColor: [PALETTE.navy, PALETTE.green, PALETTE.red], borderWidth: 0 }],
    },
    options: baseChartOptions({ cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } }, t.totalLeads === 0),
  });
}

function drawProjectCharts(a) {
  Charts.render('chart-project-stage', {
    type: 'bar',
    data: {
      labels: a.byStage.map(s => s.stage.label),
      datasets: [{
        label: 'Projects',
        data: a.byStage.map(s => s.count),
        backgroundColor: [PALETTE.slate, '#4f7cac', PALETTE.amber, PALETTE.brand],
        borderRadius: 6,
        maxBarThickness: 46,
      }],
    },
    options: baseChartOptions({
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.x} project(s) · ${fmtMoney(a.byStage[ctx.dataIndex].value)}` } } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: PALETTE.grid } }, y: { grid: { display: false } } },
    }, !a.totals.totalProjects),
  });

  Charts.render('chart-project-trend', {
    type: 'line',
    data: {
      labels: a.months.map(m => m.label),
      datasets: [{
        label: 'Completed',
        data: a.months.map(m => m.count),
        borderColor: PALETTE.brand,
        backgroundColor: PALETTE.brandSoft,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: PALETTE.brand,
      }],
    },
    options: baseChartOptions({
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: PALETTE.grid } } },
    }),
  });
}

function chartPalette(n) {
  const base = [PALETTE.navy, PALETTE.amber, PALETTE.green, PALETTE.red, '#4f7cac', '#8a97ab', '#e0a12c', '#7a5c9e'];
  const out = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length]);
  return out;
}

function baseChartOptions(overrides = {}, isEmpty = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: !isEmpty, backgroundColor: '#1f2933', padding: 10, cornerRadius: 6 },
    },
    scales: {},
    ...overrides,
  };
}
