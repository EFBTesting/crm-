/* ==========================================================================
   Client Questionnaire — question content.

   PLACEHOLDER CONTENT: the sections, questions, and wording below are a
   starting point so the feature has something real to test end-to-end —
   they are NOT the actual Microsoft Forms questions. Edit everything in
   this file freely to match your real "quick" and "detailed" forms; you
   shouldn't need to touch questionnaire.js just to change what's asked.

   Each questionnaire is a list of sections (a plain heading + optional
   italic note, like "Personal Details" / "Note: ..."), and each section
   is a list of fields:
     { key, label, type, required?, options?, hint? }
       - key: becomes the property name in the saved `answers` JSON.
         Keep it stable once real answers exist — renaming a key orphans
         whatever was already saved under the old one.
       - type: 'text' | 'tel' | 'email' | 'textarea' | 'select' | 'radio'
         ('text'/'tel'/'email' render inline as "Label: ___"; the rest
         render with the label on its own line above the control.)
       - required: true/false (default false)
       - options: array of strings — required for 'select' and 'radio'
         (both render as a checkbox-style list — it's still one answer
         either way, 'select' just implies a longer option list)
       - hint: optional small italic line under the question, e.g. an
         example answer or "if yes, tell us more" instruction
   ========================================================================== */

const QUESTIONNAIRE_SETS = {
  // "Let's Get Started" — Keith's Pre-Con review, Aug 2026: kept every
  // question marked Pre Con, in the order he reviewed them. Questions 5/6
  // (Con) and 7/8/10 (Delete) from that review are intentionally not here
  // — 5/6 belong on the Detailed/Con-stage form instead (not yet added,
  // pending a similar review pass for that one), 7/8/10 are gone for good.
  quick: {
    title: "Let's Get To Know You",
    intro: "Thanks for joining the EFB family! This questionnaire takes about a couple minutes to fill out and this helps us get to know you ahead of our first in person meeting.",
    sections: [
      {
        heading: 'Contact Details',
        fields: [
          { key: 'fullName', label: 'First Name & Last Name', type: 'text', required: true },
          { key: 'phone', label: 'Phone #', type: 'tel', required: true },
          { key: 'email', label: 'Email Address', type: 'email', required: true },
        ],
      },
      {
        heading: 'Project Details',
        fields: [
          { key: 'otherDecisionMakerName', label: 'Other Decision-Maker (if any) — Full Name', type: 'text' },
          { key: 'otherDecisionMakerPhone', label: 'Their Phone #', type: 'tel' },
          { key: 'otherDecisionMakerEmail', label: 'Their Email', type: 'email' },
          { key: 'timeline', label: 'Do you have a general timeline or target move-in date in mind?', type: 'text', inline: false,
            hint: 'e.g. Spring 2027, as soon as possible, flexible' },
          { key: 'vision', label: "In a few sentences, tell us what you're envisioning.", type: 'textarea',
            hint: "No need to have it all figured out — just share where your head is at right now." },
          { key: 'source', label: 'How did you hear about Erwin Forrest Builders?', type: 'select', options: [
            'Friends', 'Family', 'Word of mouth', 'Referral', 'Website', 'Google Search', 'Social Media (Facebook/Instagram)', 'Repeat Client', 'Other',
          ] },
        ],
      },
    ],
  },
  detailed: {
    title: 'Detailed Questionnaire',
    intro: 'A few more details on your project — this helps us put together an accurate estimate.',
    sections: [
      {
        heading: 'Project Overview',
        fields: [
          { key: 'projectDescription', label: 'Describe your project in a few sentences', type: 'textarea', required: true },
          { key: 'roomsAffected', label: 'Which rooms or areas are affected?', type: 'text' },
          { key: 'hasPlans', label: 'Do you already have architectural plans?', type: 'radio', options: ['Yes', 'No', 'In progress'] },
        ],
      },
      {
        heading: 'Logistics',
        note: 'Note: This helps us plan the right team and schedule for your project.',
        fields: [
          { key: 'contractorPreference', label: 'Any specific requirements for your contractor team?', type: 'textarea' },
          { key: 'financing', label: 'How do you plan to finance this project?', type: 'select', options: [
            'Cash', 'Loan', 'Home Equity (HELOC)', 'Not sure yet',
          ] },
          { key: 'siteAccess', label: "Anything we should know about accessing the property (gate code, pets, parking, etc.)?", type: 'textarea' },
          { key: 'communicationPreference', label: 'Preferred way for us to reach you', type: 'select', options: ['Phone call', 'Text message', 'Email'] },
          { key: 'additionalNotes', label: "Anything else you'd like us to know?", type: 'textarea' },
        ],
      },
    ],
  },
};
