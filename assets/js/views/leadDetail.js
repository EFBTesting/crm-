/* ==========================================================================
   Lead profile / detail view.
   ========================================================================== */

function renderLeadDetail(root, { id }) {
  const lead = Leads.get(id);
  if (!lead) {
    root.innerHTML = notFoundBlock('Lead', '/pipeline');
    wireNotFound(root);
    return;
  }

  function draw() {
    const l = Leads.get(id);
    if (!l) { Router.navigate('/pipeline'); return; }
    const contact = Contacts.get(l.contactId);
    const secondaryContact = Contacts.get(l.secondaryContactId);
    const company = Companies.get(l.companyId);
    const revenue = revenueAmount(l);
    const history = [...l.history].sort((a, b) => new Date(b.at) - new Date(a.at));

    const projectStage = l.projectStage || PROJECT_STAGES[0].id;

    root.innerHTML = `
      <div class="breadcrumb">${l.status === 'won' ? '<a href="#/projects">Project Tracking</a>' : '<a href="#/pipeline">Pipeline</a>'} / ${esc(l.title)}</div>

      <div class="profile-head">
        <div class="profile-head__info">
          <div class="lead-status-row">${statusPill(l)} ${l.status === 'active' ? `<span class="pill pill--muted">${STAGES.findIndex(s => s.id === l.stage) + 1} of ${STAGES.length}</span>` : ''}</div>
          <h1>${esc(l.title)}</h1>
          <p class="view-sub">${fmtMoney(l.value)} budget${l.projectType ? ` · ${esc(l.projectType)}` : ''}${revenue !== null ? ` · ${fmtMoney(revenue)} est. revenue` : ''}</p>
        </div>
        <div class="view-head__actions">
          <button class="btn btn--ghost" id="edit-lead-btn">Edit</button>
          <button class="btn btn--danger-ghost" id="delete-lead-btn">Delete</button>
        </div>
      </div>

      ${l.status === 'active' ? `
        <div class="stage-tracker">
          ${STAGES.map((s, i) => `
            <button class="stage-step ${s.id === l.stage ? 'is-current' : ''} ${STAGES.findIndex(x => x.id === l.stage) > i ? 'is-done' : ''}" data-set-stage="${s.id}">
              <span class="stage-step__dot"></span>${esc(s.label)}
            </button>`).join('')}
        </div>
        <div class="view-head__actions mb-md">
          <button class="btn btn--success" id="won-btn">✓ Mark Won</button>
          <button class="btn btn--danger" id="lost-btn">✕ Mark Lost</button>
        </div>
      ` : l.status === 'lost' ? `
        <div class="empty-banner empty-banner--danger">Marked lost: <strong>${esc(l.lostReason || 'Other')}</strong> on ${fmtDate(l.lostAt)}.
          <button class="btn btn--ghost btn--sm" id="reopen-btn">Reopen lead</button>
        </div>
      ` : `
        <div class="empty-banner empty-banner--success">🎉 Won on ${fmtDate(l.wonAt)}. Contract signed — now tracked as a project.</div>
        <div class="stage-tracker">
          ${PROJECT_STAGES.map((s, i) => `
            <button class="stage-step ${s.id === projectStage ? 'is-current' : ''} ${PROJECT_STAGES.findIndex(x => x.id === projectStage) > i ? 'is-done' : ''}" data-set-project-stage="${s.id}">
              <span class="stage-step__dot"></span>${esc(s.label)}
            </button>`).join('')}
        </div>
        <div class="panel mb-md">
          <div class="panel__head-row">
            <h3>Permits &amp; Status</h3>
            <button type="button" class="btn btn--ghost btn--sm" id="edit-permit-btn">Edit</button>
          </div>
          <div class="permit-status-box__pills">
            ${projectStatusPillHtml(l)}
            ${(l.permits || []).map(p => `<span class="pill pill--${p.status === 'approved' ? 'green' : p.status === 'submitted' ? 'stage' : 'muted'}">${esc(p.type)}: ${permitStatusLabel(p.status)}</span>`).join('') || '<span class="pill pill--muted">No permits logged</span>'}
          </div>
          <div class="permit-status-box__township mt-sm">${l.permitTownship ? `Township: ${esc(l.permitTownship)}` : 'No township on file'}</div>
        </div>

        ${preconSectionHtml(l)}
      `}

      <div class="detail-grid">
        <div class="panel">
          <h3>Details</h3>
          <dl class="detail-list">
            <div><dt>Contact</dt><dd>${contact ? `<a href="#/contacts/${contact.id}">${esc(fullName(contact))}</a>` : '—'}</dd></div>
            ${secondaryContact ? `<div><dt>2nd contact</dt><dd><a href="#/contacts/${secondaryContact.id}">${esc(fullName(secondaryContact))}</a></dd></div>` : ''}
            ${company ? `<div><dt>Company</dt><dd><a href="#/companies/${company.id}">${esc(company.name)}</a></dd></div>` : ''}
            <div><dt>Budget</dt><dd>${fmtMoney(l.value)}</dd></div>
            <div><dt>Est. revenue</dt><dd>${revenue !== null ? `${fmtMoney(revenue)} <span class="muted">(${l.revenuePercent}%)</span>` : '—'}</dd></div>
            <div><dt>Project type</dt><dd>${esc(l.projectType) || '—'}</dd></div>
            <div><dt>Lead source</dt><dd>${esc(l.source) || '—'}</dd></div>
            <div><dt>Created</dt><dd>${fmtDate(l.createdAt)}</dd></div>
            <div><dt>Last updated</dt><dd>${timeAgo(l.updatedAt)}</dd></div>
          </dl>
          ${l.notes ? `<h3 class="mt">Notes</h3><p class="notes-block">${esc(l.notes)}</p>` : ''}
        </div>

        <div class="panel panel--wide">
          <div class="panel__head-row"><h3>Activity</h3></div>
          <form id="note-form" class="note-form">
            <input name="note" placeholder="Log a call, note next steps..." autocomplete="off">
            <button type="submit" class="btn btn--primary btn--sm">Add</button>
          </form>
          <ul class="activity-list">
            ${history.map(h => `
              <li>
                <span class="activity-dot activity-dot--${h.event}"></span>
                <div>
                  <div class="activity-line">${esc(h.detail)}</div>
                  <div class="activity-time">${fmtDateTime(h.at)}</div>
                </div>
              </li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    qs('#edit-lead-btn', root).addEventListener('click', () => openLeadForm(l, {}, () => draw()));
    qs('#delete-lead-btn', root).addEventListener('click', () => {
      openConfirm({
        title: 'Delete lead',
        message: `Delete "${l.title}"? Their linked contact will also be deleted (unless tied to another lead). If you might reopen this later, use "Mark Lost" instead — this cannot be undone.`,
      }, async () => {
        await Leads.remove(l.id);
        toast('Lead and contact deleted');
        Router.navigate('/pipeline');
      });
    });

    if (l.status === 'active') {
      qs('#won-btn', root).addEventListener('click', async () => {
        try { await Leads.markWon(l.id); toast('🎉 Lead marked as won'); draw(); }
        catch (err) { toast(err.message || 'Could not update the lead', 'warn'); }
      });
      qs('#lost-btn', root).addEventListener('click', () => openLostReasonPrompt(l, () => draw()));
      qsa('[data-set-stage]', root).forEach(btn => btn.addEventListener('click', async () => {
        try { await Leads.moveStage(l.id, btn.dataset.setStage); draw(); }
        catch (err) { toast(err.message || 'Could not update the lead', 'warn'); }
      }));
    }
    if (l.status === 'lost') {
      qs('#reopen-btn', root).addEventListener('click', async () => {
        try { await Leads.reopen(l.id); toast('Lead reopened'); draw(); }
        catch (err) { toast(err.message || 'Could not update the lead', 'warn'); }
      });
    }
    if (l.status === 'won') {
      qsa('[data-set-project-stage]', root).forEach(btn => btn.addEventListener('click', async () => {
        try { await Leads.moveProjectStage(l.id, btn.dataset.setProjectStage); draw(); }
        catch (err) { toast(err.message || 'Could not update the project', 'warn'); }
      }));
      qs('#edit-permit-btn', root).addEventListener('click', () => openProjectMetaForm(l, () => draw()));
      wirePreconSection(root, l, draw);
    }

    qs('#note-form', root).addEventListener('submit', async e => {
      e.preventDefault();
      const input = qs('input[name="note"]', e.target);
      const val = input.value.trim();
      if (!val) return;
      try {
        await Leads.addNote(l.id, val);
        input.value = '';
        draw();
      } catch (err) { toast(err.message || 'Could not add the note', 'warn'); }
    });
  }

  draw();
}

