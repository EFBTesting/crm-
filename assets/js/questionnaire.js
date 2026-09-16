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

/** Display numbers for every field, in document order: "1", "2", ... —
 *  except a field with `sub: true`, which continues the previous field's
 *  number as a lettered sub-question ("4a", "4b", ...) instead of
 *  advancing to the next number. Used for questions that are really
 *  parts of the one before them (e.g. a name/phone/email trio under one
 *  "who else is involved?" question). */
function qNumbers(set) {
  const numbers = [];
  let n = 0;
  let letter = 0;
  allFields(set).forEach(f => {
    if (f.sub && numbers.length) {
      letter += 1;
      numbers.push(`${n}${String.fromCharCode(96 + letter)}`);
    } else {
      n += 1;
      letter = 0;
      numbers.push(String(n));
    }
  });
  return numbers;
}

/** Short-answer fields render inline — "1. Full Name: ___" on one line —
 *  by default for text/tel/email; a field with a longer label can opt out
 *  with `inline: false` to stack instead, since a long question crammed
 *  onto one line with a short blank looks wrong. Everything else
 *  (choices, long answers) always stacks, label above the control, like
 *  the reference document. */
function qFieldHtml(field, number) {
  const req = field.required ? 'required' : '';
  const isInline = (field.type === 'text' || field.type === 'tel' || field.type === 'email') && field.inline !== false;
  const hintHtml = field.hint ? `<p class="qf-q__hint">${qEsc(field.hint)}</p>` : '';

  if (isInline) {
    return `<div class="qf-q">
      <div class="qf-q--inline">
        <label class="qf-q__label">${number}. ${qEsc(field.label)}${field.required ? ' <span class="qf-required">*</span>' : ''}:</label>
        <input class="qf-q__underline" type="${field.type}" name="${field.key}" ${req}>
      </div>
      ${hintHtml}
    </div>`;
  }

  let control;
  if (field.type === 'textarea' || field.type === 'text' || field.type === 'tel' || field.type === 'email') {
    control = field.type === 'textarea'
      ? `<textarea class="qf-q__underline" name="${field.key}" rows="2" ${req}></textarea>`
      : `<input class="qf-q__underline" type="${field.type}" name="${field.key}" ${req}>`;
  } else {
    // 'select' and 'radio' both render as a checkbox-style choice list —
    // a single answer either way, unless `multiple: true` lets more than
    // one be picked, in which case they're real (multi-select) checkboxes
    // instead of radios. `required` isn't applied to multi-select choices
    // since the browser would then demand every box be checked, not just
    // one — none of the current multi-select fields need it anyway.
    const inputType = field.multiple ? 'checkbox' : 'radio';
    control = `<div class="qf-q__choices">
      ${field.options.map(o => `<label><input type="${inputType}" name="${field.key}" value="${qEsc(o)}" ${field.multiple ? '' : req}> ${qEsc(o)}</label>`).join('')}
    </div>`;
  }
  return `<div class="qf-q">
    <div class="qf-q__label">${number}. ${qEsc(field.label)}${field.required ? ' <span class="qf-required">*</span>' : ''}</div>
    ${hintHtml}
    ${control}
  </div>`;
}

