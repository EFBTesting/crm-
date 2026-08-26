/* ==========================================================================
   Erwin Forest Builders CRM — Data Layer
   Backed by Supabase (real Postgres, shared across every device/teammate).
   Reads stay synchronous (served from an in-memory cache); writes are
   async and update the cache + Supabase together. A realtime subscription
   keeps every open tab in sync when teammates make changes elsewhere.
   ========================================================================== */

/** The active pipeline stages, in order. "Lost" is tracked separately (a
 *  lead can be marked lost from any stage). Reaching the last stage here
 *  is the win condition — see Leads.moveStage — so there's no separate
 *  "Won" bucket to manage; the lead just moves on to Project Tracking. */
const STAGES = [
  { id: 'new_lead', label: 'New Lead', description: 'Inbound inquiry captured — phone, web form, referral, walk-in.' },
  { id: 'site_visit', label: 'Site Visit Scheduled', description: 'Qualified and an on-site assessment is booked or complete.' },
  { id: 'estimate_sent', label: 'Estimate Sent', description: 'A bid / proposal has been delivered to the prospect.' },
  { id: 'negotiation', label: 'Negotiation', description: 'Discussing scope, price, timeline, or contract terms.' },
  { id: 'design_contract_signed', label: 'Design Contract Signed', description: 'Design contract signed — automatically becomes an active project.' },
];

/** A lead's overall status, independent of what Stage it's sitting in.
 *  Only Active leads show on the main Pipeline table — On Hold and Lost
 *  both move out into the Pipeline's own "inactive" list. Winning (Design
 *  Contract Signed) is a Stage event, not a Status option here. */
const LEAD_STATUS_OPTIONS = [
  { id: 'active', label: 'Active' }, { id: 'on_hold', label: 'On Hold' }, { id: 'lost', label: 'Lost' },
];
function leadStatusLabel(id) {
  const s = LEAD_STATUS_OPTIONS.find(s => s.id === id);
  return s ? s.label : 'Active';
}

const LEAD_SOURCES =['Referral', 'Website', 'Google Search', 'Angi / HomeAdvisor', 'Facebook / Instagram', 'Repeat Client', 'Signage / Drive-by', 'Trade Show', 'Other'];
/** Autocomplete suggestions for the Assigned To / Estimator / Field Manager
 *  / Designer fields — from the old tracker's staff list. Free-text either
 *  way (a datalist, not a locked dropdown), since the roster changes. */
const STAFF_NAMES = [
  'Architect', 'Bradley, Galen', 'Brochu, Alex', 'Dejana, Shelby', 'Diehl, Ron', 'Donchez, Jill', 'Dormann, Steve',
  'Evans, Tyler', 'Fantasia, Dan', 'Fies, Shaun', 'Gehman, Kevin', 'Gehman, Tait', 'Helm, Emily', 'Helm, Sue',
  'Hoeing, Keith', 'Hudson, Alex', 'Jandrew, Brian', 'Kucharczuk, Jared', 'Maguire, Darren', 'Oswald, Stephen',
  'Ryan, Kelly', 'Scherer, Blake', 'Simkulak, Michele', 'Stahley, Jack', 'Stradling, Steve', 'Swine Design',
  'Toth, Josh', 'Zurick, Brandon', 'N-A', 'EFB / Swine D.', 'TBD', 'Other',
];
/** Matches the classification scheme from the old Excel tracker's Settings
 *  tab, not room/job type — projects are classified by scale/complexity. */
const PROJECT_TYPES = [
  'Small Reno-Class D', 'Small Reno-Class C', 'Hybrid: Reno/Add-Class B', 'Lg Scale Reno-Class A',
  'New Con: Semi-Custom', 'New Con: Full Custom', 'New Con: Design Only', 'Other',
];
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

/** Overall health of a project — separate from what stage it's in. Set
 *  by hand from the Project Tracking table (not computed) — someone on
 *  the team picks whichever label best describes it right now. */
