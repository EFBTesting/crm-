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

/** Wires a form's submit event to an async save function, disabling the
 *  submit button while it's in flight and surfacing errors (e.g. a dropped
 *  connection to Supabase) instead of silently failing. */
function handleAsyncSubmit(form, { onSubmit, busyLabel = 'Saving…' }) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = qs('button[type="submit"]', form);
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyLabel;
    try {
      await onSubmit(new FormData(form));
    } catch (err) {
      console.error(err);
      toast(err.message || 'Something went wrong — please try again.', 'warn');
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
}

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

  const contactForm = qs('#contact-form');
  bindAutoCapitalize(qs('input[name="firstName"]', contactForm));
  bindAutoCapitalize(qs('input[name="lastName"]', contactForm));
  bindAutoCapitalize(qs('input[name="title"]', contactForm));

  handleAsyncSubmit(contactForm, {
    onSubmit: async fd => {
      const data = Object.fromEntries(fd.entries());
      if (!data.firstName.trim() || !data.lastName.trim()) return;
      const saved = existing ? await Contacts.update(existing.id, data) : await Contacts.create(data);
      Modal.close();
      toast(existing ? 'Contact updated' : 'Contact created');
      if (onSaved) onSaved(saved);
    },
  });
}

/* --------------------------- Company form --------------------------- */

function openCompanyForm(existing = null, onSaved = null) {
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
          <input name="primaryContactName" value="${esc(existing?.primaryContactName)}" placeholder="Name of main point of contact">
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

  const companyForm = qs('#company-form');
  bindAutoCapitalize(qs('input[name="name"]', companyForm));

  handleAsyncSubmit(companyForm, {
    onSubmit: async fd => {
      const data = Object.fromEntries(fd.entries());
      if (!data.name.trim()) return;
      const saved = existing ? await Companies.update(existing.id, data) : await Companies.create(data);
      Modal.close();
      toast(existing ? 'Company updated' : 'Company created');
      if (onSaved) onSaved(saved);
    },
  });
}

/* --------------------------- Lead form --------------------------- */

/** One contact sub-block's fields (Name / Phone / Email / Best time to
 *  contact), reused for both the primary and the optional second contact. */
function contactFieldsHtml(prefix, contact) {
  const name = contact ? fullName(contact).replace(/^Unnamed Contact$/, '') : '';
  return `
    <label class="field"><span>Name</span>
      <input name="${prefix}Name" value="${esc(name)}" placeholder="Full name">
    </label>
    <label class="field"><span>Phone</span>
      <input type="tel" name="${prefix}Phone" value="${esc(contact?.phone)}" placeholder="(555) 555-0100">
    </label>
    <label class="field"><span>Email</span>
      <input type="email" name="${prefix}Email" value="${esc(contact?.email)}" placeholder="name@email.com">
    </label>
    <label class="field"><span>Best time to contact</span>
      <select name="${prefix}BestTime">${optionList(BEST_TIME_OPTIONS, contact?.bestTimeToContact, { blank: '— Unspecified —' })}</select>
    </label>
    <label class="field field--full"><span>Address</span>
      <input name="${prefix}Address" value="${esc(contact?.address)}" placeholder="Street, City, State">
    </label>`;
}

