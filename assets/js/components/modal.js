/* ==========================================================================
   Generic modal shell + the add/edit forms for contacts, companies, leads.
   ========================================================================== */

const Modal = (() => {
  const root = () => qs('#modal-root');
  let cleanupFns = [];

  /** Registers a function to run when this modal closes — for anything a
   *  form wires up that outlives the modal's own DOM (a document-level
   *  listener, a flatpickr instance whose popup lives in document.body,
   *  etc). Wiping the modal's innerHTML alone doesn't clean those up. */
  function onClose(fn) { cleanupFns.push(fn); }

  function close() {
    const r = root();
    cleanupFns.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    cleanupFns = [];
    r.innerHTML = '';
    r.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  function open({ title, bodyHtml, wide = false }) {
    cleanupFns = []; // defensive — a prior modal should have already cleared these via close()
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

  return { open, close, onClose };
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

/** Duplicate-contact detection: as the person types a name or phone number,
 *  shows a dropdown of matching existing contacts underneath `anchorEl`;
 *  clicking one calls `fill(contact)` to autofill the form and `onPick(contact)`
 *  so the caller can bind the form to that contact's id (so saving updates
 *  them instead of creating a duplicate).
 *
 *  `onClear(reason)` fires to tell the caller to unbind — either because
 *  the name field was emptied out ('emptied'), or because a match had been
 *  picked and the name was then edited away from it ('diverged'). That
 *  second case matters: without it, picking a match and then typing over
 *  the name with someone else entirely would leave the form silently still
 *  bound to the original person, and saving would overwrite their real
 *  record instead of creating a new one. */
function wireContactAutocomplete({ anchorEl, nameGetter, phoneInput, excludeIds = [], triggerInputs, fill, onPick, onClear }) {
  const dropdown = el('<div class="autocomplete-dropdown" hidden></div>');
  anchorEl.appendChild(dropdown);
  let pickedName = null; // the exact trimmed name we filled in when a match was last picked

  function search() {
    const nameVal = nameGetter().trim();
    if (pickedName !== null && nameVal !== pickedName) {
      pickedName = null;
      if (onClear) onClear('diverged');
    } else if (!nameVal && onClear) {
      onClear('emptied');
    }
    const phoneVal = phoneInput ? phoneInput.value : '';
    const matches = Contacts.search(nameVal, phoneVal, { excludeIds });
    if (!matches.length) { dropdown.hidden = true; dropdown.innerHTML = ''; return; }
    dropdown.innerHTML = matches.map(c => `
      <div class="autocomplete-item" data-id="${esc(c.id)}">
        <strong>${esc(fullName(c))}</strong>
        <span>${esc(c.phone) || esc(c.email) || ''}</span>
      </div>`).join('');
    dropdown.hidden = false;
    qsa('.autocomplete-item', dropdown).forEach(item => {
      // mousedown (not click) fires before the input's blur, so the value
      // we're about to set doesn't get clobbered by a stray blur handler.
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        const contact = Contacts.get(item.dataset.id);
        if (!contact) return;
        fill(contact);
        pickedName = nameGetter().trim();
        dropdown.hidden = true;
        if (onPick) onPick(contact);
      });
    });
  }

  const debouncedSearch = debounce(search, 150);
  triggerInputs.filter(Boolean).forEach(inp => inp.addEventListener('input', debouncedSearch));
  const onDocMousedown = e => { if (!anchorEl.contains(e.target)) dropdown.hidden = true; };
  document.addEventListener('mousedown', onDocMousedown);
  if (typeof Modal !== 'undefined' && Modal.onClose) Modal.onClose(() => document.removeEventListener('mousedown', onDocMousedown));
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
        <div id="contact-match-banner" class="autocomplete-banner" hidden></div>
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
  const firstNameInput = qs('input[name="firstName"]', contactForm);
  const lastNameInput = qs('input[name="lastName"]', contactForm);
  const phoneInputEl = qs('input[name="phone"]', contactForm);
  const submitBtn = qs('button[type="submit"]', contactForm);
  bindAutoCapitalize(firstNameInput);
  bindAutoCapitalize(lastNameInput);
  bindAutoCapitalize(qs('input[name="title"]', contactForm));

  let matchedContactId = existing?.id ?? null;
  const matchBanner = qs('#contact-match-banner', contactForm);

  function fillContactFields(contact) {
    firstNameInput.value = contact.firstName || '';
    lastNameInput.value = contact.lastName || '';
    qs('input[name="email"]', contactForm).value = contact.email || '';
    phoneInputEl.value = contact.phone || '';
    qs('input[name="title"]', contactForm).value = contact.title || '';
    qs('select[name="companyId"]', contactForm).value = contact.companyId || '';
    qs('input[name="address"]', contactForm).value = contact.address || '';
    qs('select[name="leadSource"]', contactForm).value = contact.leadSource || '';
    qs('textarea[name="notes"]', contactForm).value = contact.notes || '';
  }
  function showMatchBanner(contact) {
    matchBanner.hidden = false;
    matchBanner.innerHTML = `<span>Matched existing contact: ${esc(fullName(contact))} — saving will update them, not create a duplicate.</span> <button type="button" id="undo-match-btn">Undo</button>`;
    qs('#undo-match-btn', matchBanner).addEventListener('click', () => {
      matchedContactId = existing?.id ?? null;
      matchBanner.hidden = true;
      submitBtn.textContent = existing ? 'Save changes' : 'Create contact';
    });
    submitBtn.textContent = 'Save changes to existing contact';
  }

  wireContactAutocomplete({
    anchorEl: lastNameInput.closest('label.field'),
    nameGetter: () => `${firstNameInput.value} ${lastNameInput.value}`,
    phoneInput: phoneInputEl,
    excludeIds: existing ? [existing.id] : [],
    triggerInputs: [firstNameInput, lastNameInput, phoneInputEl],
    fill: fillContactFields,
    onPick: contact => { matchedContactId = contact.id; showMatchBanner(contact); },
    onClear: () => { matchedContactId = existing?.id ?? null; matchBanner.hidden = true; submitBtn.textContent = existing ? 'Save changes' : 'Create contact'; },
  });

  handleAsyncSubmit(contactForm, {
    onSubmit: async fd => {
      const data = Object.fromEntries(fd.entries());
      if (!data.firstName.trim() || !data.lastName.trim()) return;
      const saved = matchedContactId ? await Contacts.update(matchedContactId, data) : await Contacts.create(data);
      Modal.close();
      toast(matchedContactId ? 'Contact updated' : 'Contact created');
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
  const asProject = !existing && !!defaults.asProject;
  let contact1ExistingId = existing?.contactId ?? defaults.contactId ?? null;
  let contact2ExistingId = existing?.secondaryContactId ?? null;
  const primaryContact = Contacts.get(contact1ExistingId);
  const secondaryContact = Contacts.get(contact2ExistingId);
  const hasSecondContact = !!secondaryContact;

  Modal.open({
    title: existing ? 'Edit Lead' : (asProject ? 'New Project' : 'New Lead'),
    wide: true,
    bodyHtml: `
      <form id="lead-form" class="form-grid">
        <label class="field field--full"><span>${asProject ? 'Project name *' : 'Lead title *'}</span>
          <input name="title" required value="${esc(existing?.title)}" placeholder="e.g. Kitchen Remodel — Smith Residence">
        </label>
        ${asProject ? `
        <label class="field"><span>Project stage</span>
          <select name="projectStage">${optionList(PROJECT_STAGES, PROJECT_STAGES[0].id, { valueKey: 'id', labelKey: 'label', blank: null })}</select>
        </label>
        ` : `
        <label class="field"><span>Stage</span>
          <select name="stage">${optionList(STAGES, existing?.stage ?? defaults.stage ?? STAGES[0].id, { valueKey: 'id', labelKey: 'label', blank: null })}</select>
        </label>
        `}
        <label class="field"><span>Target start</span>
          <input type="text" class="js-datepicker" name="projectedStartDate" value="${esc(existing?.projectedStartDate || '')}" placeholder="Select a date...">
        </label>
        <label class="field"><span>Target finish</span>
          <input type="text" class="js-datepicker" name="targetCompletionDate" value="${esc(existing?.targetCompletionDate || '')}" placeholder="Select a date...">
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
          <button type="submit" class="btn btn--primary">${existing ? 'Save changes' : (asProject ? 'Create project' : 'Create lead')}</button>
        </div>
      </form>`,
  });

  const form = qs('#lead-form');
  bindDatePickers(form);
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
    contact2ExistingId = null;
  });

  bindAutoCapitalize(qs('input[name="contact1Name"]', form));
  bindAutoCapitalize(qs('input[name="contact2Name"]', form));

  function wireLeadContactAutocomplete(prefix, getExistingId, setExistingId) {
    const nameInput = qs(`input[name="${prefix}Name"]`, form);
    const phoneInputEl = qs(`input[name="${prefix}Phone"]`, form);
    const emailInputEl = qs(`input[name="${prefix}Email"]`, form);
    const addressInputEl = qs(`input[name="${prefix}Address"]`, form);
    const bestTimeSelect = qs(`select[name="${prefix}BestTime"]`, form);
    wireContactAutocomplete({
      anchorEl: nameInput.closest('label.field'),
      nameGetter: () => nameInput.value,
      phoneInput: phoneInputEl,
      excludeIds: [getExistingId()].filter(Boolean),
      triggerInputs: [nameInput, phoneInputEl],
      fill: contact => {
        nameInput.value = fullName(contact);
        phoneInputEl.value = contact.phone || '';
        emailInputEl.value = contact.email || '';
        addressInputEl.value = contact.address || '';
        bestTimeSelect.value = contact.bestTimeToContact || '';
      },
      onPick: contact => { setExistingId(contact.id); toast(`Linked to existing contact: ${fullName(contact)}`); },
      onClear: reason => {
        setExistingId(null);
        if (reason === 'diverged') toast('Unlinked from that contact — saving will create a new one instead');
      },
    });
  }
  wireLeadContactAutocomplete('contact1', () => contact1ExistingId, v => { contact1ExistingId = v; });
  wireLeadContactAutocomplete('contact2', () => contact2ExistingId, v => { contact2ExistingId = v; });

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
        title, value: fd.get('value'), revenuePercent: fd.get('revenuePercent'),
        projectType: fd.get('projectType'), source, notes: fd.get('notes'),
        contactId: contact1Id, secondaryContactId: contact2Id,
        projectedStartDate: fd.get('projectedStartDate') || null, targetCompletionDate: fd.get('targetCompletionDate') || null,
      };
      // Only the Lead form (new or edit) has a "stage" field — the New
      // Project form has "projectStage" instead, set below.
      if (!asProject) data.stage = fd.get('stage');
      let saved;
      if (existing) saved = await Leads.update(existing.id, data);
      else if (asProject) saved = await Leads.createProject({ ...data, projectStage: fd.get('projectStage') });
      else saved = await Leads.create(data);
      Modal.close();
      toast(existing ? 'Lead updated' : (asProject ? 'Project created' : 'Lead created'));
      if (onSaved) onSaved(saved);
    },
  });
}

