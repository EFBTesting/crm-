/* ==========================================================================
   Generic modal shell + the add/edit forms for contacts, companies, leads.
   ========================================================================== */

const Modal = (() => {
  const root = () => qs('#modal-root');

  function close() {
    const r = root();
    r.innerHTML = '';
    r.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function open({ title, bodyHtml, wide = false }) {
    const r = root();
    r.innerHTML = `
      <div class="modal-overlay" data-close="1">
        <div class="modal-card ${wide ? 'modal-card--wide' : ''}" role="dialog" aria-modal="true">
          <div class="modal-card__head">
            <h3>${esc(title)}</h3>
            <button class="icon-btn" data-close="1" aria-label="Close">✕</button>
          </div>
          <div class="modal-card__body">${bodyHtml}</div>
        </div>
      </div>`;
    r.classList.add('is-open');
    document.body.classList.add('modal-open');
    r.querySelectorAll('[data-close]').forEach(elm => {
      elm.addEventListener('click', e => {
        if (e.target === elm) close();
      });
    });
    const firstInput = qs('input, select, textarea', r);
    if (firstInput) setTimeout(() => firstInput.focus(), 30);
    return r;
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && root()?.classList.contains('is-open')) close();
  });

  return { open, close };
})();

function optionList(items, selected, { valueKey = null, labelKey = null, blank = '— None —' } = {}) {
  const opts = blank ? [`<option value="">${esc(blank)}</option>`] : [];
  items.forEach(item => {
    const value = valueKey ? item[valueKey] : item;
    const label = labelKey ? item[labelKey] : item;
    opts.push(`<option value="${esc(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${esc(label)}</option>`);
  });
  return opts.join('');
}

/* --------------------------- Contact form --------------------------- */

function openContactForm(existing = null, onSaved = null) {
  const companies = Companies.all();
  Modal.open({
    title: existing ? 'Edit Contact' : 'New Contact',
    bodyHtml: `
      <form id="contact-form" class="form-grid">
        <label class="field"><span>First name *</span>
          <input name="firstName" required value="${esc(existing?.firstName)}" placeholder="Jordan">
        </label>
        <label class="field"><span>Last name *</span>
          <input name="lastName" required value="${esc(existing?.lastName)}" placeholder="Blake">
        </label>
        <label class="field"><span>Email</span>
          <input type="email" name="email" value="${esc(existing?.email)}" placeholder="jordan@email.com">
        </label>
        <label class="field"><span>Phone</span>
          <input type="tel" name="phone" value="${esc(existing?.phone)}" placeholder="(555) 555-0100">
        </label>
        <label class="field"><span>Title / Role</span>
          <input name="title" value="${esc(existing?.title)}" placeholder="Homeowner, Property Manager, ...">
        </label>
        <label class="field"><span>Company</span>
          <select name="companyId">${optionList(companies, existing?.companyId, { valueKey: 'id', labelKey: 'name' })}</select>
        </label>
        <label class="field field--full"><span>Address</span>
          <input name="address" value="${esc(existing?.address)}" placeholder="Street, City, State">
        </label>
        <label class="field"><span>Lead source</span>
          <select name="leadSource">${optionList(LEAD_SOURCES, existing?.leadSource, { blank: '— Unspecified —' })}</select>
        </label>
        <label class="field field--full"><span>Notes</span>
          <textarea name="notes" rows="3" placeholder="Anything worth remembering about this person...">${esc(existing?.notes)}</textarea>
        </label>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-close="1">Cancel</button>
          <button type="submit" class="btn btn--primary">${existing ? 'Save changes' : 'Create contact'}</button>
        </div>
      </form>`,
  });

  qs('#contact-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    if (!data.firstName.trim() || !data.lastName.trim()) return;
    const saved = existing ? Contacts.update(existing.id, data) : Contacts.create(data);
    Modal.close();
    toast(existing ? 'Contact updated' : 'Contact created');
    if (onSaved) onSaved(saved);
  });
}

/* --------------------------- Company form --------------------------- */

function openCompanyForm(existing = null, onSaved = null) {
  const contacts = Contacts.all();
  Modal.open({
    title: existing ? 'Edit Company' : 'New Company',
    bodyHtml: `
      <form id="company-form" class="form-grid">
        <label class="field field--full"><span>Company name *</span>
          <input name="name" required value="${esc(existing?.name)}" placeholder="Summit Property Group">
        </label>
        <label class="field"><span>Type</span>
          <select name="type">${optionList(COMPANY_TYPES, existing?.type, { blank: '— Unspecified —' })}</select>
        </label>
        <label class="field"><span>Phone</span>
          <input type="tel" name="phone" value="${esc(existing?.phone)}" placeholder="(555) 555-0100">
        </label>
        <label class="field"><span>Website</span>
          <input name="website" value="${esc(existing?.website)}" placeholder="www.example.com">
        </label>
        <label class="field"><span>Primary contact</span>
          <select name="primaryContactId">${optionList(contacts.map(c => ({ id: c.id, name: fullName(c) })), existing?.primaryContactId, { valueKey: 'id', labelKey: 'name' })}</select>
        </label>
        <label class="field field--full"><span>Address</span>
          <input name="address" value="${esc(existing?.address)}" placeholder="Street, City, State">
        </label>
        <label class="field field--full"><span>Notes</span>
          <textarea name="notes" rows="3">${esc(existing?.notes)}</textarea>
        </label>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-close="1">Cancel</button>
          <button type="submit" class="btn btn--primary">${existing ? 'Save changes' : 'Create company'}</button>
        </div>
      </form>`,
  });

  qs('#company-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    if (!data.name.trim()) return;
    const saved = existing ? Companies.update(existing.id, data) : Companies.create(data);
    Modal.close();
    toast(existing ? 'Company updated' : 'Company created');
    if (onSaved) onSaved(saved);
  });
}

