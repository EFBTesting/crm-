/* ==========================================================================
   Public lead-capture form — standalone page logic (lead-intake.html).

   Same architecture as questionnaire.js: this page is NOT part of the
   authenticated app — it never loads data.js/app.js/router.js, since a
   prospect filling this out has no login. It only needs config.js (for
   the Supabase client).

   On submit it writes two rows anonymously: a `contacts` row for the
   person, then a `leads` row referencing it — landing as a real "New
   Lead" at the front of the Pipeline, with source "Website". Both writes
   are scoped tight by RLS (see the "anon insert only" policies in
   supabase/schema.sql) so a raw POST bypassing this page's JS can't do
   anything beyond create one such lead.

   The contact id is generated client-side (crypto.randomUUID()) rather
   than read back from the insert, because anon has no SELECT policy on
   either table — same reasoning as questionnaire_responses never being
   read back either. ========================================================================== */

function liGenerateTitle(firstName, lastName, projectType) {
  const name = `${firstName} ${lastName}`.trim();
  return `${name} — ${projectType || 'Website Inquiry'}`;
}

function showLiError(message) {
  const errorEl = document.getElementById('li-error');
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function init() {
  const form = document.getElementById('li-form');

  if (!supabaseClient) {
    showLiError("This page isn't connected yet — please contact us directly.");
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    document.getElementById('li-error').hidden = true;

    const fd = new FormData(form);
    // Honeypot — a real visitor never sees or fills this field (hidden via
    // CSS). If it's filled, quietly pretend to succeed without writing
    // anything, rather than tipping the bot off that it was caught.
    if ((fd.get('company') || '').trim()) {
      form.hidden = true;
      document.getElementById('li-success').hidden = false;
      return;
    }

    const firstName = (fd.get('firstName') || '').trim();
    const lastName = (fd.get('lastName') || '').trim();
    const phone = (fd.get('phone') || '').trim();
    const email = (fd.get('email') || '').trim();
    if (!firstName || !lastName) return; // caught by `required` already
    if (!phone && !email) {
      showLiError('Please add a phone number or an email so we can reach you.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const projectType = fd.get('projectType') || '';
    const contactId = crypto.randomUUID();

    try {
      const { error: contactErr } = await supabaseClient.from('contacts').insert({
        id: contactId, first_name: firstName, last_name: lastName,
        phone, email, address: (fd.get('address') || '').trim(),
        lead_source: 'Website', best_time_to_contact: fd.get('bestTime') || '',
      });
      if (contactErr) throw contactErr;

      const { error: leadErr } = await supabaseClient.from('leads').insert({
        contact_id: contactId, title: liGenerateTitle(firstName, lastName, projectType),
        stage: 'new_lead', status: 'active', project_type: projectType,
        source: 'Website', urgency: fd.get('urgency') || '', notes: (fd.get('notes') || '').trim(),
      });
      if (leadErr) throw leadErr;

      form.hidden = true;
      document.getElementById('li-success').hidden = false;
    } catch (err) {
      console.error(err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      showLiError('Something went wrong submitting this — please try again, or contact us directly.');
    }
  });
}

init();
