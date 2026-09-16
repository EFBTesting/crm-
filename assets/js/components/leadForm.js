/* ==========================================================================
   Lead / New Project add/edit form (split out of modal.js). Builds on
   Modal, handleAsyncSubmit, wireContactAutocomplete, and optionList, all
   defined there — load this file after modal.js.
   ========================================================================== */

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
  // Budget/revenue/target dates are usually still unknown at first contact
  // — collapsed by default on a brand-new lead so intake only shows what's
  // actually knowable off the first call. Always open for New Project
  // (already-contracted work — these are known) and for Edit whenever any
  // of them already have a value, so nothing entered earlier goes hidden.
  const hasMoreDetails = asProject || !!(existing?.value || existing?.revenuePercent || existing?.projectedStartDate || existing?.targetCompletionDate);

  Modal.open({
    title: existing ? 'Edit Lead' : (asProject ? 'New Project' : 'New Lead'),
    wide: true,
    bodyHtml: `
      <form id="lead-form" class="form-grid">
        <label class="field field--full"><span>${asProject ? 'Project name *' : 'Lead title *'}</span>
          <input name="title" required value="${esc(existing?.title)}" placeholder="Auto-fills from the contact's name — or type your own">
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
        <label class="field"><span>Project type</span>
          <select name="projectType">${optionList(PROJECT_TYPES, existing?.projectType, { blank: '— Unspecified —' })}</select>
        </label>
        <label class="field"><span>Timeline / Urgency</span>
          <select name="urgency">${optionList(URGENCY_OPTIONS, existing?.urgency, { blank: '— Unspecified —' })}</select>
        </label>
        <label class="field"><span>Lead source</span>
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

        <div class="field field--full">
          <button type="button" id="toggle-more-details-btn" class="link-btn-inline" ${hasMoreDetails ? 'hidden' : ''}>+ Add budget, revenue % &amp; target dates</button>
        </div>

        <div class="field field--full subform" id="more-details-block" ${hasMoreDetails ? '' : 'hidden'}>
          <div class="subform__head"><span>Budget &amp; Schedule</span></div>
          <div class="subform-grid">
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
          </div>
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

  const moreDetailsBlock = qs('#more-details-block', form);
  const toggleMoreDetailsBtn = qs('#toggle-more-details-btn', form);
  toggleMoreDetailsBtn.addEventListener('click', () => {
    moreDetailsBlock.hidden = false;
    toggleMoreDetailsBtn.hidden = true;
  });

  // Auto-fill the title from the primary contact's name (+ project type)
  // as they're typed, so intake doesn't stall on "what do I call this
  // lead" — still editable any time, and typing into Title directly stops
  // the auto-fill from overwriting it.
  if (!existing) {
    const titleInput = qs('input[name="title"]', form);
    const contact1NameInput = qs('input[name="contact1Name"]', form);
    const projectTypeSelect = qs('select[name="projectType"]', form);
    let titleAutoFilled = !titleInput.value;
    const autoFillTitle = () => {
      if (!titleAutoFilled) return;
      const name = contact1NameInput.value.trim();
      titleInput.value = name ? `${name} — ${projectTypeSelect.value || 'New Lead'}` : '';
    };
    titleInput.addEventListener('input', () => { titleAutoFilled = false; });
    contact1NameInput.addEventListener('input', autoFillTitle);
    projectTypeSelect.addEventListener('change', autoFillTitle);
  }

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
        projectType: fd.get('projectType'), source, urgency: fd.get('urgency'), notes: fd.get('notes'),
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
