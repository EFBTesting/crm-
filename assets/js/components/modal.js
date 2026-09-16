/* ==========================================================================
   Generic modal shell + shared form helpers (async submit wiring, the
   contact-autocomplete dropdown, <option> list rendering) + the generic
   confirm dialog. The actual per-entity forms (contact/company/lead,
   project popups, questionnaire responses) live in their own files
   alongside this one — see assets/js/components/ — since they all build on
   what's defined here.
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
    // Run (not just drop) whatever's still queued — a prior modal should
    // already have cleared these via close(), but if one ever opens while
    // another is still open, this way its flatpickr instances/listeners
    // still get cleaned up instead of leaking silently.
    cleanupFns.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    cleanupFns = [];
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