function qSectionHtml(section, numbers) {
  const fieldsHtml = section.fields.map((f, i) => qFieldHtml(f, numbers[i])).join('');
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

/** Saves in-progress answers to this browser's localStorage as the client
 *  types, so a closed tab or crashed browser doesn't cost them a from-
 *  scratch redo of a 10-15 minute form. Scoped to this exact lead+type link
 *  (not shared across different questionnaires) and cleared once submitted.
 *  Same-device/same-browser only — there's no server-side draft, since that
 *  would need opening up anonymous write access beyond a one-time insert. */
function draftStorageKey(leadId, type) {
  return `efb-questionnaire-draft:${leadId}:${type}`;
}
function saveDraft(leadId, type, formEl) {
  try {
    const fd = new FormData(formEl);
    const draft = {};
    for (const [key, value] of fd.entries()) {
      if (draft[key] === undefined) draft[key] = value;
      else if (Array.isArray(draft[key])) draft[key].push(value);
      else draft[key] = [draft[key], value];
    }
    localStorage.setItem(draftStorageKey(leadId, type), JSON.stringify(draft));
  } catch (e) { /* storage unavailable (private browsing, blocked, full) — just skip saving */ }
}
function loadDraft(leadId, type) {
  try {
    const raw = localStorage.getItem(draftStorageKey(leadId, type));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function clearDraft(leadId, type) {
  try { localStorage.removeItem(draftStorageKey(leadId, type)); } catch (e) { /* nothing to clean up */ }
}
/** Fills the form's fields from a saved draft — text/textarea/select by
 *  value, checkboxes/radios by matching value against whatever was saved
 *  (a plain string for one, an array for a multi-select group). Returns
 *  whether anything was actually applied, so the caller knows whether to
 *  show the "we restored your answers" notice. */
function applyDraft(formEl, draft) {
  if (!draft) return false;
  let applied = false;
  Object.keys(draft).forEach(key => {
    const saved = draft[key];
    const savedValues = Array.isArray(saved) ? saved : [saved];
    formEl.querySelectorAll(`[name="${CSS.escape(key)}"]`).forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = savedValues.includes(el.value);
      } else {
        el.value = savedValues[0] || '';
      }
      if ((savedValues[0] || '').length) applied = true;
    });
  });
  return applied;
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const leadId = (params.get('lead') || '').trim();
  const type = (params.get('type') || '').trim();
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

  const numbers = qNumbers(set);
  let idx = 0;
  const sectionsHtml = set.sections.map(section => {
    const html = qSectionHtml(section, numbers.slice(idx, idx + section.fields.length));
    idx += section.fields.length;
    return html;
  }).join('<hr class="qf-divider">');
  document.getElementById('q-sections').innerHTML = sectionsHtml;
  formEl.hidden = false;

  if (applyDraft(formEl, loadDraft(leadId, type))) {
    document.getElementById('q-draft-notice').hidden = false;
  }

  const saveStatusEl = document.getElementById('q-save-status');
  let saveStatusTimer = null;
  let draftSaveTimer = null;
  formEl.addEventListener('input', () => {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      saveDraft(leadId, type, formEl);
      saveStatusEl.hidden = false;
      clearTimeout(saveStatusTimer);
      saveStatusTimer = setTimeout(() => { saveStatusEl.hidden = true; }, 2000);
    }, 600);
  });
  // Checkbox/radio choices fire 'change' rather than a useful 'input' —
  // save those right away instead of waiting on the debounce above.
  formEl.addEventListener('change', e => {
    if (e.target.type === 'checkbox' || e.target.type === 'radio' || e.target.tagName === 'SELECT') saveDraft(leadId, type, formEl);
  });

  formEl.addEventListener('submit', async e => {
    e.preventDefault();
    document.getElementById('q-error').hidden = true;
    const submitBtn = formEl.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const fd = new FormData(formEl);
    const answers = {};
    allFields(set).forEach(f => {
      const raw = f.multiple ? fd.getAll(f.key).join(', ') : (fd.get(f.key) || '');
      // Trimmed so a required text/tel field can't be satisfied with
      // whitespace-only input — HTML5 `required` only rejects a truly
      // empty string for those input types.
      answers[f.key] = typeof raw === 'string' ? raw.trim() : raw;
    });
    const missingRequired = allFields(set).some(f => f.required && !answers[f.key]);
    if (missingRequired) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      showError('Please fill in all required fields.');
      return;
    }
    // Every set's Contact Details section already asks "First Name & Last
    // Name" (key: fullName) as its first, required question — reused here
    // as the respondent's identity instead of asking the same thing twice
    // in a row. Whoever is filling this out answers it as themselves, so
    // it doubles as "who is this" for free.
    const respondentName = (answers.fullName || '').trim();

    const { error } = await supabaseClient.from('questionnaire_responses').insert({
      lead_id: leadId, questionnaire_type: type, respondent_name: respondentName, answers,
    });

    if (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      showError('Something went wrong submitting this — please try again in a moment.');
      return;
    }

    clearDraft(leadId, type);
    formEl.hidden = true;
    document.getElementById('q-success').hidden = false;
  });
}

init();
