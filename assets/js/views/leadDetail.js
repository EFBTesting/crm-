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
        <div class="permit-status-box mb-md">
          <div class="permit-status-box__pills">
            ${projectStatusPillHtml(l)}
            ${(l.permits || []).map(p => `<span class="pill pill--${p.status === 'approved' ? 'green' : p.status === 'submitted' ? 'stage' : 'muted'}">${esc(p.type)}: ${permitStatusLabel(p.status)}</span>`).join('') || '<span class="pill pill--muted">No permits logged</span>'}
          </div>
          <div class="permit-status-box__township">${l.permitTownship ? `Township: ${esc(l.permitTownship)}` : 'No township on file'}</div>
          <button type="button" class="btn btn--ghost btn--sm" id="edit-permit-btn">Edit</button>
        </div>
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
