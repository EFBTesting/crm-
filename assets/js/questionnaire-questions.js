/* ==========================================================================
   Client Questionnaire — question content.

   PLACEHOLDER CONTENT: the questions and wording below are a starting
   point so the feature has something real to test end-to-end — they are
   NOT the actual Microsoft Forms questions. Edit everything in this file
   freely to match your real "quick" and "detailed" forms; you shouldn't
   need to touch questionnaire.js just to change what a client is asked.

   Each field looks like:
     { key, label, type, required?, options? }
       - key: becomes the property name in the saved `answers` JSON.
         Keep it stable once real answers exist — renaming a key orphans
         whatever was already saved under the old one.
       - type: 'text' | 'tel' | 'email' | 'textarea' | 'select' | 'radio'
       - required: true/false (default false)
       - options: array of strings — required for 'select' and 'radio'
   ========================================================================== */

const QUESTIONNAIRE_SETS = {
  quick: {
    title: 'Quick Questionnaire',
    intro: "Thanks for reaching out to Erwin Forest Builders! This takes about 2 minutes and helps us prep for your first conversation.",
    fields: [
      { key: 'fullName', label: 'Full name', type: 'text', required: true },
      { key: 'phone', label: 'Best phone number', type: 'tel', required: true },
      { key: 'address', label: 'Property address', type: 'text', required: true },
      { key: 'projectType', label: 'What type of project are you considering?', type: 'select', required: true, options: [
        'Kitchen Remodel', 'Bathroom Remodel', 'Room Addition', 'Whole-Home Renovation', 'New Construction', 'Other',
      ] },
      { key: 'budgetRange', label: 'Estimated budget range', type: 'select', options: [
        'Under $50,000', '$50,000 – $150,000', '$150,000 – $500,000', '$500,000+', 'Not sure yet',
      ] },
      { key: 'timeline', label: 'When would you like to start?', type: 'select', options: [
        'As soon as possible', 'Within 3 months', '3–6 months', '6–12 months', 'Just exploring',
      ] },
      { key: 'source', label: 'How did you hear about us?', type: 'select', options: [
        'Referral', 'Website', 'Google Search', 'Angi / HomeAdvisor', 'Facebook / Instagram', 'Repeat Client', 'Signage / Drive-by', 'Other',
      ] },
      { key: 'notes', label: 'Anything else we should know?', type: 'textarea' },
    ],
  },
  detailed: {
    title: 'Detailed Questionnaire',
    intro: 'A few more details on your project — this helps us put together an accurate estimate.',
    fields: [
      { key: 'projectDescription', label: 'Describe your project in a few sentences', type: 'textarea', required: true },
      { key: 'roomsAffected', label: 'Which rooms or areas are affected?', type: 'text' },
      { key: 'hasPlans', label: 'Do you already have architectural plans?', type: 'radio', options: ['Yes', 'No', 'In progress'] },
      { key: 'contractorPreference', label: 'Any specific requirements for your contractor team?', type: 'textarea' },
      { key: 'financing', label: 'How do you plan to finance this project?', type: 'select', options: [
        'Cash', 'Loan', 'Home Equity (HELOC)', 'Not sure yet',
      ] },
      { key: 'siteAccess', label: "Anything we should know about accessing the property (gate code, pets, parking, etc.)?", type: 'textarea' },
      { key: 'communicationPreference', label: 'Preferred way for us to reach you', type: 'select', options: ['Phone call', 'Text message', 'Email'] },
      { key: 'additionalNotes', label: "Anything else you'd like us to know?", type: 'textarea' },
    ],
  },
};
