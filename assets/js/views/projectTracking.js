/* ==========================================================================
   Project Tracking — kanban board for won leads as they move through
   post-sale production: Design -> Pre-Construction -> Construction ->
   Completed. Mirrors the Lead Pipeline board's drag-and-drop UX.
   ========================================================================== */

function renderProjectTracking(root) {
  function draw() {
    const projects = Leads.projects();
    const totalValue = projects.reduce((s, l) => s + (Number(l.value) || 0), 0);

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Project Tracking</h1>
          <p class="view-sub">${projects.length} project${projects.length === 1 ? '' : 's'} in production · ${fmtMoney(totalValue)} total</p>
        </div>
        <div class="view-head__actions">
          <a class="btn btn--ghost" href="#/pipeline">View Lead Pipeline</a>
        </div>
      </div>

      ${!projects.length ? `
        <div class="empty-banner">
          <strong>No projects yet.</strong> Once a lead is marked <strong>Won</strong> on the Lead Pipeline, it shows up here automatically to track through production.
        </div>` : ''}

      <div class="kanban kanban--4col" id="project-kanban">
        ${PROJECT_STAGES.map(stage => {
          const items = Leads.byProjectStage(stage.id).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
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
              ${items.map(l => projectCardHtml(l)).join('') || `<div class="kanban-empty">Drop projects here.</div>`}
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    wire();
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
        <div class="lead-card__badges">
          <button type="button" class="pill-btn" data-edit-meta="${l.id}" title="Edit status">${projectStatusPillHtml(l)}</button>
          <button type="button" class="pill-btn" data-edit-meta="${l.id}" title="Edit permit">${permitStatusPillHtml(l)}</button>
        </div>
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