/* --------------------------- Lead form --------------------------- */

function openLeadForm(existing = null, defaults = {}, onSaved = null) {
  const contacts = Contacts.all();
  const companies = Companies.all();
  Modal.open({
    title: existing ? 'Edit Lead' : 'New Lead',
    wide: true,
    bodyHtml: `
      <form id="lead-form" class="form-grid">
        <label class="field field--full"><span>Lead title *</span>
          <input name="title" required value="${esc(existing?.title)}" placeholder="e.g. Kitchen Remodel — Smith Residence">
        </label>
        <label class="field"><span>Contact</span>
          <select name="contactId">${optionList(contacts.map(c => ({ id: c.id, name: fullName(c) })), existing?.contactId ?? defaults.contactId, { valueKey: 'id', labelKey: 'name' })}</select>
        </label>
        <label class="field"><span>Company (if applicable)</span>
          <select name="companyId">${optionList(companies, existing?.companyId ?? defaults.companyId, { valueKey: 'id', labelKey: 'name' })}</select>
        </label>
        <label class="field"><span>Stage</span>
          <select name="stage">${optionList(STAGES, existing?.stage ?? defaults.stage ?? STAGES[0].id, { valueKey: 'id', labelKey: 'label', blank: null })}</select>
        </label>
        <label class="field"><span>Estimated value ($)</span>
          <input type="number" min="0" step="100" name="value" value="${existing?.value ?? ''}" placeholder="25000">
        </label>
        <label class="field"><span>Project type</span>
          <select name="projectType">${optionList(PROJECT_TYPES, existing?.projectType, { blank: '— Unspecified —' })}</select>
        </label>
        <label class="field"><span>Lead source</span>
          <select name="source">${optionList(LEAD_SOURCES, existing?.source, { blank: '— Unspecified —' })}</select>
        </label>
        <label class="field"><span>Expected close date</span>
          <input type="date" name="expectedCloseDate" value="${esc(existing?.expectedCloseDate)}">
        </label>
        <label class="field field--full"><span>Notes</span>
          <textarea name="notes" rows="3" placeholder="Scope, budget signals, next steps...">${esc(existing?.notes)}</textarea>
        </label>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-close="1">Cancel</button>
          <button type="submit" class="btn btn--primary">${existing ? 'Save changes' : 'Create lead'}</button>
        </div>
      </form>`,
  });

  qs('#lead-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    if (!data.title.trim()) return;
    const saved = existing ? Leads.update(existing.id, data) : Leads.create(data);
    Modal.close();
    toast(existing ? 'Lead updated' : 'Lead created');
    if (onSaved) onSaved(saved);
  });
}

/* --------------------------- Lost reason prompt --------------------------- */

function openLostReasonPrompt(lead, onDone) {
  Modal.open({
    title: 'Mark lead as lost',
    bodyHtml: `
      <form id="lost-form" class="form-grid">
        <label class="field field--full"><span>Reason</span>
          <select name="reason">${optionList(LOST_REASONS, '', { blank: '— Select a reason —' })}</select>
        </label>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-close="1">Cancel</button>
          <button type="submit" class="btn btn--danger">Mark as lost</button>
        </div>
      </form>`,
  });
  qs('#lost-form').addEventListener('submit', e => {
    e.preventDefault();
    const reason = new FormData(e.target).get('reason') || 'Other';
    Leads.markLost(lead.id, reason);
    Modal.close();
    toast('Lead marked as lost', 'warn');
    if (onDone) onDone();
  });
}

/* --------------------------- Confirm dialog --------------------------- */

function openConfirm({ title = 'Are you sure?', message = '', confirmLabel = 'Delete', danger = true }, onConfirm) {
  Modal.open({
    title,
    bodyHtml: `
      <p class="confirm-text">${esc(message)}</p>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-close="1">Cancel</button>
        <button type="button" id="confirm-btn" class="btn ${danger ? 'btn--danger' : 'btn--primary'}">${esc(confirmLabel)}</button>
      </div>`,
  });
  qs('#confirm-btn').addEventListener('click', () => {
    Modal.close();
    onConfirm();
  });
}
