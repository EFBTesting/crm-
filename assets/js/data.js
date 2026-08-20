/* ==========================================================================
   Erwin Forest Builders CRM — Data Layer
   Backed by Supabase (real Postgres, shared across every device/teammate).
   Reads stay synchronous (served from an in-memory cache); writes are
   async and update the cache + Supabase together. A realtime subscription
   keeps every open tab in sync when teammates make changes elsewhere.
   ========================================================================== */

/** The 5 active pipeline stages, in order. "Lost" is tracked separately
 *  (a lead can be marked lost from any stage) so it doesn't eat one of the
 *  five requested stages. */
const STAGES = [
  { id: 'new_lead', label: 'New Lead', description: 'Inbound inquiry captured — phone, web form, referral, walk-in.' },
  { id: 'site_visit', label: 'Site Visit Scheduled', description: 'Qualified and an on-site assessment is booked or complete.' },
  { id: 'estimate_sent', label: 'Estimate Sent', description: 'A bid / proposal has been delivered to the prospect.' },
  { id: 'negotiation', label: 'Negotiation', description: 'Discussing scope, price, timeline, or contract terms.' },
  { id: 'won', label: 'Won – Contract Signed', description: 'Contract signed. Converted to an active job.' },
];

const LEAD_SOURCES = ['Referral', 'Website', 'Google Search', 'Angi / HomeAdvisor', 'Facebook / Instagram', 'Repeat Client', 'Signage / Drive-by', 'Trade Show', 'Other'];
const PROJECT_TYPES = ['Kitchen Remodel', 'Bathroom Remodel', 'Home Addition', 'New Custom Build', 'Deck / Outdoor Living', 'Roofing', 'Whole-Home Renovation', 'Commercial Build-Out', 'Other'];
const COMPANY_TYPES = ['Property Management', 'Developer', 'Architect / Design Partner', 'General Contractor Partner', 'Commercial Client', 'Supplier / Vendor', 'Other'];
const LOST_REASONS = ['Price too high', 'Chose another contractor', 'Timeline mismatch', 'Project postponed', 'Went unresponsive', 'Scope changed / no longer needed', 'Other'];
const BEST_TIME_OPTIONS = ['Morning', 'Evening', 'Night', 'Whenever'];

/** Project Tracking stages — once a lead is won it becomes a "project" and
 *  moves through these instead (separate from the sales STAGES above). */
const PROJECT_STAGES = [
  { id: 'design', label: 'Design', description: 'Plans, selections, and permitting are being worked out.' },
  { id: 'pre_con', label: 'Pre-Construction', description: 'Scheduling, ordering materials, prepping the site.' },
  { id: 'construction', label: 'Construction', description: 'Crews are actively building.' },
  { id: 'completed', label: 'Completed', description: 'Job finished and closed out.' },
];

/** Overall health of a project — separate from what stage it's in. */
const PROJECT_STATUS_OPTIONS = [
  { id: 'on_track', label: 'On Track' },
  { id: 'delayed', label: 'Delayed' },
];

/** Where a project's permit stands — only meaningful once it's a project. */
const PERMIT_STATUS_OPTIONS = [
  { id: 'not_submitted', label: 'Not Submitted' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'approved', label: 'Approved' },
];

function stageLabel(stageId) {
  const s = STAGES.find(s => s.id === stageId);
  return s ? s.label : stageId;
}
function projectStageLabel(stageId) {
  const s = PROJECT_STAGES.find(s => s.id === stageId);
  return s ? s.label : stageId;
}
function projectStatusLabel(id) {
  const s = PROJECT_STATUS_OPTIONS.find(s => s.id === id);
  return s ? s.label : (id || 'On Track');
}
function permitStatusLabel(id) {
  const s = PERMIT_STATUS_OPTIONS.find(s => s.id === id);
  return s ? s.label : (id || 'Not Submitted');
}

/* ---- in-memory cache, kept in sync with Supabase ---- */
const cache = { contacts: [], companies: [], leads: [] };

/** Set by app.js — called whenever a remote change (from another tab or
 *  teammate) updates the cache, so the current view can redraw. */
