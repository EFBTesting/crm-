/* ==========================================================================
   Contact add/edit form (split out of modal.js). Builds on Modal,
   handleAsyncSubmit, wireContactAutocomplete, and optionList, all defined
   there — load this file after modal.js.
   ========================================================================== */

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