function openLeadForm(existing = null, defaults = {}, onSaved = null) {
  const contact1ExistingId = existing?.contactId ?? defaults.contactId ?? null;
  const contact2ExistingId = existing?.secondaryContactId ?? null;
  const primaryContact = Contacts.get(contact1ExistingId);
  const secondaryContact = Contacts.get(contact2ExistingId);
  const hasSecondContact = !!secondaryContact;

  Modal.open({
    title: existing ? 'Edit Lead' : 'New Lead',
    wide: true,
    bodyHtml: `
      <form id="lead-form" class="form-grid">
        <label class="field field--full"><span>Lead title *</span>
          <input name="title" required value="${esc(existing?.title)}" placeholder="e.g. Kitchen Remodel — Smith Residence">
        </label>
        <label class="field"><span>Stage</span>
          <select name="stage">${optionList(STAGES, existing?.stage ?? defaults.stage ?? STAGES[0].id, { valueKey: 'id', labelKey: 'label', blank: null })}</select>
        </label>
        <label class="field"><span>Budget ($)</span>
          <input type="number" min="0" step="100" name="value" id="lead-value-input" value="${existing?.value ?? ''}" placeholder="25000">
        </label>
        <label class="field"><span>Estimated Revenue (%)</span>
          <div class="revenue-row">
            <input type="number" min="0" max="100" step="0.1" name="revenuePercent" id="lead-revenue-input" value="${existing?.revenuePercent ?? ''}" placeholder="5">
            <span class="revenue-readout" id="revenue-readout">${fmtMoney(revenueAmount(existing) || 0)}</span>
          </div>
        </label>
        <label class="field"><span>Project type</span>
          <select name="projectType">${optionList(PROJECT_TYPES, existing?.projectType, { blank: '— Unspecified —' })}</select>
        </label>
        <label class="field field--full"><span>Lead source</span>
          <select name="source">${optionList(LEAD_SOURCES, existing?.source, { blank: '— Unspecified —' })}</select>
        </label>
        <label class="field field--full"><span>Notes</span>
          <textarea name="notes" rows="3" placeholder="Scope, budget signals, next steps...">${esc(existing?.notes)}</textarea>
        </label>

        <div class="field field--full subform">
          <div class="subform__head"><span>Contact</span></div>
          <div class="subform-grid">${contactFieldsHtml('contact1', primaryContact)}</div>
        </div>

        <div class="field field--full">
          <button type="button" id="toggle-second-contact-btn" class="link-btn-inline" ${hasSecondContact ? 'hidden' : ''}>+ Add another contact</button>
        </div>

        <div class="field field--full subform" id="second-contact-block" ${hasSecondContact ? '' : 'hidden'}>
          <div class="subform__head"><span>Second contact</span> <button type="button" id="remove-second-contact-btn" class="link-btn-inline link-btn-inline--danger">✕ Remove</button></div>
          <div class="subform-grid">${contactFieldsHtml('contact2', secondaryContact)}</div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-close="1">Cancel</button>
          <button type="submit" class="btn btn--primary">${existing ? 'Save changes' : 'Create lead'}</button>
        </div>
      </form>`,
  });

  const form = qs('#lead-form');
  const valueInput = qs('#lead-value-input', form);
  const revenueInput = qs('#lead-revenue-input', form);
  const revenueReadout = qs('#revenue-readout', form);
  const updateRevenueReadout = () => {
    const budget = Number(valueInput.value) || 0;
    const pct = Number(revenueInput.value) || 0;
    revenueReadout.textContent = fmtMoney(budget * pct / 100);
  };
  valueInput.addEventListener('input', updateRevenueReadout);
  revenueInput.addEventListener('input', updateRevenueReadout);

  const secondBlock = qs('#second-contact-block', form);
  const toggleSecondBtn = qs('#toggle-second-contact-btn', form);
  const removeSecondBtn = qs('#remove-second-contact-btn', form);
  toggleSecondBtn.addEventListener('click', () => {
    secondBlock.hidden = false;
    toggleSecondBtn.hidden = true;
  });
  removeSecondBtn.addEventListener('click', () => {
    secondBlock.hidden = true;
    toggleSecondBtn.hidden = false;
    qsa('input, select', secondBlock).forEach(el => { el.value = ''; });
  });

  bindAutoCapitalize(qs('input[name="contact1Name"]', form));
  bindAutoCapitalize(qs('input[name="contact2Name"]', form));

  handleAsyncSubmit(form, {
    onSubmit: async fd => {
      const title = (fd.get('title') || '').trim();
      if (!title) return;
      const source = fd.get('source');

      const contact1Id = await Contacts.upsertFromFields(contact1ExistingId, {
        name: fd.get('contact1Name'), phone: fd.get('contact1Phone'), email: fd.get('contact1Email'),
        address: fd.get('contact1Address'), leadSource: source,
        bestTimeToContact: fd.get('contact1BestTime'), noteIfNew: `Linked lead: ${title}`,
      });
      const contact2Id = secondBlock.hidden ? null : await Contacts.upsertFromFields(contact2ExistingId, {
        name: fd.get('contact2Name'), phone: fd.get('contact2Phone'), email: fd.get('contact2Email'),
        address: fd.get('contact2Address'), leadSource: source,
        bestTimeToContact: fd.get('contact2BestTime'), noteIfNew: `Linked lead: ${title}`,
      });

      const data = {
        title, stage: fd.get('stage'), value: fd.get('value'), revenuePercent: fd.get('revenuePercent'),
        projectType: fd.get('projectType'), source, notes: fd.get('notes'),
        contactId: contact1Id, secondaryContactId: contact2Id,
      };
      const saved = existing ? await Leads.update(existing.id, data) : await Leads.create(data);
      Modal.close();
      toast(existing ? 'Lead updated' : 'Lead created');
      if (onSaved) onSaved(saved);
    },
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
  handleAsyncSubmit(qs('#lost-form'), {
    onSubmit: async fd => {
      const reason = fd.get('reason') || 'Other';
      await Leads.markLost(lead.id, reason);
      Modal.close();
      toast('Lead marked as lost', 'warn');
      if (onDone) onDone();
    },
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
    Promise.resolve(onConfirm()).catch(err => {
      console.error(err);
      toast(err.message || 'Something went wrong — please try again.', 'warn');
    });
  });
}