const PROJECT_STATUS_OPTIONS = [
  { id: 'on_track', label: 'On Track' },
  { id: 'delayed', label: 'Delayed' },
  { id: 'starting_soon', label: 'Starting Soon' },
  { id: 'ready_to_break_ground', label: 'Ready to Break Ground' },
  { id: 'past_projected_start', label: 'Past Target Start' },
];

/** Where a project's permit stands — only meaningful once it's a project. */
const PERMIT_STATUS_OPTIONS = [
  { id: 'not_submitted', label: 'Not Submitted' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'approved', label: 'Approved' },
];

/** Pre-Construction checklist — mirrors the "PreCons" tracker spreadsheet
 *  used before this CRM existed. Every won project gets the full checklist
 *  the moment it's marked Won (see Leads.markWon), same as project_stage.
 *  Two fixed phases; teams can also tack on custom steps per project,
 *  matching the spreadsheet's "spare columns". */
const LEAD_UP_STEPS = [
  'Sales Lead Validated', 'Site Visit', 'Architectural Design Proposal - Sent',
  'Architectural Design Proposal - Executed', 'Schematic Design', 'Design Development',
  'Forecast Estimate - Drafted', 'Forecast Estimate - Review', 'Forecast Estimate - Approved',
  'Pre-Con Agreement Signed', 'EFB Team DD Meeting', 'EFB Team / Client Intro Meeting',
  'Cabinetry Design - Initial', 'Construction Documents - Started', 'Structural Engineering',
  'Construction Documents - Completed', 'Official Start of Pre-Construction',
];
const PRE_CON_STEPS = [
  'EFB Team Meeting 1', 'EFB Team / Client Meeting 1', 'Cabinetry Design - Preliminary',
  'Exterior Rendering - Submitted', 'EFB Team / Client Subsequent Mtgs - See Pre Con Schedule',
  'Truss Plans - Preliminary', 'I Joist Plans - Completed', 'Grading Plan', 'Septic Plan',
  'Client Vendor Visits', 'Material Selections - See Pre Con Schedule', "Trade Quotes / RFI's / Site Visits",
  'Permit(s) Submitted - Grading / Septic', 'Truss Plans - Sealed', 'Permit(s) Submitted - Building',
  'Cabinetry Design - Final (Layout)', 'Budget / Estimate Final', 'Permit Approved',
  'Construction Agreement - Drafted/Sent', 'Construction Agreement - Signed', 'Job Started',
];
const PRECON_PHASES = [
  { id: 'lead_up', label: 'Lead-Up Phase', steps: LEAD_UP_STEPS },
  { id: 'pre_construction', label: 'Pre-Construction Phase', steps: PRE_CON_STEPS },
];
/** Status options for one checklist step. Blank/"Not Started" and "Pending"
 *  behave the same as far as progress math goes — only "Completed" counts
 *  toward progress, and only "N/A" is excluded from the step count entirely. */
const PRECON_STEP_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Pending', 'N/A'];
/** The checklist's own "Record status" — independent of the lead's
 *  won/lost status above; this is about the pre-con phase specifically
 *  (a won project can still have its pre-con work put on hold, for
 *  instance, without the project itself being lost). */
const PRECON_RECORD_STATUS_OPTIONS = [
  { id: 'active', label: 'Active' }, { id: 'on_hold', label: 'On Hold' },
  { id: 'lost', label: 'Lost' }, { id: 'complete', label: 'Complete' },
];
function preconRecordStatusLabel(id) {
  const s = PRECON_RECORD_STATUS_OPTIONS.find(s => s.id === id);
  return s ? s.label : 'Active';
}
/** The Lead Pipeline's "Contacted" checklist — quick follow-up tasks
 *  tracked on every lead, independent of pipeline stage. Only "First
 *  meeting scheduled" carries its own date; the two 2-week follow-ups
 *  below it derive their due date from that same date (+14 days) instead
 *  of storing their own, so moving the first-meeting date automatically
 *  reschedules them. More steps can be added here later. */
