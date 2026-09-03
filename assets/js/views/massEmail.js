/* ==========================================================================
   Mass Email — compose one message and BCC it to any subset of Contacts at
   once (seasonal maintenance tips, announcements, anything). Like the
   Client Questionnaire's "Send" button, this opens the user's own email
   app via a mailto: link rather than sending anything itself — there's no
   backend of our own to send email from. Everyone selected goes in BCC on
   one message.
   ========================================================================== */

// Hoisted to module scope (like contacts.js's contactsQuery) so a
// realtime-triggered re-render (Router.rerender(), fired on ANY teammate's
// edit anywhere in the app) doesn't wipe an in-progress draft or selection.
let massEmailSubject = '';
let massEmailBody = '';
let massEmailExcluded = new Set(); // contact ids unchecked by the user — default is everyone included

function renderMassEmail(root) {
  function draw() {
    const allContacts = Contacts.all();
    const withEmail = allContacts.filter(c => c.email);
    const withoutEmailCount = allContacts.length - withEmail.length;
    const selectedCount = withEmail.filter(c => !massEmailExcluded.has(c.id)).length;

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Mass Email</h1>
          <p class="view-sub">Compose one message and send it to as many contacts as you want at once — seasonal maintenance tips, announcements, anything.</p>
        </div>
      </div>

      <div class="mass-email-layout">
        <div class="mass-email-compose">
          <label class="field"><span>Subject</span>
            <input type="text" id="me-subject" placeholder="e.g. Fall Home Maintenance Tips" value="${esc(massEmailSubject)}">
          </label>
          <label class="field"><span>Message</span>
            <textarea id="me-body" rows="12" placeholder="Write your message here...">${esc(massEmailBody)}</textarea>
          </label>
          <button type="button" class="btn btn--primary" id="me-compose-btn">Open in Email (${selectedCount} recipient${selectedCount === 1 ? '' : 's'})</button>
        </div>

        <div class="mass-email-recipients">
          <div class="mass-email-recipients__head">
            <strong>Recipients</strong>
            <div>
              <button type="button" class="link-btn-inline" id="me-select-all">Select all</button> ·
              <button type="button" class="link-btn-inline" id="me-select-none">Select none</button>
            </div>
          </div>
          <p class="muted mass-email-recipients__sub">${withEmail.length} contact${withEmail.length === 1 ? '' : 's'} ${withEmail.length === 1 ? 'has' : 'have'} an email on file${withoutEmailCount ? ` (${withoutEmailCount} skipped — no email on file)` : ''}.</p>
          <div class="mass-email-list">
            ${withEmail.length ? withEmail.map(c => `
              <label class="mass-email-row">
                <input type="checkbox" data-contact-id="${c.id}" ${massEmailExcluded.has(c.id) ? '' : 'checked'}>
                <span class="mass-email-row__name">${esc(fullName(c))}</span>
                <span class="mass-email-row__email muted">${esc(c.email)}</span>
              </label>`).join('') : `<p class="muted">No contacts have an email on file yet.</p>`}
          </div>
        </div>
      </div>
    `;

    wire(withEmail);
  }

  function updateComposeButton(withEmail) {
    const btn = qs('#me-compose-btn', root);
    if (!btn) return;
    const selectedCount = withEmail.filter(c => !massEmailExcluded.has(c.id)).length;
    btn.textContent = `Open in Email (${selectedCount} recipient${selectedCount === 1 ? '' : 's'})`;
  }

  function wire(withEmail) {
    qs('#me-subject', root).addEventListener('input', e => { massEmailSubject = e.target.value; });
    qs('#me-body', root).addEventListener('input', e => { massEmailBody = e.target.value; });

    qsa('[data-contact-id]', root).forEach(cb => {
      cb.addEventListener('change', e => {
        const id = e.target.dataset.contactId;
        if (e.target.checked) massEmailExcluded.delete(id); else massEmailExcluded.add(id);
        updateComposeButton(withEmail);
      });
    });

    qs('#me-select-all', root).addEventListener('click', () => {
      massEmailExcluded.clear();
      qsa('[data-contact-id]', root).forEach(cb => { cb.checked = true; });
      updateComposeButton(withEmail);
    });
    qs('#me-select-none', root).addEventListener('click', () => {
      withEmail.forEach(c => massEmailExcluded.add(c.id));
      qsa('[data-contact-id]', root).forEach(cb => { cb.checked = false; });
      updateComposeButton(withEmail);
    });

    qs('#me-compose-btn', root).addEventListener('click', () => composeMassEmail(withEmail));
  }

  // mailto: links have no guaranteed length limit, but in practice email
  // apps/OSes start truncating or refusing very long ones — there's no
  // reliable way to detect the exact cutoff for whatever app opens it, so
  // this is a conservative heads-up rather than a hard block.
  const SAFE_MAILTO_LENGTH = 1800;

  function composeMassEmail(withEmail) {
    const selected = withEmail.filter(c => !massEmailExcluded.has(c.id));
    if (!selected.length) { toast('Select at least one recipient first.', 'warn'); return; }
    if (!massEmailSubject.trim()) { toast('Add a subject before sending.', 'warn'); return; }

    const bcc = selected.map(c => c.email).join(',');
    const mailto = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(massEmailSubject)}&body=${encodeURIComponent(massEmailBody)}`;

    if (mailto.length > SAFE_MAILTO_LENGTH) {
      toast(`Heads up — with ${selected.length} recipients this is a long link and some email apps may cut it off. If it doesn't open cleanly, try sending to a smaller group at a time.`, 'warn');
    }
    window.location.href = mailto;
  }

  draw();
}
