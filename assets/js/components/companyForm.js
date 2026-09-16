/* ==========================================================================
   Company add/edit form (split out of modal.js). Builds on Modal,
   handleAsyncSubmit, and optionList, all defined there — load this file
   after modal.js.
   ========================================================================== */

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
