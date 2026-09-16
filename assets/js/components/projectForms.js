/* ==========================================================================
   Small popups shown from the Lead Detail page once a lead is a project:
   Permits, Pre-Construction Notes, and the Mark Lost reason prompt (used
   for both leads and projects). Split out of modal.js — builds on Modal
   and handleAsyncSubmit, defined there, so load this file after modal.js.
   ========================================================================== */

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