let notifyChange = () => {};
function onDataChange(fn) { notifyChange = fn; }

function mustClient() {
  if (!supabaseClient) throw new Error('Supabase is not configured yet (see assets/js/config.js).');
  return supabaseClient;
}

/* =========================== Row <-> object mapping =========================== */

function contactFromRow(r) {
  return {
    id: r.id, firstName: r.first_name || '', lastName: r.last_name || '', email: r.email || '',
    phone: r.phone || '', title: r.title || '', companyId: r.company_id, address: r.address || '',
    leadSource: r.lead_source || '', bestTimeToContact: r.best_time_to_contact || '', notes: r.notes || '',
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function contactToRow(d) {
  return {
    first_name: (d.firstName || '').trim(), last_name: (d.lastName || '').trim(), email: (d.email || '').trim(),
    phone: (d.phone || '').trim(), title: (d.title || '').trim(), company_id: d.companyId || null,
    address: (d.address || '').trim(), lead_source: d.leadSource || '', best_time_to_contact: d.bestTimeToContact || '',
    notes: (d.notes || '').trim(),
  };
}

function companyFromRow(r) {
  return {
    id: r.id, name: r.name || '', type: r.type || '', phone: r.phone || '', website: r.website || '',
    address: r.address || '', primaryContactName: r.primary_contact_name || '', notes: r.notes || '',
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function companyToRow(d) {
  return {
    name: (d.name || '').trim(), type: d.type || '', phone: (d.phone || '').trim(), website: (d.website || '').trim(),
    address: (d.address || '').trim(), primary_contact_name: (d.primaryContactName || '').trim(), notes: (d.notes || '').trim(),
  };
}

function leadFromRow(r) {
  return {
    id: r.id, title: r.title || '', contactId: r.contact_id, secondaryContactId: r.secondary_contact_id,
    companyId: r.company_id, stage: r.stage, status: r.status, value: Number(r.value) || 0,
    revenuePercent: r.revenue_percent === null || r.revenue_percent === undefined ? '' : Number(r.revenue_percent),
    projectType: r.project_type || '', source: r.source || '', notes: r.notes || '', lostReason: r.lost_reason || '',
    history: r.history || [], projectStage: r.project_stage || null,
    projectStatus: r.project_status || null, permitStatus: r.permit_status || null, permitTownship: r.permit_township || '',
    wonAt: r.won_at, lostAt: r.lost_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function leadToRow(d) {
  const row = {
    title: (d.title || '').trim(), contact_id: d.contactId || null, secondary_contact_id: d.secondaryContactId || null,
    company_id: d.companyId || null, value: Number(d.value) || 0,
    revenue_percent: d.revenuePercent === '' || d.revenuePercent === undefined || d.revenuePercent === null ? null : Number(d.revenuePercent),
    project_type: d.projectType || '', source: d.source || '', notes: (d.notes || '').trim(),
  };
  if (d.stage !== undefined) row.stage = d.stage;
  if (d.status !== undefined) row.status = d.status;
  if (d.lostReason !== undefined) row.lost_reason = d.lostReason;
  if (d.history !== undefined) row.history = d.history;
  if (d.projectStage !== undefined) row.project_stage = d.projectStage;
  if (d.projectStatus !== undefined) row.project_status = d.projectStatus;
  if (d.permitStatus !== undefined) row.permit_status = d.permitStatus;
  if (d.permitTownship !== undefined) row.permit_township = (d.permitTownship || '').trim();
  if (d.wonAt !== undefined) row.won_at = d.wonAt;
  if (d.lostAt !== undefined) row.lost_at = d.lostAt;
  return row;
}

/** Revenue dollar amount derived live from budget × revenue%. Not stored
 *  separately — recomputed on the fly so it never drifts from the budget. */
function revenueAmount(lead) {
  if (!lead || lead.revenuePercent === '' || lead.revenuePercent === null || lead.revenuePercent === undefined) return null;
  return (Number(lead.value) || 0) * (Number(lead.revenuePercent) || 0) / 100;
}

/* =========================== Cache boot + realtime =========================== */

async function loadAllData() {
  const client = mustClient();
  const [companiesRes, contactsRes, leadsRes] = await Promise.all([
    client.from('companies').select('*'),
    client.from('contacts').select('*'),
    client.from('leads').select('*'),
  ]);
  if (companiesRes.error) throw companiesRes.error;
  if (contactsRes.error) throw contactsRes.error;
  if (leadsRes.error) throw leadsRes.error;
  cache.companies = companiesRes.data.map(companyFromRow);
  cache.contacts = contactsRes.data.map(contactFromRow);
  cache.leads = leadsRes.data.map(leadFromRow);
}

const debouncedNotify = debounce(() => notifyChange(), 250);

function subscribeRealtime() {
  const client = mustClient();
  client
    .channel('crm-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => refreshTableThen('companies'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => refreshTableThen('contacts'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => refreshTableThen('leads'))
    .subscribe();
}

async function refreshTableThen(table) {
  try {
    const client = mustClient();
    const { data, error } = await client.from(table).select('*');
    if (error) throw error;
    if (table === 'companies') cache.companies = data.map(companyFromRow);
    if (table === 'contacts') cache.contacts = data.map(contactFromRow);
    if (table === 'leads') cache.leads = data.map(leadFromRow);
    debouncedNotify();
  } catch (e) {
    console.error('Realtime refresh failed for', table, e);
  }
}

/* =========================== Contacts =========================== */

const Contacts = {
  all() {
    return [...cache.contacts].sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  },
  get(id) {
    return cache.contacts.find(c => c.id === id) || null;
  },
  async create(data) {
    const { data: row, error } = await mustClient().from('contacts').insert(contactToRow(data)).select().single();
    if (error) throw error;
    const contact = contactFromRow(row);
    cache.contacts.push(contact);
    return contact;
  },
  async update(id, data) {
    const { data: row, error } = await mustClient().from('contacts').update(contactToRow(data)).eq('id', id).select().single();
    if (error) throw error;
    const contact = contactFromRow(row);
    const i = cache.contacts.findIndex(c => c.id === id);
    if (i !== -1) cache.contacts[i] = contact;
    return contact;
  },
  async remove(id) {
    const { error } = await mustClient().from('contacts').delete().eq('id', id);
    if (error) throw error;
    cache.contacts = cache.contacts.filter(c => c.id !== id);
    cache.leads.forEach(l => {
      if (l.contactId === id) l.contactId = null;
      if (l.secondaryContactId === id) l.secondaryContactId = null;
    });
  },
  leadsFor(contactId) {
    return cache.leads.filter(l => l.contactId === contactId || l.secondaryContactId === contactId);
  },
  /** A contact's overall status, derived live from their linked leads —
   *  never stored, so it's always correct the moment a lead changes:
   *  - 'open' if any linked lead is currently active
   *  - otherwise 'previous' (their most recently updated lead's outcome,
   *    won or lost) — once a lead is reopened it becomes active again,
   *    which flips this straight back to 'open'
   *  - 'none' if they have no leads at all */
  statusFor(contactId) {
    const leads = this.leadsFor(contactId);
    if (!leads.length) return { kind: 'none' };
    const active = leads.filter(l => l.status === 'active');
    if (active.length) return { kind: 'open', count: active.length };
    const mostRecent = [...leads].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
    return { kind: 'previous', outcome: mostRecent.status };
  },
  /** Best-match search for duplicate detection — used by the "did you mean
   *  this existing contact?" autocomplete on the lead and contact forms. */
  search(nameQuery, phoneQuery, { excludeIds = [] } = {}) {
    const name = (nameQuery || '').trim().toLowerCase();
    const phone = (phoneQuery || '').replace(/\D/g, '');
    if (name.length < 2 && phone.length < 3) return [];
    return this.all()
      .filter(c => !excludeIds.includes(c.id))
      .filter(c => {
        const nameMatch = name.length >= 2 && fullName(c).toLowerCase().includes(name);
        const phoneMatch = phone.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(phone);
        return nameMatch || phoneMatch;
      })
      .slice(0, 6);
  },
  /** Create or update a contact from a lead form's inline name/phone/email
   *  fields — this is how leads avoid making you re-enter contact info that
   *  belongs on a Contact record. Returns the contact id, or null if no
   *  name was given (the fields were left blank). */
  async upsertFromFields(existingId, { name, phone, email, address, leadSource, bestTimeToContact, noteIfNew }) {
    const trimmedName = (name || '').trim();
    if (!trimmedName && !existingId) return null;
    if (!trimmedName && existingId) {
      // Name was cleared out — leave the existing contact record alone.
      return existingId;
    }
    const [firstName, ...rest] = trimmedName.split(/\s+/);
    const lastName = rest.join(' ');
    if (existingId) {
      const existing = this.get(existingId);
      const saved = await this.update(existingId, { ...existing, firstName, lastName, phone, email, address, leadSource, bestTimeToContact });
      return saved.id;
    }
    const saved = await this.create({ firstName, lastName, phone, email, address, leadSource, bestTimeToContact, notes: noteIfNew || '' });
    return saved.id;
  },
};

/* =========================== Companies =========================== */

const Companies = {
  all() {
    return [...cache.companies].sort((a, b) => a.name.localeCompare(b.name));
  },
  get(id) {
    return cache.companies.find(c => c.id === id) || null;
  },
  async create(data) {
    const { data: row, error } = await mustClient().from('companies').insert(companyToRow(data)).select().single();
    if (error) throw error;
    const company = companyFromRow(row);
    cache.companies.push(company);
    return company;
  },
  async update(id, data) {
    const { data: row, error } = await mustClient().from('companies').update(companyToRow(data)).eq('id', id).select().single();
    if (error) throw error;
    const company = companyFromRow(row);
    const i = cache.companies.findIndex(c => c.id === id);
    if (i !== -1) cache.companies[i] = company;
    return company;
  },
  async remove(id) {
    const { error } = await mustClient().from('companies').delete().eq('id', id);
    if (error) throw error;
    cache.companies = cache.companies.filter(c => c.id !== id);
    cache.contacts.forEach(ct => { if (ct.companyId === id) ct.companyId = null; });
    cache.leads.forEach(l => { if (l.companyId === id) l.companyId = null; });
  },
  contactsFor(companyId) {
    return cache.contacts.filter(c => c.companyId === companyId);
  },
  leadsFor(companyId) {
    return cache.leads.filter(l => l.companyId === companyId);
  },
};

/* =========================== Leads =========================== */

const Leads = {
  all() {
    return [...cache.leads].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },
  get(id) {
    return cache.leads.find(l => l.id === id) || null;
  },
  byStage(stageId) {
    return cache.leads.filter(l => l.stage === stageId && l.status === 'active');
  },
  active() {
    return cache.leads.filter(l => l.status === 'active');
  },
  /** Won leads that have become projects — what Project Tracking shows. */
  projects() {
    return cache.leads.filter(l => l.status === 'won');
  },
  byProjectStage(stageId) {
    return this.projects().filter(l => (l.projectStage || PROJECT_STAGES[0].id) === stageId);
  },
  async create(data) {
    const stage = data.stage || STAGES[0].id;
    const history = [{ at: new Date().toISOString(), event: 'created', detail: `Lead created in stage "${stageLabel(stage)}"` }];
    const row = leadToRow({ ...data, stage, status: 'active', history });
    const { data: saved, error } = await mustClient().from('leads').insert(row).select().single();
    if (error) throw error;
    const lead = leadFromRow(saved);
    cache.leads.push(lead);
    return lead;
  },
  async update(id, data) {
    return this._patch(id, data);
  },
  async moveStage(id, stageId) {
    const l = this.get(id);
    if (!l) return null;
    const history = [...l.history, { at: new Date().toISOString(), event: 'stage_change', detail: `Moved from "${stageLabel(l.stage)}" to "${stageLabel(stageId)}"` }];
    return this._patch(id, { stage: stageId, status: 'active', history });
  },
  async markWon(id) {
    const l = this.get(id);
    if (!l) return null;
    const now = new Date().toISOString();
    const history = [...l.history, { at: now, event: 'won', detail: 'Marked as Won – contract signed' }];
    // Preserve project progress if this lead was won before and got reopened —
    // only default it to the first stage the first time it's ever won.
    const projectStage = l.projectStage || PROJECT_STAGES[0].id;
    const projectStatus = l.projectStatus || PROJECT_STATUS_OPTIONS[0].id;
    const permitStatus = l.permitStatus || PERMIT_STATUS_OPTIONS[0].id;
    return this._patch(id, { status: 'won', stage: 'won', wonAt: now, projectStage, projectStatus, permitStatus, history });
  },
  async moveProjectStage(id, stageId) {
    const l = this.get(id);
    if (!l) return null;
    const from = l.projectStage || PROJECT_STAGES[0].id;
    const history = [...l.history, { at: new Date().toISOString(), event: 'project_stage_change', detail: `Project moved from "${projectStageLabel(from)}" to "${projectStageLabel(stageId)}"` }];
    return this._patch(id, { projectStage: stageId, history });
  },
  /** Updates a project's health status and/or permit info together — the
   *  "Permit & Status" box shown once a lead is won. Only logs a history
   *  line for whichever of the three fields actually changed. */
  async updateProjectMeta(id, { projectStatus, permitStatus, permitTownship }) {
    const l = this.get(id);
    if (!l) return null;
    const changes = [];
    if (projectStatus !== undefined && projectStatus !== l.projectStatus) changes.push(`Status set to "${projectStatusLabel(projectStatus)}"`);
    if (permitStatus !== undefined && permitStatus !== l.permitStatus) changes.push(`Permit set to "${permitStatusLabel(permitStatus)}"`);
    if (permitTownship !== undefined && (permitTownship || '').trim() !== (l.permitTownship || '').trim()) changes.push(`Permit township set to "${permitTownship || '—'}"`);
    if (!changes.length) return l;
    const history = [...l.history, { at: new Date().toISOString(), event: 'project_meta_change', detail: changes.join('; ') }];
    return this._patch(id, { projectStatus, permitStatus, permitTownship, history });
  },
  async markLost(id, reason) {
    const l = this.get(id);
    if (!l) return null;
    const now = new Date().toISOString();
    const lostReason = reason || 'Other';
    const history = [...l.history, { at: now, event: 'lost', detail: `Marked as Lost (${lostReason})` }];
    return this._patch(id, { status: 'lost', lostReason, lostAt: now, history });
  },
  async reopen(id) {
    const l = this.get(id);
    if (!l) return null;
    const history = [...l.history, { at: new Date().toISOString(), event: 'reopened', detail: 'Lead reopened' }];
    return this._patch(id, { status: 'active', lostReason: '', history });
  },
  async addNote(id, note) {
    const l = this.get(id);
    if (!l) return null;
    const history = [...l.history, { at: new Date().toISOString(), event: 'note', detail: note }];
    return this._patch(id, { history });
  },
  /** Deleting a lead means "we're fully done with them" — so it also
   *  removes the linked contact(s) from the Contacts section entirely,
   *  unless a contact is still tied to some other lead (then it's left
   *  alone). Marking a lead Lost is a completely separate, non-destructive
   *  path — it never touches the contact or lead data, so a lost lead can
   *  always be reopened later with everything still in place. */
  async remove(id) {
    const lead = this.get(id);
    const linkedContactIds = lead ? [...new Set([lead.contactId, lead.secondaryContactId].filter(Boolean))] : [];
    const { error } = await mustClient().from('leads').delete().eq('id', id);
    if (error) throw error;
    cache.leads = cache.leads.filter(l => l.id !== id);
    for (const contactId of linkedContactIds) {
      const stillNeeded = cache.leads.some(l => l.contactId === contactId || l.secondaryContactId === contactId);
      if (!stillNeeded) {
        await Contacts.remove(contactId);
      }
    }
  },
  /** Internal: merge partial fields onto the existing lead and save. */
  async _patch(id, partial) {
    const existing = this.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...partial };
    const { data: row, error } = await mustClient().from('leads').update(leadToRow(merged)).eq('id', id).select().single();
    if (error) throw error;
    const lead = leadFromRow(row);
    const i = cache.leads.findIndex(l => l.id === id);
    if (i !== -1) cache.leads[i] = lead;
    return lead;
  },
};
