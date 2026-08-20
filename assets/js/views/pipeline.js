/* ==========================================================================
   Pipeline — kanban board across the 5 lead stages.
   Drag & drop between columns, plus quick actions per card.
   ========================================================================== */

function renderPipeline(root) {
  let showLost = false;
  let query = '';
  let filterProjectType = '';
  let filterSource = '';

  function matchesFilters(l) {
    if (filterProjectType && l.projectType !== filterProjectType) return false;
    if (filterSource && l.source !== filterSource) return false;
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
    const active = Leads.active().filter(matchesFilters);
    const lost = Leads.all().filter(l => l.status === 'lost').filter(matchesFilters);
    const totalActiveValue = active.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const hasFilters = query || filterProjectType || filterSource;

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

      <div class="filter-bar">
        <input type="search" id="pipeline-search" class="search-input" placeholder="Search leads, contacts, companies..." value="${esc(query)}">
        <select id="filter-project-type" class="filter-select">${optionList(PROJECT_TYPES, filterProjectType, { blank: 'All project types' })}</select>
        <select id="filter-source" class="filter-select">${optionList(LEAD_SOURCES, filterSource, { blank: 'All sources' })}</select>
        ${hasFilters ? `<button type="button" id="clear-filters-btn" class="link-btn-inline">Clear filters</button>` : ''}
      </div>

      <div class="kanban" id="kanban">
        ${STAGES.map(stage => {
          // The Won column is a trophy case: it shows every won deal (status
          // 'won'), not just "active" leads — a lead's status flips away from
          // 'active' the moment it's won, so it'd otherwise vanish from the board.
          const leads = (stage.id === 'won' ? Leads.all().filter(l => l.status === 'won').filter(matchesFilters) : active.filter(l => l.stage === stage.id))
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
              ${leads.map(l => leadCardHtml(l)).join('') || `<div class="kanban-empty">${hasFilters ? 'No matches.' : 'Drop leads here, or use “+ New Lead”.'}</div>`}
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

    const searchInput = qs('#pipeline-search', root);
    searchInput.addEventListener('input', debounce(e => {
      query = e.target.value;
      draw();
      const el = qs('#pipeline-search', root);
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 200));
    qs('#filter-project-type', root).addEventListener('change', e => { filterProjectType = e.target.value; draw(); });
    qs('#filter-source', root).addEventListener('change', e => { filterSource = e.target.value; draw(); });
    const clearBtn = qs('#clear-filters-btn', root);
    if (clearBtn) clearBtn.addEventListener('click', () => { query = ''; filterProjectType = ''; filterSource = ''; draw(); });

    qsa('[data-won]', root).forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await Leads.markWon(btn.dataset.won);
        toast('🎉 Lead marked as won');
        draw();
      } catch (err) { toast(err.message || 'Could not update the lead', 'warn'); }
    }));
    qsa('[data-lost]', root).forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      openLostReasonPrompt(Leads.get(btn.dataset.lost), () => draw());
    }));
    qsa('[data-reopen]', root).forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await Leads.reopen(btn.dataset.reopen);
        toast('Lead reopened');
        draw();
      } catch (err) { toast(err.message || 'Could not update the lead', 'warn'); }
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
        if (!lead || (lead.stage === targetStage && lead.status === 'active')) return;
        try {
          if (targetStage === 'won') {
            await Leads.markWon(movingId);
            toast('🎉 Lead marked as won');
          } else {
            await Leads.moveStage(movingId, targetStage);
            toast(`Moved to “${stageLabel(targetStage)}”`);
          }
          draw();
        } catch (err) {
          toast(err.message || 'Could not move the lead', 'warn');
        }
      });
    });
  }

  draw();
}