/* --------------------------- Permits form --------------------------- */

/** One row in the permits editor: a free-fill Type (Electrical, Building,
 *  Septic, whatever the job needs) + its own status. Township is shared
 *  across the whole project below, not per-permit. */
function permitRowHtml(permit) {
  return `
    <div class="permit-row">
      <input class="permit-row__type" placeholder="Permit type (Electrical, Building, ...)" value="${esc(permit?.type)}">
      <select class="permit-row__status">${optionList(PERMIT_STATUS_OPTIONS, permit?.status || 'not_submitted', { valueKey: 'id', labelKey: 'label', blank: null })}</select>
      <button type="button" class="permit-row__remove" title="Remove permit">✕</button>
    </div>`;
}

/** Only meaningful once a lead is won — shown from the lead detail page's
 *  Permits & Status panel. A project can have as many permits as it
 *  needs, added/removed freely. */
function openProjectMetaForm(lead, onSaved) {
  const permits = lead.permits && lead.permits.length ? lead.permits : [];
  Modal.open({
    title: 'Permits',
    wide: true,
    bodyHtml: `
      <form id="project-meta-form" class="form-grid">
        <label class="field"><span>Permit township</span>
          <input name="permitTownship" value="${esc(lead.permitTownship)}" placeholder="e.g. Springfield Township">
        </label>

        <div class="field field--full subform">
          <div class="subform__head"><span>Permits</span></div>
          <div id="permits-editor" class="permits-editor">
            ${permits.map(p => permitRowHtml(p)).join('')}
          </div>
          <button type="button" id="add-permit-btn" class="link-btn-inline">+ Add another permit</button>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-close="1">Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>`,
  });

  const form = qs('#project-meta-form');
  const editor = qs('#permits-editor', form);

  function wireRow(row) {
    bindAutoCapitalize(qs('.permit-row__type', row));
    qs('.permit-row__remove', row).addEventListener('click', () => row.remove());
  }
  qsa('.permit-row', editor).forEach(wireRow);

  qs('#add-permit-btn', form).addEventListener('click', () => {
    editor.insertAdjacentHTML('beforeend', permitRowHtml(null));
    const newRow = editor.lastElementChild;
    wireRow(newRow);
    qs('.permit-row__type', newRow).focus();
  });

  handleAsyncSubmit(form, {
    onSubmit: async fd => {
      const newPermits = qsa('.permit-row', editor)
        .map(row => ({ type: qs('.permit-row__type', row).value.trim(), status: qs('.permit-row__status', row).value }))
        .filter(p => p.type);
      const saved = await Leads.updateProjectMeta(lead.id, {
        permits: newPermits, permitTownship: fd.get('permitTownship'),
      });
      Modal.close();
      toast('Permits updated');
      if (onSaved) onSaved(saved);
    },
  });
}