const CONTACTED_STEPS = [
  { key: 'emailed_called', label: 'Emailed/Called' },
  { key: 'first_meeting', label: 'First meeting scheduled', hasDate: true },
  { key: 'thank_you_email', label: 'Thank you email sent' },
  { key: 'followup_email_2wk', label: '2 week email follow up', dueFrom: 'first_meeting', dueDays: 14 },
  { key: 'followup_phone_2wk', label: '2 week phone follow up', dueFrom: 'first_meeting', dueDays: 14 },
];
function defaultContactedSteps() {
  return CONTACTED_STEPS.map(s => ({ key: s.key, done: false, date: null }));
}
/** Live-computed, same philosophy as preconProgress() — a step's overdue
 *  state is never stored, always recalculated against today's date so it
 *  can't go stale. A step only goes overdue once its due date (derived
 *  from its anchor step's date) has passed and it's still unchecked. */
function contactedProgress(lead) {
  const stored = lead?.contactedSteps && lead.contactedSteps.length ? lead.contactedSteps : defaultContactedSteps();
  const byKey = {};
  stored.forEach(s => { byKey[s.key] = s; });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = CONTACTED_STEPS.map(def => {
    const s = byKey[def.key] || { done: false, date: null };
    let dueDate = null, overdue = false;
    if (def.dueFrom) {
      const anchor = byKey[def.dueFrom];
      if (anchor && anchor.date) {
        dueDate = new Date(anchor.date + 'T00:00:00');
        dueDate.setDate(dueDate.getDate() + def.dueDays);
        overdue = !s.done && dueDate < today;
      }
    }
    return { ...def, done: !!s.done, date: s.date || null, dueDate, overdue };
  });

  return { items, overdueCount: items.filter(i => i.overdue).length };
}
function defaultPreconSteps() {
  const steps = [];
  PRECON_PHASES.forEach(phase => phase.steps.forEach(label => steps.push({ phase: phase.id, label, status: '' })));
  return steps;
}

/** Live-computed Pre-Construction progress — never stored, same philosophy
 *  as revenueAmount(): recomputed from precon_steps/projected_start_date
 *  every time so it can never drift. Mirrors the old tracker's Days to
 *  start / Progress / Current step / Status columns exactly. Returns null
 *  for a project that hasn't started its checklist yet. */
