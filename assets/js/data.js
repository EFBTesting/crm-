/* ==========================================================================
   Erwin Forest Builders CRM — Data Layer
   All data lives in localStorage. No backend, no build step.
   ========================================================================== */

const DB_KEY = 'efb_crm_v1';

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

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function emptyDb() {
  return { contacts: [], companies: [], leads: [], meta: { createdAt: nowIso(), version: 1 } };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw);
    return {
      contacts: parsed.contacts || [],
      companies: parsed.companies || [],
      leads: parsed.leads || [],
      meta: parsed.meta || { createdAt: nowIso(), version: 1 },
    };
  } catch (e) {
    console.error('Failed to load CRM data, starting fresh.', e);
    return emptyDb();
  }
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/* ---- in-memory db, persisted on every mutation ---- */
let db = loadDb();

function persist() {
  saveDb(db);
}

/* =========================== Contacts =========================== */

const Contacts = {
  all() {
    return [...db.contacts].sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  },
  get(id) {
    return db.contacts.find(c => c.id === id) || null;
  },
  create(data) {
    const contact = {
      id: uid('con'),
      firstName: data.firstName?.trim() || '',
      lastName: data.lastName?.trim() || '',
      email: data.email?.trim() || '',
      phone: data.phone?.trim() || '',
      title: data.title?.trim() || '',
      companyId: data.companyId || null,
      address: data.address?.trim() || '',
      leadSource: data.leadSource || '',
      notes: data.notes?.trim() || '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.contacts.push(contact);
    persist();
    return contact;
  },
  update(id, data) {
    const c = this.get(id);
    if (!c) return null;
    Object.assign(c, data, { updatedAt: nowIso() });
    persist();
    return c;
  },
  remove(id) {
    db.contacts = db.contacts.filter(c => c.id !== id);
    // detach from leads/companies referencing this contact
    db.leads.forEach(l => { if (l.contactId === id) l.contactId = null; });
    db.companies.forEach(co => { if (co.primaryContactId === id) co.primaryContactId = null; });
    persist();
  },
  leadsFor(contactId) {
    return db.leads.filter(l => l.contactId === contactId);
  },
};

/* =========================== Companies =========================== */

const Companies = {
  all() {
    return [...db.companies].sort((a, b) => a.name.localeCompare(b.name));
  },
  get(id) {
    return db.companies.find(c => c.id === id) || null;
  },
  create(data) {
    const company = {
      id: uid('cmp'),
      name: data.name?.trim() || '',
      type: data.type || '',
      phone: data.phone?.trim() || '',
      website: data.website?.trim() || '',
      address: data.address?.trim() || '',
      primaryContactId: data.primaryContactId || null,
      notes: data.notes?.trim() || '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.companies.push(company);
    persist();
    return company;
  },
  update(id, data) {
    const c = this.get(id);
    if (!c) return null;
    Object.assign(c, data, { updatedAt: nowIso() });
    persist();
    return c;
  },
  remove(id) {
    db.companies = db.companies.filter(c => c.id !== id);
    db.contacts.forEach(ct => { if (ct.companyId === id) ct.companyId = null; });
    db.leads.forEach(l => { if (l.companyId === id) l.companyId = null; });
    persist();
  },
  contactsFor(companyId) {
    return db.contacts.filter(c => c.companyId === companyId);
  },
  leadsFor(companyId) {
    return db.leads.filter(l => l.companyId === companyId);
  },
};

/* =========================== Leads =========================== */

const Leads = {
  all() {
    return [...db.leads].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },
  get(id) {
    return db.leads.find(l => l.id === id) || null;
  },
  byStage(stageId) {
    return db.leads.filter(l => l.stage === stageId && l.status === 'active');
  },
  active() {
    return db.leads.filter(l => l.status === 'active');
  },
  create(data) {
    const lead = {
      id: uid('lead'),
      title: data.title?.trim() || 'Untitled Lead',
      contactId: data.contactId || null,
      companyId: data.companyId || null,
      stage: data.stage || STAGES[0].id,
      status: 'active', // active | won | lost
      value: Number(data.value) || 0,
      projectType: data.projectType || '',
      source: data.source || '',
      expectedCloseDate: data.expectedCloseDate || '',
      notes: data.notes?.trim() || '',
      lostReason: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      history: [{ at: nowIso(), event: 'created', detail: `Lead created in stage "${stageLabel(data.stage || STAGES[0].id)}"` }],
    };
    db.leads.push(lead);
    persist();
    return lead;
  },
  update(id, data) {
    const l = this.get(id);
    if (!l) return null;
    Object.assign(l, data, { updatedAt: nowIso() });
    persist();
    return l;
  },
  moveStage(id, stageId) {
    const l = this.get(id);
    if (!l) return null;
    const prev = l.stage;
    l.stage = stageId;
    l.status = 'active';
    l.updatedAt = nowIso();
    l.history.push({ at: nowIso(), event: 'stage_change', detail: `Moved from "${stageLabel(prev)}" to "${stageLabel(stageId)}"` });
    persist();
    return l;
  },
  markWon(id) {
    const l = this.get(id);
    if (!l) return null;
    l.status = 'won';
    l.stage = 'won';
    l.updatedAt = nowIso();
    l.wonAt = nowIso();
    l.history.push({ at: nowIso(), event: 'won', detail: 'Marked as Won – contract signed' });
    persist();
    return l;
  },
  markLost(id, reason) {
    const l = this.get(id);
    if (!l) return null;
    l.status = 'lost';
    l.lostReason = reason || 'Other';
    l.updatedAt = nowIso();
    l.lostAt = nowIso();
    l.history.push({ at: nowIso(), event: 'lost', detail: `Marked as Lost (${l.lostReason})` });
    persist();
    return l;
  },
  reopen(id) {
    const l = this.get(id);
    if (!l) return null;
    l.status = 'active';
    l.lostReason = '';
    l.updatedAt = nowIso();
    l.history.push({ at: nowIso(), event: 'reopened', detail: 'Lead reopened' });
    persist();
    return l;
  },
  addNote(id, note) {
    const l = this.get(id);
    if (!l) return null;
    l.history.push({ at: nowIso(), event: 'note', detail: note });
    l.updatedAt = nowIso();
    persist();
    return l;
  },
  remove(id) {
    db.leads = db.leads.filter(l => l.id !== id);
    persist();
  },
};

function stageLabel(stageId) {
  const s = STAGES.find(s => s.id === stageId);
  return s ? s.label : stageId;
}

/* =========================== Reset / seed helpers =========================== */

const DataAdmin = {
  wipeAll() {
    db = emptyDb();
    persist();
  },
  exportJson() {
    return JSON.stringify(db, null, 2);
  },
  importJson(json) {
    const parsed = JSON.parse(json);
    db = {
      contacts: parsed.contacts || [],
      companies: parsed.companies || [],
      leads: parsed.leads || [],
      meta: parsed.meta || { createdAt: nowIso(), version: 1 },
    };
    persist();
  },
};
