/* ==========================================================================
   Client Questionnaire — standalone public page logic.

   This page is intentionally NOT part of the authenticated app — it
   loads independently of index.html/app.js/router.js/data.js, since a
   lead filling this out has no login. It only needs config.js (for the
   Supabase client) and questionnaire-questions.js (the question content).

   Reads `lead` and `type` from the URL query string, renders the
   matching question set (grouped into sections — see
   questionnaire-questions.js), and on submit inserts one row into
   questionnaire_responses — the only table an anonymous visitor can
   write to anywhere in this database (see supabase/schema.sql). A
   database trigger there handles marking it "answered" in
   questionnaire_status; this page has no access to that table at all,
   by design.

   Two things this page deliberately does NOT do, both because an
   anonymous visitor has no read access to anything else in the
   database: it can't greet the lead by name (can't read `leads`), and
   it can't warn "you already answered this" up front (can't read
   `questionnaire_responses` or `questionnaire_status`). Submitting twice
   just keeps the most recent answers — harmless, just not pre-checked.
   ========================================================================== */

function qEsc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** All fields across every section, in document order — used both for
 *  numbering questions continuously across section breaks and for
 *  collecting answers on submit. */
function allFields(set) {
  return set.sections.flatMap(s => s.fields);
}

/** Short-answer fields render inline — "1. Full Name: ___" on one line.
 *  Everything else (choices, long answers) puts the label on its own
 *  line above the control, like the reference document. */
function qFieldHtml(field, number) {
  const req = field.required ? 'required' : '';
  const isInline = field.type === 'text' || field.type === 'tel' || field.type === 'email';

  if (isInline) {
    return `<div class="qf-q qf-q--inline">
      <label class="qf-q__label">${number}. ${qEsc(field.label)}${field.required ? ' <span class="qf-required">*</span>' : ''}:</label>
      <input class="qf-q__underline" type="${field.type}" name="${field.key}" ${req}>
    </div>`;
  }

  let control;
  if (field.type === 'textarea') {
    control = `<textarea class="qf-q__underline" name="${field.key}" rows="2" ${req}></textarea>`;
  } else {
    // 'select' and 'radio' both render as a checkbox-style choice list —
    // still a single answer either way, 'select' just implies more options.
    control = `<div class="qf-q__choices">
      ${field.options.map(o => `<label><input type="radio" name="${field.key}" value="${qEsc(o)}" ${req}> ${qEsc(o)}</label>`).join('')}
    </div>`;
  }
  return `<div class="qf-q">
    <div class="qf-q__label">${number}. ${qEsc(field.label)}${field.required ? ' <span class="qf-required">*</span>' : ''}</div>
    ${control}
  </div>`;
}

function qSectionHtml(section, startNumber) {
  let n = startNumber;
  const fieldsHtml = section.fields.map(f => qFieldHtml(f, n++)).join('');
  return `<div class="qf-section">
    <h2 class="qf-section__heading">${qEsc(section.heading)}</h2>
    ${section.note ? `<p class="qf-section__note">${qEsc(section.note)}</p>` : ''}
    <div class="qf-section__fields">${fieldsHtml}</div>
  </div>`;
}

function showError(message) {
  const errorEl = document.getElementById('q-error');
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const leadId = params.get('lead');
  const type = params.get('type');
  const set = QUESTIONNAIRE_SETS[type];

  document.getElementById('q-loading').hidden = true;

  if (!leadId || !set) {
    showError('This questionnaire link looks incomplete or invalid. Please double-check the link, or contact us directly.');
    return;
  }
  if (!supabaseClient) {
    showError("This page isn't connected yet — please contact us directly.");
    return;
  }

  const formEl = document.getElementById('q-form');
  document.getElementById('q-title').textContent = set.title;
  document.getElementById('q-intro').textContent = set.intro;

  let n = 1;
  const sectionsHtml = set.sections.map(section => {
    const html = qSectionHtml(section, n);
    n += section.fields.length;
    return html;
  }).join('<hr class="qf-divider">');
  document.getElementById('q-sections').innerHTML = sectionsHtml;
  formEl.hidden = false;

  formEl.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = formEl.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const fd = new FormData(formEl);
    const answers = {};
    allFields(set).forEach(f => { answers[f.key] = fd.get(f.key) || ''; });

    const { error } = await supabaseClient.from('questionnaire_responses').insert({
      lead_id: leadId, questionnaire_type: type, answers,
    });

    if (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      showError('Something went wrong submitting this — please try again in a moment.');
      return;
    }

    formEl.hidden = true;
    document.getElementById('q-success').hidden = false;
  });
}

init();