function preconProgress(lead) {
  const steps = lead?.preconSteps || [];
  if (!steps.length) return null;
  const completed = steps.filter(s => s.status === 'Completed').length;
  const inProgress = steps.filter(s => s.status === 'In Progress').length;
  const stepsInScope = steps.filter(s => s.status !== 'N/A').length;
  const progressPercent = stepsInScope ? completed / stepsInScope : null;

  let currentStep;
  const inProgressStep = steps.find(s => s.status === 'In Progress');
  if (inProgressStep) currentStep = inProgressStep.label;
  else if (completed === 0) currentStep = 'Not started';
  else {
    const completedSteps = steps.filter(s => s.status === 'Completed');
    currentStep = completedSteps[completedSteps.length - 1].label;
  }

  const recordStatus = lead.preconStatus || 'active';
  let daysToStart = null;
  if (lead.projectedStartDate) {
    const start = new Date(lead.projectedStartDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysToStart = Math.round((start - today) / 86400000);
  }

  let statusLabel, statusTone;
  if (recordStatus !== 'active') {
    statusLabel = preconRecordStatusLabel(recordStatus);
    statusTone = recordStatus === 'lost' ? 'red' : recordStatus === 'complete' ? 'green' : 'muted';
  } else if (stepsInScope > 0 && completed === stepsInScope) {
    statusLabel = 'Ready to break ground'; statusTone = 'green';
  } else if (!lead.projectedStartDate) {
    statusLabel = 'No target set'; statusTone = 'muted';
  } else if (daysToStart < 0) {
    statusLabel = 'Past target start'; statusTone = 'red';
  } else if (daysToStart <= 30) {
    statusLabel = 'Starting soon'; statusTone = 'stage';
  } else {
    statusLabel = 'On track'; statusTone = 'navy';
  }

  return { completed, inProgress, stepsInScope, progressPercent, currentStep, daysToStart, statusLabel, statusTone, recordStatus };
}

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
    projectStatus: r.project_status || null, permitTownship: r.permit_township || '', permits: r.permits || [],
    projectedStartDate: r.projected_start_date || '', targetCompletionDate: r.target_completion_date || '',
    assignedTo: r.assigned_to || '', estimator: r.estimator || '', fieldManager: r.field_manager || '', designer: r.designer || '',
    preconStatus: r.precon_status || 'active',
    preconSteps: r.precon_steps || [], preconNotes: r.precon_notes || '',
    contactedSteps: r.contacted_steps || [],
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
  if (d.permitTownship !== undefined) row.permit_township = (d.permitTownship || '').trim();
  if (d.permits !== undefined) row.permits = d.permits;
  if (d.projectedStartDate !== undefined) row.projected_start_date = d.projectedStartDate || null;
  if (d.targetCompletionDate !== undefined) row.target_completion_date = d.targetCompletionDate || null;
  if (d.assignedTo !== undefined) row.assigned_to = (d.assignedTo || '').trim();
  if (d.estimator !== undefined) row.estimator = (d.estimator || '').trim();
  if (d.fieldManager !== undefined) row.field_manager = (d.fieldManager || '').trim();
  if (d.designer !== undefined) row.designer = (d.designer || '').trim();
  if (d.preconStatus !== undefined) row.precon_status = d.preconStatus;
  if (d.preconSteps !== undefined) row.precon_steps = d.preconSteps;
  if (d.contactedSteps !== undefined) row.contacted_steps = d.contactedSteps;
  if (d.preconNotes !== undefined) row.precon_notes = (d.preconNotes || '').trim();
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

/** Rolls up every permit across a set of projects (won leads), grouped by
 *  type — case-insensitively, so "electrical" and "Electrical" combine —
 *  since there's no fixed permit list; whatever gets typed in is a type.
 *  Sorted by total activity so the busiest permit types float to the top. */
function permitBreakdown(leadsList) {
  const byType = new Map();
  leadsList.forEach(l => {
    (l.permits || []).forEach(p => {
      const type = (p.type || '').trim();
      if (!type) return;
      const key = type.toLowerCase();
      if (!byType.has(key)) byType.set(key, { label: type, submitted: [], approved: [] });
      const entry = byType.get(key);
      if (p.status === 'submitted') entry.submitted.push({ id: l.id, title: l.title });
      if (p.status === 'approved') entry.approved.push({ id: l.id, title: l.title });
    });
  });
  return [...byType.values()].sort((a, b) => (b.submitted.length + b.approved.length) - (a.submitted.length + a.approved.length));
}

/** Diffs one project's old vs. new permit list (matched by type,
 *  case-insensitively) into readable history lines: additions, removals,
 *  and status changes. */
function diffPermits(oldPermits, newPermits) {
  const changes = [];
  const oldByType = new Map(oldPermits.map(p => [(p.type || '').trim().toLowerCase(), p]));
  const newByType = new Map(newPermits.map(p => [(p.type || '').trim().toLowerCase(), p]));
  newByType.forEach((p, key) => {
    const old = oldByType.get(key);
    if (!old) changes.push(`${p.type} permit added (${permitStatusLabel(p.status)})`);
    else if (old.status !== p.status) changes.push(`${p.type} permit: ${permitStatusLabel(old.status)} → ${permitStatusLabel(p.status)}`);
  });
  oldByType.forEach((p, key) => {
    if (!newByType.has(key)) changes.push(`${p.type} permit removed`);
  });
  return changes;
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
   *  - 'open' if any linked lead is currently active or on hold — neither
   *    is a closed outcome, just active vs. paused
   *  - otherwise 'previous' (their most recently updated lead's outcome,
   *    won or lost) — once a lead is reopened it becomes active again,
   *    which flips this straight back to 'open'
   *  - 'none' if they have no leads at all */
  statusFor(contactId) {
    const leads = this.leadsFor(contactId);
    if (!leads.length) return { kind: 'none' };
    const open = leads.filter(l => l.status === 'active' || l.status === 'on_hold');
    if (open.length) return { kind: 'open', count: open.length };
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
    // New leads default to Keith as Assigned To so they show up populated
    // on the Project Calendar right away — changeable any time.
    const assignedTo = data.assignedTo || 'Hoeing, Keith';
    const row = leadToRow({ ...data, stage, status: 'active', assignedTo, history });
    const { data: saved, error } = await mustClient().from('leads').insert(row).select().single();
    if (error) throw error;
    const lead = leadFromRow(saved);
    cache.leads.push(lead);
    return lead;
  },
  /** Creates a project directly, skipping the sales pipeline — for a job
   *  that's already contracted (e.g. backfilling from the old spreadsheet)
   *  rather than won off a tracked lead. Sets up the same defaults markWon
   *  does: final pipeline stage, a fresh Pre-Con checklist, on-track status. */
  async createProject(data) {
    const now = new Date().toISOString();
    const finalStage = STAGES[STAGES.length - 1].id;
    const projectStage = data.projectStage || PROJECT_STAGES[0].id;
    const history = [{ at: now, event: 'created', detail: `Project created directly in stage "${projectStageLabel(projectStage)}"` }];
    const row = leadToRow({
      ...data, stage: finalStage, status: 'won', wonAt: now,
      projectStage, projectStatus: PROJECT_STATUS_OPTIONS[0].id,
      preconSteps: defaultPreconSteps(), preconStatus: 'active', history,
    });
    const { data: saved, error } = await mustClient().from('leads').insert(row).select().single();
    if (error) throw error;
    const lead = leadFromRow(saved);
    cache.leads.push(lead);
    return lead;
  },
  async update(id, data) {
    return this._patch(id, data);
  },
  /** Reaching the last stage (Design Contract Signed) IS the win condition
   *  — no separate "Mark Won" action needed, the lead just moves on to
   *  Project Tracking automatically, same as clicking through the stage
   *  tracker on any other stage. */
  async moveStage(id, stageId) {
    const l = this.get(id);
    if (!l) return null;
    if (stageId === STAGES[STAGES.length - 1].id) return this.markWon(id);
    const history = [...l.history, { at: new Date().toISOString(), event: 'stage_change', detail: `Moved from "${stageLabel(l.stage)}" to "${stageLabel(stageId)}"` }];
    return this._patch(id, { stage: stageId, status: 'active', history });
  },
  async markWon(id) {
    const l = this.get(id);
    if (!l) return null;
    const now = new Date().toISOString();
    const finalStage = STAGES[STAGES.length - 1].id;
    const history = [...l.history, { at: now, event: 'won', detail: `${stageLabel(finalStage)} — converted to an active project` }];
    // Preserve project progress if this lead was won before and got reopened —
    // only default it to the first stage the first time it's ever won.
    const projectStage = l.projectStage || PROJECT_STAGES[0].id;
    const projectStatus = l.projectStatus || PROJECT_STATUS_OPTIONS[0].id;
    // Same "only default it the first time" rule as projectStage/projectStatus above —
    // a reopened-then-rewon project keeps whatever checklist progress it already had.
    const preconSteps = l.preconSteps && l.preconSteps.length ? l.preconSteps : defaultPreconSteps();
    const preconStatus = l.preconStatus || 'active';
    return this._patch(id, { status: 'won', stage: finalStage, wonAt: now, projectStage, projectStatus, preconSteps, preconStatus, history });
  },
  async moveProjectStage(id, stageId) {
    const l = this.get(id);
    if (!l) return null;
    const from = l.projectStage || PROJECT_STAGES[0].id;
    const history = [...l.history, { at: new Date().toISOString(), event: 'project_stage_change', detail: `Project moved from "${projectStageLabel(from)}" to "${projectStageLabel(stageId)}"` }];
    return this._patch(id, { projectStage: stageId, history });
  },
  /** Updates a project's health status, permit list, and/or permit township
   *  together — status is set from the Project Tracking table now, permits
   *  and township from the lead detail page's Permits panel. Diffs the
   *  permit list by type (case-insensitively) so history reads as
   *  "Electrical permit: Submitted -> Approved" rather than a generic blob. */
  async updateProjectMeta(id, { projectStatus, permits, permitTownship }) {
    const l = this.get(id);
    if (!l) return null;
    const changes = [];
    if (projectStatus !== undefined && projectStatus !== l.projectStatus) changes.push(`Status set to "${projectStatusLabel(projectStatus)}"`);
    if (permitTownship !== undefined && (permitTownship || '').trim() !== (l.permitTownship || '').trim()) changes.push(`Permit township set to "${permitTownship || '—'}"`);
    if (permits !== undefined) changes.push(...diffPermits(l.permits || [], permits));
    if (!changes.length) return l;
    const history = [...l.history, { at: new Date().toISOString(), event: 'project_meta_change', detail: changes.join('; ') }];
    return this._patch(id, { projectStatus, permits, permitTownship, history });
  },
  /** Starts the Pre-Construction checklist for a project that doesn't have
   *  one yet (e.g. a project won before this feature existed). Safe to call
   *  repeatedly — a no-op once steps exist. */
  async initPreconChecklist(id) {
    const l = this.get(id);
    if (!l) return null;
    if (l.preconSteps && l.preconSteps.length) return l;
    const history = [...l.history, { at: new Date().toISOString(), event: 'precon_started', detail: 'Pre-Construction checklist started' }];
    return this._patch(id, { preconSteps: defaultPreconSteps(), preconStatus: l.preconStatus || 'active', history });
  },
  /** Marks one checklist step. No history line per click — with 38 steps
   *  that would flood the activity feed; the checklist itself is the record. */
  async setPreconStep(id, phase, label, status) {
    const l = this.get(id);
    if (!l) return null;
    const steps = (l.preconSteps || []).map(s => (s.phase === phase && s.label === label) ? { ...s, status } : s);
    return this._patch(id, { preconSteps: steps });
  },
  /** Toggles one Contacted-checklist step's done state and/or sets its
   *  date — only "First meeting scheduled" uses the date; the two 2-week
   *  follow-ups derive their due date from it live (see contactedProgress).
   *  No history line per click, same reasoning as setPreconStep. */
  async setContactedStep(id, key, patch) {
    const l = this.get(id);
    if (!l) return null;
    const current = l.contactedSteps && l.contactedSteps.length ? l.contactedSteps : defaultContactedSteps();
    const steps = current.map(s => s.key === key ? { ...s, ...patch } : s);
    return this._patch(id, { contactedSteps: steps });
  },
  /** Adds a custom step to one phase — the "spare columns" from the old
   *  spreadsheet, so a job that needs an extra step isn't stuck. */
  async addPreconStep(id, phase, label) {
    const l = this.get(id);
    if (!l) return null;
    const trimmed = (label || '').trim();
    if (!trimmed) return l;
    const steps = [...(l.preconSteps || []), { phase, label: trimmed, status: '' }];
    return this._patch(id, { preconSteps: steps });
  },
  async removePreconStep(id, phase, label) {
    const l = this.get(id);
    if (!l) return null;
    const steps = (l.preconSteps || []).filter(s => !(s.phase === phase && s.label === label));
    return this._patch(id, { preconSteps: steps });
  },
  /** Updates a lead/project's Target Start / Target Finish dates, Team
   *  (Assigned To / Estimator / Field Mgr / Designer), Pre-Con record
   *  status, and/or notes — any subset at a time (undefined fields are
   *  left untouched). Called from the Project Calendar's inline Team
   *  dropdowns and date cells, Project Tracking's inline date cells, and
   *  the Pre-Construction Notes popup. Target Start/Finish are what draws
   *  a project's bar on the Project Calendar's Gantt-style timeline, and
   *  it's the single copy of these dates — editing from any page updates
   *  everywhere else. */
  async updatePreconMeta(id, { projectedStartDate, targetCompletionDate, preconStatus, preconNotes, assignedTo, estimator, fieldManager, designer }) {
    const l = this.get(id);
    if (!l) return null;
    const changes = [];
    if (projectedStartDate !== undefined && (projectedStartDate || '') !== (l.projectedStartDate || '')) {
      changes.push(`Target start set to ${projectedStartDate ? fmtDateOnly(projectedStartDate) : '—'}`);
    }
    if (targetCompletionDate !== undefined && (targetCompletionDate || '') !== (l.targetCompletionDate || '')) {
      changes.push(`Target finish set to ${targetCompletionDate ? fmtDateOnly(targetCompletionDate) : '—'}`);
    }
    if (preconStatus !== undefined && preconStatus !== (l.preconStatus || 'active')) {
      changes.push(`Pre-Con status set to "${preconRecordStatusLabel(preconStatus)}"`);
    }
    const patch = { projectedStartDate, targetCompletionDate, preconStatus, preconNotes, assignedTo, estimator, fieldManager, designer };
    if (!changes.length) return this._patch(id, patch);
    const history = [...l.history, { at: new Date().toISOString(), event: 'precon_meta_change', detail: changes.join('; ') }];
    return this._patch(id, { ...patch, history });
  },
  /** Sets a lead's Active/On Hold status directly — the Pipeline's Status
   *  dropdown. Lost goes through markLost instead (it needs a reason). */
  async setStatus(id, status) {
    const l = this.get(id);
    if (!l) return null;
    const history = [...l.history, { at: new Date().toISOString(), event: 'status_change', detail: `Status set to "${leadStatusLabel(status)}"` }];
    return this._patch(id, { status, history });
  },
  async markLost(id, reason) {
    const l = this.get(id);
    if (!l) return null;
    const now = new Date().toISOString();
    const lostReason = reason || 'Other';
    const history = [...l.history, { at: now, event: 'lost', detail: `Marked as Lost (${lostReason})` }];
    const patch = { status: 'lost', lostReason, lostAt: now, history };
    // Keep a project's Record Status in sync — it's now the same "lost"
    // app-wide, just reached from either page.
    if (l.wonAt) patch.preconStatus = 'lost';
    return this._patch(id, patch);
  },
  /** Reopens a lost/on-hold lead OR a lost project. A project that gets
   *  marked lost still has wonAt set (never cleared), so that's what tells
   *  reopen() which state to restore it to — back into the Pipeline (never
   *  won) or back onto Project Tracking (won, then lost). */
  async reopen(id) {
    const l = this.get(id);
    if (!l) return null;
    const restoredStatus = l.wonAt ? 'won' : 'active';
    const history = [...l.history, { at: new Date().toISOString(), event: 'reopened', detail: restoredStatus === 'won' ? 'Project reopened' : 'Lead reopened' }];
    const patch = { status: restoredStatus, lostReason: '', history };
    if (l.wonAt) patch.preconStatus = 'active';
    return this._patch(id, patch);
  },
  /** Marks a project's Record Status Complete — also closes out its
   *  production stage, since "the record is done" and "the build is done"
   *  should agree once someone's explicitly archiving it. */
  async markProjectComplete(id) {
    const l = this.get(id);
    if (!l) return null;
    const history = [...l.history, { at: new Date().toISOString(), event: 'precon_meta_change', detail: 'Record status set to "Complete"' }];
    return this._patch(id, { preconStatus: 'complete', projectStage: 'completed', history });
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
