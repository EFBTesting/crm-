/* ==========================================================================
   Pipeline — kanban board across the 5 lead stages.
   Drag & drop between columns, plus quick actions per card.
   ========================================================================== */

function renderPipeline(root) {
  let showLost = false;

  function draw() {
    const active = Leads.active();
    const lost = Leads.all().filter(l => l.status === 'lost');
    const totalActiveValue = active.reduce((s, l) => s + (Number(l.value) || 0), 0);

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

      <div class="kanban" id="kanban">
        ${STAGES.map(stage => {
          // The Won column is a trophy case: it shows every won deal (status
          // 'won'), not just "active" leads — a lead's status flips away from
          // 'active' the moment it's won, so it'd otherwise vanish from the board.
          const leads = (stage.id === 'won' ? Leads.all().filter(l => l.status === 'won') : active.filter(l => l.stage === stage.id))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          const value = leads.reduce((s, l) => s + (Number(l.value) || 0), 0);
          return `
          <div class="kanban-col" data-stage="${stage.id}">
            <div class="kanban-col__head">
              <div>
                <h3>${esc(stage.label)}</h3>
                <p class="kanban-col__desc">${esc(stage.description)}</p>
              </div>
              <span class="pill pill--navy">${leads.length}</span>
            </div>
            <div class="kanban-col__value">${fmtMoney(value)}</div>
            <div class="kanban-col__body" data-dropzone="${stage.id}">
              ${leads.map(l => leadCardHtml(l)).join('') || `<div class="kanban-empty">Drop leads here, or use “+ New Lead”.</div>`}
            </div>
          </div>`;
        }).join('')}
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

  function leadCardHtml(l) {
    const contact = Contacts.get(l.contactId);
    const company = Companies.get(l.companyId);
    const who = contact ? fullName(contact) : (company ? company.name : 'Unassigned');
    return `
      <div class="lead-card" draggable="true" data-lead-id="${l.id}">
        <div class="lead-card__top">
          <span class="lead-card__title row-link" data-nav="/leads/${l.id}">${esc(l.title)}</span>
        </div>
        <div class="lead-card__who">${esc(who)}</div>
        <div class="lead-card__meta">
          <span class="lead-card__value">${fmtMoney(l.value)}</span>
          ${l.projectType ? `<span class="pill pill--muted">${esc(l.projectType)}</span>` : ''}
        </div>
        ${l.status === 'active' ? `
        <div class="lead-card__actions">
          <button class="chip-btn chip-btn--won" data-won="${l.id}" title="Mark won">✓ Won</button>
          <button class="chip-btn chip-btn--lost" data-lost="${l.id}" title="Mark lost">✕ Lost</button>
        </div>` : ''}
      </div>`;
  }

  function wire() {
    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', e => { e.stopPropagation(); Router.navigate(node.dataset.nav); }));
    qs('#new-lead-btn', root).addEventListener('click', () => openLeadForm(null, {}, () => draw()));
    qs('#toggle-lost-btn', root).addEventListener('click', () => { showLost = !showLost; draw(); });

    qsa('[data-won]', root).forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      Leads.markWon(btn.dataset.won);
      toast('🎉 Lead marked as won');
      draw();
    }));
    qsa('[data-lost]', root).forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      openLostReasonPrompt(Leads.get(btn.dataset.lost), () => draw());
    }));
    qsa('[data-reopen]', root).forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      Leads.reopen(btn.dataset.reopen);
      toast('Lead reopened');
      draw();
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
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('is-dragover');
        if (!draggedId) return;
        const targetStage = zone.dataset.dropzone;
        const lead = Leads.get(draggedId);
        if (lead && (lead.stage !== targetStage || lead.status !== 'active')) {
          if (targetStage === 'won') {
            Leads.markWon(draggedId);
            toast('🎉 Lead marked as won');
          } else {
            Leads.moveStage(draggedId, targetStage);
            toast(`Moved to “${stageLabel(targetStage)}”`);
          }
          draw();
        }
        draggedId = null;
      });
    });
  }

  draw();
}
