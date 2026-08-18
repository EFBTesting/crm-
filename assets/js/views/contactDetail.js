/* ==========================================================================
   Contact profile / detail view.
   ========================================================================== */

function renderContactDetail(root, { id }) {
  const contact = Contacts.get(id);
  if (!contact) {
    root.innerHTML = notFoundBlock('Contact', '/contacts');
    wireNotFound(root);
    return;
  }

  function draw() {
    const c = Contacts.get(id);
    if (!c) { Router.navigate('/contacts'); return; }
    const company = Companies.get(c.companyId);
    const leads = Contacts.leadsFor(c.id).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const activeLeads = leads.filter(l => l.status === 'active');
    const wonLeads = leads.filter(l => l.status === 'won');
    const totalValue = leads.reduce((s, l) => s + (Number(l.value) || 0), 0);

    root.innerHTML = `
      <div class="breadcrumb"><a href="#/contacts">Contacts</a> / ${esc(fullName(c))}</div>

      <div class="profile-head">
        <span class="avatar avatar--lg">${esc(initials(c.firstName, c.lastName))}</span>
        <div class="profile-head__info">
          <h1>${esc(fullName(c))}</h1>
          <p class="view-sub">${esc(c.title || 'Contact')}${company ? ` · <a href="#/companies/${company.id}">${esc(company.name)}</a>` : ''}</p>
        </div>
        <div class="view-head__actions">
          <button class="btn btn--ghost" id="edit-contact-btn">Edit</button>
          <button class="btn btn--primary" id="new-lead-btn">+ New Lead</button>
          <button class="btn btn--danger-ghost" id="delete-contact-btn">Delete</button>
        </div>
      </div>

      <div class="detail-grid">
        <div class="panel">
          <h3>Contact info</h3>
          <dl class="detail-list">
            <div><dt>Email</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd></div>
            <div><dt>Phone</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'}</dd></div>
            <div><dt>Address</dt><dd>${esc(c.address) || '—'}</dd></div>
            <div><dt>Lead source</dt><dd>${esc(c.leadSource) || '—'}</dd></div>
            <div><dt>Company</dt><dd>${company ? `<a href="#/companies/${company.id}">${esc(company.name)}</a>` : '—'}</dd></div>
            <div><dt>Added</dt><dd>${fmtDate(c.createdAt)}</dd></div>
          </dl>
          ${c.notes ? `<h3 class="mt">Notes</h3><p class="notes-block">${esc(c.notes)}</p>` : ''}
        </div>

        <div class="panel panel--wide">
          <div class="panel__head-row"><h3>Leads (${leads.length})</h3></div>
          <div class="kpi-inline">
            <div><span class="kpi-inline__num">${activeLeads.length}</span><span class="kpi-inline__label">Active</span></div>
            <div><span class="kpi-inline__num">${wonLeads.length}</span><span class="kpi-inline__label">Won</span></div>
            <div><span class="kpi-inline__num">${fmtMoney(totalValue)}</span><span class="kpi-inline__label">Total Value</span></div>
          </div>
          ${leads.length ? `
            <table class="mini-table">
              <thead><tr><th>Lead</th><th>Stage</th><th>Value</th><th>Updated</th></tr></thead>
              <tbody>
                ${leads.map(l => `
                  <tr class="row-link" data-nav="/leads/${l.id}">
                    <td>${esc(l.title)}</td>
                    <td>${statusPill(l)}</td>
                    <td>${fmtMoney(l.value)}</td>
                    <td class="muted">${timeAgo(l.updatedAt)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>` : `<p class="empty-inline">No leads linked to this contact yet.</p>`}
        </div>
      </div>
    `;

    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', () => Router.navigate(node.dataset.nav)));
    qs('#edit-contact-btn', root).addEventListener('click', () => openContactForm(c, () => draw()));
    qs('#new-lead-btn', root).addEventListener('click', () => openLeadForm(null, { contactId: c.id, companyId: c.companyId }, () => draw()));
    qs('#delete-contact-btn', root).addEventListener('click', () => {
      openConfirm({ title: 'Delete contact', message: `Delete ${fullName(c)}? Linked leads will be kept but unassigned.` }, async () => {
        await Contacts.remove(c.id);
        toast('Contact deleted');
        Router.navigate('/contacts');
      });
    });
  }

  draw();
}

function statusPill(lead) {
  if (lead.status === 'won') return `<span class="pill pill--green">Won</span>`;
  if (lead.status === 'lost') return `<span class="pill pill--red">Lost</span>`;
  return `<span class="pill pill--stage">${esc(stageLabel(lead.stage))}</span>`;
}

function notFoundBlock(kind, backPath) {
  return `<div class="empty-state" data-back="${esc(backPath)}"><p><strong>${esc(kind)} not found.</strong></p><button class="btn btn--primary" id="back-btn">Back</button></div>`;
}
function wireNotFound(root) {
  const btn = qs('#back-btn', root);
  const backPath = qs('.empty-state', root)?.dataset.back || '/dashboard';
  if (btn) btn.addEventListener('click', () => Router.navigate(backPath));
}