/* --------------------------- Pre-Construction checklist --------------------------- */

function preconSectionHtml(l) {
  const progress = preconProgress(l);
  if (!progress) {
    return `
      <div class="panel mb-md">
        <div class="panel__head-row"><h3>Pre-Construction Checklist</h3></div>
        <p class="empty-inline">Not started yet — kick it off to track this project through Lead-Up and Pre-Construction step by step.</p>
        <button type="button" class="btn btn--primary btn--sm" id="start-precon-btn">Start Pre-Construction Checklist</button>
      </div>`;
  }
  const pct = progress.progressPercent === null ? null : Math.round(progress.progressPercent * 100);
  return `
    <div class="panel mb-md">
      <div class="panel__head-row">
        <h3>Pre-Construction Checklist</h3>
        <button type="button" class="btn btn--ghost btn--sm" id="edit-precon-meta-btn">Edit Details</button>
      </div>
      <div class="precon-summary">
        ${preconStatusPillHtml(progress)}
        <span class="precon-summary__stat">${pct === null ? '—' : `${pct}%`} complete</span>
        <span class="precon-summary__stat">${progress.completed}/${progress.stepsInScope} steps</span>
        ${l.projectedStartDate ? `<span class="precon-summary__stat">Start ${fmtDateOnly(l.projectedStartDate)}${progress.daysToStart !== null ? ` · ${progress.daysToStart >= 0 ? `${progress.daysToStart}d away` : `${Math.abs(progress.daysToStart)}d overdue`}` : ''}</span>` : ''}
      </div>
      ${progressBarHtml(progress.progressPercent, 'progress-bar--lg')}
      <p class="view-sub mt-sm">Current step: <strong>${esc(progress.currentStep)}</strong></p>
      ${l.preconNotes ? `<p class="notes-block mt-sm">${esc(l.preconNotes)}</p>` : ''}

      ${PRECON_PHASES.map(phase => preconPhaseHtml(l, phase)).join('')}
    </div>`;
}