/* --------------------------- Pre-Con notes form --------------------------- */

/** Target Start/Finish now live on the Lead form (and are editable inline
 *  on Project Tracking / Project Calendar), and Team is an inline dropdown
 *  on Project Calendar — so this popup is just Notes now. */
function openPreconMetaForm(lead, onSaved) {
  Modal.open({
    title: 'Pre-Construction Notes',
    bodyHtml: `
      <form id="precon-meta-form" class="form-grid">
        <label class="field field--full"><span>Notes</span>
          <textarea name="preconNotes" rows="4" placeholder="Anything worth flagging about this project's pre-con work...">${esc(lead.preconNotes || '')}</textarea>
        </label>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-close="1">Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>`,
  });

  const form = qs('#precon-meta-form');
  handleAsyncSubmit(form, {
    onSubmit: async fd => {
      const saved = await Leads.updatePreconMeta(lead.id, { preconNotes: fd.get('preconNotes') });
      Modal.close();
      toast('Notes updated');
      if (onSaved) onSaved(saved);
    },
  });
}

/* --------------------------- Lost reason prompt --------------------------- */

function openLostReasonPrompt(lead, onDone) {
  const isProject = !!lead.wonAt;
  Modal.open({
    title: isProject ? 'Mark project as lost' : 'Mark lead as lost',
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
      toast(isProject ? 'Project marked as lost' : 'Lead marked as lost', 'warn');
      if (onDone) onDone();
    },
  });
}

