/* ==========================================================================
   Company profile / detail view.
   ========================================================================== */

function renderCompanyDetail(root, { id }) {
  const company = Companies.get(id);
  if (!company) {
    root.innerHTML = notFoundBlock('Company', '/companies');
    wireNotFound(root);
    return;
  }

  function draw() {
    const co = Companies.get(id);
    if (!co) { Router.navigate('/companies'); return; }
    const contacts = Companies.contactsFor(co.id);
    const leads = Companies.leadsFor(co.id).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const activeLeads = leads.filter(l => l.status === 'active');
    const wonLeads = leads.filter(l => l.status === 'won');
    const activeValue = activeLeads.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const wonValue = wonLeads.reduce((s, l) => s + (Number(l.value) || 0), 0);

    root.innerHTML = `
      <div class="breadcrumb"><a href="#/companies">Companies</a> / ${esc(co.name)}</div>

      <div class="profile-head">
        <span class="avatar avatar--lg avatar--square">${esc((co.name || '?')[0].toUpperCase())}</span>
        <div class="profile-head__info">
          <h1>${esc(co.name)}</h1>
          <p class="view-sub">${esc(co.type || 'Company')}${co.website ? ` · ${esc(co.website)}` : ''}</p>
        </div>
        <div class="view-head__actions">
          <button class="btn btn--ghost" id="edit-company-btn">Edit</button>
          <button class="btn btn--primary" id="new-lead-btn">+ New Lead</button>
          <button class="btn btn--danger-ghost" id="delete-company-btn">Delete</button>
        </div>
      </div>

      <div class="detail-grid">
        <div class="panel">
          <h3>Company info</h3>
          <dl class="detail-list">
            <div><dt>Type</dt><dd>${esc(co.type) || '—'}</dd></div>
            <div><dt>Phone</dt><dd>${co.phone ? `<a href="tel:${esc(co.phone)}">${esc(co.phone)}</a>` : '—'}</dd></div>
            <div><dt>Website</dt><dd>${esc(co.website) || '—'}</dd></div>
            <div><dt>Address</dt><dd>${esc(co.address) || '—'}</dd></div>
            <div><dt>Primary contact</dt><dd>${esc(co.primaryContactName) || '—'}</dd></div>
            <div><dt>Added</dt><dd>${fmtDate(co.createdAt)}</dd></div>
          </dl>
          ${co.notes ? `<h3 class="mt">Notes</h3><p class="notes-block">${esc(co.notes)}</p>` : ''}
        </div>

        <div class="panel panel--wide">
          <div class="panel__head-row"><h3>Leads (${leads.length})</h3></div>
          <div class="kpi-inline">
            <div><span class="kpi-inline__num">${activeLeads.length}</span><span class="kpi-inline__label">Active</span></div>
            <div><span class="kpi-inline__num">${fmtMoney(activeValue)}</span><span class="kpi-inline__label">Active Value</span></div>
            <div><span class="kpi-inline__num">${fmtMoney(wonValue)}</span><span class="kpi-inline__label">Won Value</span></div>
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
            </table>` : `<p class="empty-inline">No leads linked to this company yet.</p>`}
        </div>

        <div class="panel panel--wide">
          <div class="panel__head-row"><h3>Contacts at this company (${contacts.length})</h3></div>
          ${contacts.length ? `
            <table class="mini-table">
              <thead><tr><th>Name</th><th>Title</th><th>Email</th><th>Phone</th></tr></thead>
              <tbody>
                ${contacts.map(c => `
                  <tr class="row-link" data-nav="/contacts/${c.id}">
                    <td>${esc(fullName(c))}</td>
                    <td>${esc(c.title) || '—'}</td>
                    <td>${esc(c.email) || '—'}</td>
                    <td>${esc(c.phone) || '—'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>` : `<p class="empty-inline">No contacts linked yet. Add a contact and set this company on their profile.</p>`}
        </div>
      </div>
    `;

    qsa('[data-nav]', root).forEach(node => node.addEventListener('click', () => Router.navigate(node.dataset.nav)));
    qs('#edit-company-btn', root).addEventListener('click', () => openCompanyForm(co, () => draw()));
    qs('#new-lead-btn', root).addEventListener('click', () => openLeadForm(null, { companyId: co.id }, () => draw()));
    qs('#delete-company-btn', root).addEventListener('click', () => {
      openConfirm({ title: 'Delete company', message: `Delete ${co.name}? Linked contacts and leads will be kept but unassigned.` }, async () => {
        await Companies.remove(co.id);
        toast('Company deleted');
        Router.back('/companies');
      });
    });
  }

  draw();
}