function preconPhaseHtml(l, phase) {
  const steps = (l.preconSteps || []).filter(s => s.phase === phase.id);
  return `
    <div class="precon-phase">
      <h4 class="precon-phase__title">${esc(phase.label)}</h4>
      <div class="precon-step-list">
        ${steps.map(s => `
          <div class="precon-step-row" data-step-phase="${phase.id}" data-step-label="${esc(s.label)}">
            <span class="precon-step-row__label">${esc(s.label)}</span>
            <select class="precon-step-row__status" data-step-select>${optionList(PRECON_STEP_STATUSES, s.status || 'Not Started', { blank: null })}</select>
            ${!phase.steps.includes(s.label) ? `<button type="button" class="icon-btn" data-step-remove title="Remove step">✕</button>` : ''}
          </div>`).join('')}
      </div>
      <form class="precon-add-step" data-add-phase="${phase.id}">
        <input type="text" name="label" placeholder="+ Add a custom step..." autocomplete="off">
      </form>
    </div>`;
}

function wirePreconSection(root, l, draw) {
  const startBtn = qs('#start-precon-btn', root);
  if (startBtn) startBtn.addEventListener('click', async () => {
    try { await Leads.initPreconChecklist(l.id); draw(); }
    catch (err) { toast(err.message || 'Could not start the checklist', 'warn'); }
  });

  const editBtn = qs('#edit-precon-meta-btn', root);
  if (editBtn) editBtn.addEventListener('click', () => openPreconMetaForm(l, () => draw()));

  qsa('.precon-step-row', root).forEach(row => {
    const { stepPhase: phase, stepLabel: label } = row.dataset;
    qs('[data-step-select]', row).addEventListener('change', async e => {
      try { await Leads.setPreconStep(l.id, phase, label, e.target.value); draw(); }
      catch (err) { toast(err.message || 'Could not update the step', 'warn'); }
    });
    const removeBtn = qs('[data-step-remove]', row);
    if (removeBtn) removeBtn.addEventListener('click', () => {
      openConfirm({ title: 'Remove step', message: `Remove "${label}" from this project's checklist?` }, async () => {
        try { await Leads.removePreconStep(l.id, phase, label); draw(); }
        catch (err) { toast(err.message || 'Could not remove the step', 'warn'); }
      });
    });
  });

  qsa('.precon-add-step', root).forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input = qs('input[name="label"]', form);
      const val = input.value.trim();
      if (!val) return;
      try { await Leads.addPreconStep(l.id, form.dataset.addPhase, val); draw(); }
      catch (err) { toast(err.message || 'Could not add the step', 'warn'); }
    });
  });
}