/* --------------------------- Questionnaire responses --------------------------- */

/** Read-only view of a lead's submitted questionnaire answers — shown
 *  from the Client Questionnaire page by clicking a lead's name, once
 *  they've answered at least one. Question labels come from
 *  QUESTIONNAIRE_SETS (assets/js/questionnaire-questions.js) so this
 *  always matches whatever the public form actually asked.
 *
 *  Opens on a plain picker — one row per questionnaire that's actually
 *  been answered — with no answers shown yet, even if there's only one
 *  row. Clicking a row is what reveals that questionnaire's full answer
 *  list; "← Back to questionnaires" returns to the picker. */
function openQuestionnaireResponses(lead) {
  if (!lead) return;

  const sections = [
    { type: 'quick', label: 'Pre-Construction' },
    { type: 'construction', label: 'Construction' },
  ].map(s => ({ ...s, response: Questionnaires.latestResponse(lead.id, s.type) }))
    .filter(s => s.response);
  if (!sections.length) return;

  function pickerHtml() {
    return `<div data-view="picker">
      ${sections.map(s => `
        <button type="button" class="q-response-pick" data-view-response="${s.type}">
          <span>${esc(s.label)} Questionnaire</span>
          <span class="muted">Submitted ${fmtDateTime(s.response.submittedAt)}</span>
        </button>`).join('')}
    </div>`;
  }

  function detailHtml(s) {
    const fields = QUESTIONNAIRE_SETS[s.type].sections.flatMap(sec => sec.fields);
    return `<div class="q-response-section" data-pane="${s.type}" hidden>
      <button type="button" class="q-response-back" data-back-to-picker>← Back to questionnaires</button>
      <div class="q-response-section__head">
        <h3>${esc(s.label)} Questionnaire</h3>
        <span class="muted">Submitted ${fmtDateTime(s.response.submittedAt)}</span>
      </div>
      <dl class="q-response-list">
        ${fields.map(f => `
          <div>
            <dt>${esc(f.label)}</dt>
            <dd>${esc(s.response.answers[f.key]) || '—'}</dd>
          </div>`).join('')}
      </dl>
    </div>`;
  }

  const r = Modal.open({
    title: `${lead.title} — Questionnaire Responses`,
    wide: true,
    bodyHtml: `
      ${pickerHtml()}
      ${sections.map(detailHtml).join('')}
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-close="1">Close</button>
      </div>`,
  });

  r.querySelectorAll('[data-view-response]').forEach(btn => {
    btn.addEventListener('click', () => {
      r.querySelector('[data-view="picker"]').hidden = true;
      r.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== btn.dataset.viewResponse; });
    });
  });
  r.querySelectorAll('[data-back-to-picker]').forEach(btn => {
    btn.addEventListener('click', () => {
      r.querySelectorAll('[data-pane]').forEach(p => { p.hidden = true; });
      r.querySelector('[data-view="picker"]').hidden = false;
    });
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
