/* ==========================================================================
   Analytics dashboard — high-level view of the whole business.
   ========================================================================== */

function computeAnalytics() {
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

  const byLostReason = {};
  lost.forEach(l => {
    const key = l.lostReason || 'Other';
    byLostReason[key] = (byLostReason[key] || 0) + 1;
  });

  // last 6 months, leads created per month
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }), count: 0 });
  }
  leads.forEach(l => {
    const d = new Date(l.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = months.find(m => m.key === key);
    if (bucket) bucket.count += 1;
  });

  const recentActivity = leads
    .flatMap(l => l.history.map(h => ({ ...h, leadId: l.id, leadTitle: l.title })))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);

  const topActiveLeads = [...active].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5);

  return {
    totals: {
      totalLeads: leads.length,
      activeLeads: active.length,
      won: won.length,
      wonThisMonth: wonThisMonth.length,
      lost: lost.length,
      pipelineValue,
      wonValue,
      avgDealSize,
      winRate,
    },
    byStage,
    bySource,
    byLostReason,
    months,
    recentActivity,
    topActiveLeads,
  };
}

function renderDashboard(root) {
  const a = computeAnalytics();
  const t = a.totals;
  const hasAnyLeads = t.totalLeads > 0;

  root.innerHTML = `
    <div class="view-head">
      <div>
        <h1>Business Overview</h1>
        <p class="view-sub">Erwin Forest Builders — everything happening across the CRM, at a glance.</p>
      </div>
    </div>

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

  drawDashboardCharts(a);
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

function drawDashboardCharts(a) {
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
