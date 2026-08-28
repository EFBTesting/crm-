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
     { key, label, type, required?, options?, hint?, sub? }
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
       - sub: true marks this field as really a part of the question right
         before it — instead of getting its own number, it's labeled as a
         lettered sub-question of the previous one ("4" then "4a", "4b", ...)
   ========================================================================== */

const QUESTIONNAIRE_SETS = {
  // "Let's Get Started" — Keith's Pre-Con review, Aug 2026: kept every
  // question marked Pre Con, in the order he reviewed them. Questions 5/6
  // (Con) and 7/8/10 (Delete) from that review are intentionally not here
  // — 5/6 belong on the Detailed/Con-stage form instead (not yet added,
  // pending a similar review pass for that one), 7/8/10 are gone for good.
  //
  // Second pass, Aug 2026: Keith also reviewed the *Construction* form
  // (Form 2, "Now Let's Really Get to Know You") and cross-marked several
  // of its questions "Pre Con" too — meaning they actually belong here,
  // not on Construction. Those are folded in below under new sections
  // ("Your Household", "How You Like to Work", "Your Vision" additions,
  // "Past Experience & Expectations"), matching Form 2's own groupings.
  // Its "Your Vision" questions (#18-22) overlapped heavily with the
  // existing `vision` question here, so they're consolidated into fewer,
  // broader questions rather than kept as 5 near-duplicates. Questions
  // #30/#31 were marked BOTH Pre Con and Con — they're included here, and
  // should also be carried into the Construction form when it's built.
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
        heading: 'Your Household',
        fields: [
          { key: 'householdMembers', label: 'Who will be living in this home?', type: 'textarea',
            hint: "Number of adults, children, ages — whatever's helpful for us to know." },
          { key: 'pets', label: 'Do you have any pets?', type: 'textarea',
            hint: 'If yes, please share the type and any routines or safety notes we should keep in mind during the build.' },
          { key: 'dailyRoutines', label: 'Are there any daily routines we should consider in the design?', type: 'textarea',
            hint: 'Think morning coffee on the porch, home workouts, work-from-home setup, etc.' },
          { key: 'mostUsedAreas', label: 'Which areas of your home will be used the most, and how do you want them to feel?', type: 'textarea' },
          { key: 'homeType', label: 'Is this your forever home, a getaway, or a stepping-stone?', type: 'select', options: [
            "Forever home — we're building for the long haul", 'Long-term but not necessarily forever', 'Getaway / vacation property', "Stepping-stone — we'll likely sell in 5–10 years",
          ] },
          { key: 'futurePlans', label: 'Any future plans we should design around?', type: 'textarea',
            hint: 'Growing family, aging in place, frequent hosting, home office expansion, etc.' },
        ],
      },
      {
        heading: 'Project Details',
        fields: [
          { key: 'otherDecisionMakerName', label: 'Other Decision-Maker (if any) — Full Name', type: 'text' },
          { key: 'otherDecisionMakerPhone', label: 'Their Phone #', type: 'tel', sub: true },
          { key: 'otherDecisionMakerEmail', label: 'Their Email', type: 'email', sub: true },
          { key: 'timeline', label: 'Do you have a general timeline or target move-in date in mind?', type: 'text', inline: false,
            hint: 'e.g. Spring 2027, as soon as possible, flexible' },
          { key: 'source', label: 'How did you hear about Erwin Forrest Builders?', type: 'select', options: [
            'Friends', 'Family', 'Word of mouth', 'Referral', 'Website', 'Google Search', 'Social Media (Facebook/Instagram)', 'Repeat Client', 'Other',
          ] },
        ],
      },
      {
        heading: 'How You Like to Work',
        fields: [
          { key: 'decisionStyle', label: 'How do you usually make decisions?', type: 'select', options: [
            'Quickly — I go with my gut', 'I like time to think and research', 'I like to talk it through with someone', 'I tend to second-guess and need some reassurance', 'I prefer options narrowed down before I weigh in',
          ] },
        ],
      },
      {
        heading: 'Your Vision',
        fields: [
          { key: 'vision', label: "In a few sentences, tell us what you're envisioning.", type: 'textarea',
            hint: "No need to have it all figured out — just share where your head is at right now." },
          { key: 'atmosphereAndFirstImpression', label: "What overall atmosphere do you want your home to create, and what's the first thing you want people to notice or feel when they walk in?", type: 'textarea',
            hint: 'Warm and cozy, clean and modern, open and airy, rustic, timeless — whatever comes to mind.' },
          { key: 'dreamFeatures', label: 'Any dream features, personal touches, or details that would finally make this feel like home to you?', type: 'textarea' },
          { key: 'inspiration', label: "Any other inspiration you'd like to share?", type: 'textarea',
            hint: "Pinterest boards, magazine clippings, homes you've admired — anything goes." },
        ],
      },
      {
        heading: 'Past Experience & Expectations',
        fields: [
          { key: 'pastExperience', label: 'Have you been involved in any previous construction or renovation projects?', type: 'textarea',
            hint: 'If yes, briefly describe the project and when it took place.' },
          { key: 'whatToDoDifferently', label: 'What would you do differently this time?', type: 'textarea' },
          { key: 'oneThingToNail', label: "If there's one thing you want us to absolutely nail on this project, what is it?", type: 'textarea' },
          { key: 'nonNegotiables', label: 'Are there any non-negotiables or must-haves for this project?', type: 'textarea' },
          { key: 'concerns', label: 'Are there any anxieties or concerns we should know about going into this?', type: 'select', options: [
            "Timeline — I'm worried about delays", "Budget — I'm nervous about unexpected costs", 'Communication — I want to stay in the loop', 'Decision fatigue — there are a lot of choices to make', 'Quality — I want to make sure things are done right', "No major concerns — I'm just excited",
          ] },
          { key: 'anythingElse', label: "Is there anything else you'd like us to keep in mind as we move forward?", type: 'textarea' },
          { key: 'teamSupport', label: 'Is there anything we can do as a team to make this experience easier, more enjoyable, or less overwhelming for you?', type: 'textarea' },
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
