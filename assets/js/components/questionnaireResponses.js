/* ==========================================================================
   Questionnaire responses viewer + PDF export (split out of modal.js).
   Builds on Modal, defined there — load this file after modal.js.
   ========================================================================== */

/** Read-only view of a lead's submitted questionnaire answers — shown
 *  from the Client Questionnaire page by clicking a lead's name, once
 *  they've answered at least one. Question labels come from
 *  QUESTIONNAIRE_SETS (assets/js/questionnaire-questions.js) so this
 *  always matches whatever the public form actually asked.
 *
 *  Shows EVERY submitted response for this lead, not just the newest per
 *  type — the same link can go to more than one person for the same job
 *  (a spouse, a parent, a business partner), and each submission is kept
 *  as its own row, labeled by respondent_name (pulled from the "Your
 *  First Name & Last Name" question at the top of each questionnaire —
 *  see questionnaire.js) so nothing gets silently overwritten. Note:
 *  respondent_name isn't populated by real submissions yet — that half
 *  lands once the database has the column (see supabase/schema.sql) —
 *  existing/new responses just show as "Unknown respondent" until then,
 *  but are still each their own row and each individually printable
 *  below.
 *
 *  Opens on a plain picker — one row per response — with no answers shown
 *  yet, even if there's only one row. Clicking a row reveals that
 *  person's full answer list; "← Back to questionnaires" returns to the
 *  picker. */
function openQuestionnaireResponses(lead) {
  if (!lead) return;

  const typeLabels = { quick: 'Pre-Construction', construction: 'Construction' };
  const responses = Questionnaires.responsesFor(lead.id); // newest first, across both types
  if (!responses.length) return;

  function respondentLabel(resp) {
    return resp.respondentName || 'Unknown respondent'; // old rows submitted before this field existed
  }

  function pickerHtml() {
    return `<div data-view="picker">
      ${responses.map(resp => `
        <button type="button" class="q-response-pick" data-view-response="${resp.id}">
          <span>${esc(typeLabels[resp.questionnaireType] || resp.questionnaireType)} Questionnaire — ${esc(respondentLabel(resp))}</span>
          <span class="muted">Submitted ${fmtDateTime(resp.submittedAt)}</span>
        </button>`).join('')}
    </div>`;
  }

  function detailHtml(resp) {
    const set = QUESTIONNAIRE_SETS[resp.questionnaireType];
    return `<div class="q-response-section" data-pane="${resp.id}" hidden>
      <button type="button" class="q-response-back" data-back-to-picker>← Back to questionnaires</button>
      <div class="q-response-section__head">
        <h3>${esc(typeLabels[resp.questionnaireType] || resp.questionnaireType)} Questionnaire — ${esc(respondentLabel(resp))}</h3>
        <span class="muted">Submitted ${fmtDateTime(resp.submittedAt)}</span>
      </div>
      <button type="button" class="btn btn--ghost btn--sm mb-sm" data-print-response="${resp.id}">🖨️ Print / Save as PDF</button>
      ${set.sections.map(sec => questionnaireResponseSectionHtml(sec, resp)).join('<hr class="qf-divider">')}
    </div>`;
  }

  const modalRoot = Modal.open({
    title: `${lead.title} — Questionnaire Responses`,
    wide: true,
    bodyHtml: `
      ${pickerHtml()}
      ${responses.map(detailHtml).join('')}
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-close="1">Close</button>
      </div>`,
  });

  modalRoot.querySelectorAll('[data-view-response]').forEach(btn => {
    btn.addEventListener('click', () => {
      modalRoot.querySelector('[data-view="picker"]').hidden = true;
      modalRoot.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== btn.dataset.viewResponse; });
    });
  });
  modalRoot.querySelectorAll('[data-back-to-picker]').forEach(btn => {
    btn.addEventListener('click', () => {
      modalRoot.querySelectorAll('[data-pane]').forEach(p => { p.hidden = true; });
      modalRoot.querySelector('[data-view="picker"]').hidden = false;
    });
  });
  modalRoot.querySelectorAll('[data-print-response]').forEach(btn => {
    btn.addEventListener('click', () => {
      const resp = responses.find(r => r.id === btn.dataset.printResponse);
      if (resp) printQuestionnaireResponse(lead, resp);
    });
  });
}

/** One question set section (heading + optional instructional note +
 *  its questions), rendered identically wherever a submitted response is
 *  shown — the CRM's Questionnaire Responses view and the printed PDF
 *  both call this, so the two can't drift apart. Mirrors the section
 *  structure the public form itself uses (questionnaire.js's
 *  qSectionHtml) — same headings, same qf-divider between sections —
 *  just with each question's answer in the boxed q-response-item style
 *  instead of a blank line to fill in. */
function questionnaireResponseSectionHtml(section, resp) {
  return `
    <h3 class="qf-section__heading">${esc(section.heading)}</h3>
    ${section.note ? `<p class="qf-section__note">${esc(section.note)}</p>` : ''}
    <dl class="q-response-list">
      ${section.fields.map(f => `
        <div class="q-response-item">
          <dt>${esc(f.label)}</dt>
          <dd>${esc(resp.answers[f.key]) || '—'}</dd>
        </div>`).join('')}
    </dl>`;
}

/** Renders one response into a dedicated, unconstrained-height print
 *  layout (#print-root, styled in styles.css under @media print) and
 *  triggers the browser's print dialog — "Save as PDF" there is what
 *  actually produces the file. Deliberately NOT printed straight out of
 *  the open modal: the modal's body scrolls/clips, which would cut off
 *  any answers below the fold instead of flowing across pages properly. */
function printQuestionnaireResponse(lead, resp) {
  const typeLabel = resp.questionnaireType === 'quick' ? 'Pre-Construction' : 'Construction';
  const set = QUESTIONNAIRE_SETS[resp.questionnaireType];
  let printRoot = qs('#print-root');
  if (!printRoot) {
    printRoot = el('<div id="print-root"></div>');
    document.body.appendChild(printRoot);
  }
  printRoot.innerHTML = `
    <div class="print-sheet">
      <img src="assets/img/logo-green.png" alt="Erwin Forrest Builders" class="print-logo">
      <h1>${esc(typeLabel)} Questionnaire</h1>
      <p class="print-meta"><strong>${esc(lead.title)}</strong> — ${esc(resp.respondentName || 'Unknown respondent')}<br>Submitted ${fmtDateTime(resp.submittedAt)}</p>
      ${set.sections.map(sec => questionnaireResponseSectionHtml(sec, resp)).join('<hr class="qf-divider">')}
    </div>`;

  // Chrome/Edge suggest the page's <title> as the "Save as PDF" filename
  // — swap it to include the project and respondent's name for the
  // moment the print dialog is open, then restore the normal tab title
  // right after. Both included (not just the name) so printing several
  // jobs' responses doesn't produce indistinguishable same-named files.
  const stripForFilename = s => (s || '').replace(/[\\/:*?"<>|]/g, '');
  const originalTitle = document.title;
  document.title = `${originalTitle} — ${stripForFilename(lead.title)} — ${stripForFilename(resp.respondentName) || 'Unknown respondent'}`;
  window.print();
  document.title = originalTitle;
}
