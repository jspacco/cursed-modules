# Cursed Modules — Complete Rebuild Spec
## For Claude Code

---

## OVERVIEW

Build the Cursed Modules web application from scratch. This is a complete rewrite — do not attempt to modify or reference any previous codebase. The Firebase project and Vercel project already exist and will be reused, but all application code is new.

Cursed Modules is an interactive learning platform for a systems architecture course at Knox College. It has two sections:

**Case Studies** — Students have Socratic conversations with AI tutor personas (e.g. Ray, a senior Java developer) about historical software design failures.

**D4 (Design Doc Driven Development)** — Students negotiate a precise software design document with an AI mentor persona (Klaus, a Senior Software Architect). Klaus guides them toward a design document precise enough for a CLI coding agent to implement without asking follow-up questions.

Both sections use Google SSO (Knox Google Apps for Education), store conversations in Firestore, and call the Anthropic Claude API through a Vercel Edge Function.

**Important:** There is no config.js. All content, metadata, and prompts live in Firestore. The app is fully data-driven. The instructor dashboard is the only way to create and manage assignments and case studies.

---

## TECH STACK

- **Frontend:** React (Vite)
- **Routing:** React Router v6
- **Deployment:** Vercel
- **API proxy:** Vercel Edge Function (`/api/chat.js`)
- **Authentication:** Firebase Authentication (Google SSO)
- **Database:** Firebase Firestore
- **AI backend:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Styling:** Plain CSS with CSS variables — no Tailwind, no component library

---

## FIREBASE PROJECT

The Firebase project `knox-cursed-modules` already exists. Use this config:

```javascript
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};
```

---

## ENVIRONMENT VARIABLES

### Local (.env — never commit)
```
VITE_FIREBASE_API_KEY=AIzaSyBCY7dsYR3atRs_QWCx7LROV-ql9Q0ZeTQ
VITE_FIREBASE_AUTH_DOMAIN=knox-cursed-modules.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=knox-cursed-modules
VITE_FIREBASE_STORAGE_BUCKET=knox-cursed-modules.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=433350667369
VITE_FIREBASE_APP_ID=1:433350667369:web:42c5b7c671ee066cd546f8
ANTHROPIC_API_KEY=your_key_here
```

### .env.example (commit this)
Same keys with placeholder values.

### Vercel dashboard
All variables above must be set in Vercel environment settings. `ANTHROPIC_API_KEY` is server-only (no VITE_ prefix).

---

## REPOSITORY STRUCTURE

```
/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── firebase.js
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── CaseStudy.jsx
│   │   ├── Assignment.jsx
│   │   └── InstructorDashboard.jsx
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── ChatWindow.jsx
│   │   ├── ChatInput.jsx
│   │   ├── Sidebar.jsx
│   │   ├── MessageBubble.jsx
│   │   ├── SessionList.jsx
│   │   ├── DesignDocPanel.jsx
│   │   └── PromptEditor.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useTranscript.js
│   │   └── useSession.js
│   └── styles/
│       ├── global.css
│       ├── landing.css
│       ├── casestudy.css
│       ├── assignment.css
│       └── dashboard.css
├── api/
│   └── chat.js
├── .env.example
├── .gitignore
├── vercel.json
├── vite.config.js
└── package.json
```

There is no `src/data/config.js`. All content comes from Firestore.

---

## FIRESTORE DATA MODEL

### /professors/{email}/

```
{
  profile: {
    name: string,
    email: string,
    createdAt: Timestamp,
    permissions: {
      canViewAllTranscripts: boolean,
      canManageAssignments: boolean,
      canEditSystemPrompts: boolean,
      canViewInstructorDashboard: boolean
    }
  }
}
```

This is the only document that must be seeded manually before first use. The instructor creates it in the Firebase console with their Knox email as the document ID and all permissions set to true. Everything else is created through the instructor dashboard UI.

No UI for creating or editing professor records — manage directly in Firestore console.

---

### /prompts/

All prompt content and all assignment/case study metadata lives here.

```
d4-base/
  {
    content: string,
    version: integer,         // start at 1, increment on every save
    updatedAt: Timestamp,
    updatedBy: string         // email of instructor who saved
  }

d4-assignments/{assignmentId}/
  {
    // Metadata
    title: string,
    subtitle: string,
    mentorName: string,       // default "Klaus"
    mentorRole: string,       // default "Senior Software Architect"
    prereqs: string,
    estimatedMinutes: integer,
    description: string,
    active: boolean,          // false = hidden from landing page
    order: integer,           // display order on landing page

    // Prompt
    content: string,
    version: integer,
    updatedAt: Timestamp,
    updatedBy: string
  }

d4-assignments/{assignmentId}/docs/{docId}/
  {
    title: string,
    content: string,
    type: string,             // 'markdown' | 'plaintext'
    includeInPrompt: boolean, // true = concatenated into effective prompt
    order: integer,           // display order in sidebar panel
    version: integer,
    updatedAt: Timestamp,
    updatedBy: string
  }

casestudies/{caseStudyId}/
  {
    // Metadata
    title: string,
    subtitle: string,
    tutorName: string,
    tutorRole: string,
    prereqs: string,
    estimatedMinutes: integer,
    active: boolean,
    order: integer,
    concepts: [
      { id: string, label: string }
    ],
    primarySources: [
      { label: string, url: string, description: string }
    ],
    quickPrompts: string[],

    // Prompt
    content: string,
    version: integer,
    updatedAt: Timestamp,
    updatedBy: string
  }
```

---

### Effective prompt assembly for D4 sessions

At session start, load:
1. `/prompts/d4-base/` → base prompt
2. `/prompts/d4-assignments/{id}/` → assignment prompt
3. `/prompts/d4-assignments/{id}/docs/` → all docs, ordered by `order` field

Assemble:
```
base.content
+ "\n\n" + assignment.content
+ "\n\n" + [each doc where includeInPrompt === true, sorted by order, joined with "\n\n"]
```

Store this assembled string as `prompts.effective` in the session document. This is what gets sent to the API — never reconstruct it later.

---

### /students/{email}/casestudies/{caseStudyId}/

```
{
  metadata: {
    studentName: string,
    studentEmail: string,
    caseStudyId: string,
    caseStudyTitle: string,
    startedAt: Timestamp,
    lastActiveAt: Timestamp,
    completed: boolean
  },
  prompts: {
    casestudy: {
      content: string,
      version: integer,
      savedAt: Timestamp
    },
    effective: string         // same as casestudy.content, stored for consistency
  },
  messages: [
    {
      role: "user" | "assistant",
      content: string,
      timestamp: string       // ISO 8601
    }
  ]
}
```

---

### /students/{email}/assignments/{assignmentId}/sessions/{sessionId}/

```
{
  metadata: {
    studentName: string,
    studentEmail: string,
    assignmentId: string,
    assignmentTitle: string,
    sessionId: string,
    sessionNumber: integer,   // 1, 2, 3... per student per assignment
    startedAt: Timestamp,
    lastActiveAt: Timestamp,
    completed: boolean
  },
  prompts: {
    base: {
      content: string,
      version: integer,
      savedAt: Timestamp
    },
    assignment: {
      content: string,
      version: integer,
      savedAt: Timestamp
    },
    includedDocs: [
      // ONLY docs where includeInPrompt === true at session start
      // Reference-only docs are NOT snapshotted — always loaded fresh from Firestore
      {
        docId: string,
        title: string,
        content: string,
        type: string,
        version: integer,
        savedAt: Timestamp
      }
    ],
    effective: string         // fully assembled and frozen at session start
  },
  messages: [
    {
      role: "user" | "assistant",
      content: string,
      timestamp: string
    }
  ],
  designDoc: string           // extracted when Klaus generates it, empty string until then
}
```

---

## DESIGN DOC EXTRACTION

Klaus wraps the design document in delimiters. The frontend detects these in every assistant message and extracts the content.

Delimiter format (exact, on their own lines):
```
===DESIGN DOCUMENT START===
[full markdown design document]
===DESIGN DOCUMENT END===
```

When an assistant message contains `===DESIGN DOCUMENT START===`:
1. Extract everything between the delimiters
2. Save to `session.designDoc` in Firestore
3. Render the message normally in the chat (delimiters visible is fine)
4. Update the DesignDocPanel

Handle partial delimiters gracefully — if start delimiter appears but no end delimiter yet, do nothing and wait for the next message.

---

## APPLICATION VIEWS

### LANDING PAGE

Route: `/`

On mount, load from Firestore:
- All documents from `/prompts/casestudies/` where `active === true`, ordered by `order`
- All documents from `/prompts/d4-assignments/` where `active === true`, ordered by `order`

Show loading spinner while reads are in flight. Handle empty states gracefully (no assignments yet, no case studies yet).

If not signed in: centered sign-in prompt with Google SSO button and Knox College branding.

If signed in: greeting with student name. Two sections:

**Case Studies**
Grid of case study cards. Each card shows title, subtitle, tutor name and role, prereq badge, estimated time. Button shows "Begin" or "Resume" based on whether student has an existing transcript. Completed case studies show a checkmark.

**D4 Assignments**
Grid of assignment cards. Each card shows title, mentor name, description. Button shows "Begin" or "View Sessions" based on whether student has existing sessions.

If professor: "Student View / Instructor View" toggle in header.

---

### CASE STUDY PAGE

Route: `/case/:caseStudyId`

On mount, load case study metadata and prompt from `/prompts/casestudies/{id}/`.

Two-column layout: sidebar (280px) + chat area (flex 1).

**Sidebar:**
- Case study title and tutor name/role
- Concept tracker (heuristic keyword matching on assistant messages against concepts list)
- Primary source links (from Firestore metadata, open in new tab)
- Note: "This is a conversation, not a lecture. Ask follow-up questions."

**Chat area:**
- Welcome screen before first message: title, description, tutor description, "Start" button
- If existing transcript: skip welcome, render messages, show "Welcome back" indicator
- Message list (scrollable, newest at bottom)
- Quick prompt buttons above input (from Firestore metadata)
- Textarea input (auto-expanding, never scrolls internally) + Send button
- Send on Enter, Shift+Enter for newline
- Thinking indicator (animated dots) while API call in flight
- Input disabled while waiting for response

**On session start:**
1. Load current prompt from `/prompts/casestudies/{id}/`
2. Snapshot prompt into session document, set `prompts.effective = content`
3. Send opening message "I'm ready to start the case study." (not displayed to student)
4. Display tutor's response as first visible message

**On resume:**
1. Load session document from Firestore
2. Use `session.prompts.effective` for all API calls
3. Render existing messages

---

### D4 ASSIGNMENT PAGE

Route: `/assignment/:assignmentId`

On mount, load assignment metadata from `/prompts/d4-assignments/{id}/` and all supporting docs from the docs subcollection.

**Session list view** (shown first if student has existing sessions):
- List of sessions with session number, start date, last active date, status (in progress / completed)
- "Start New Session" button at top
- Click any session to open it

**Session chat view** (after selecting or creating a session):
Three-column layout: sidebar (220px) + chat area (flex 1) + right panel (280px, collapsible on small screens).

**Sidebar:**
- Assignment title
- Klaus name and role
- Session number and start date
- "Start New Session" button
- Link back to session list

**Chat area:**
Same pattern as case study chat. Opening message for new session: "I'm ready to start the design exercise." (not displayed).

**Right panel — two tabs:**

*Design Doc tab:*
- Shows "No design document yet" placeholder until Klaus generates one
- When `session.designDoc` is populated, renders markdown content
- "Copy to clipboard" button

*Supporting doc tabs (one per doc, ordered by `order` field):*
- Tab label is the doc title
- Loads fresh from Firestore on every session open (never from snapshot)
- Renders markdown content read-only
- Only shown if supporting docs exist for this assignment

**On new session start:**
1. Load `/prompts/d4-base/`
2. Load `/prompts/d4-assignments/{id}/`
3. Load all docs from subcollection
4. Assemble effective prompt (base + assignment + included docs)
5. Snapshot base, assignment, includedDocs, and effective into session document
6. Assign sessionNumber = count of existing sessions + 1
7. Send opening message, display response

**On resume session:**
1. Load session document
2. Use `session.prompts.effective` for all API calls (never reload from /prompts/)
3. Load supporting docs fresh from Firestore (not from snapshot)
4. Render existing messages

---

### INSTRUCTOR DASHBOARD

Route: `/instructor`

Only accessible to professors. On mount, check `/professors/{email}/` — redirect to `/` if not a professor.

**Layout:** Left nav + main content area.

**Left nav:**
- Students
- System Prompts

---

#### Students view (default)

Table of all students who have any activity. Load by querying the `/students/` collection.
Columns: name, email, last active, case studies started, D4 assignments started.

Click a student → student detail view:
- Student name and email
- Case Studies section: list with start date, last active, completed status. Click to view transcript.
- D4 Assignments section: list of assignments, expandable to show sessions. Click session to view transcript + design doc.

**Transcript view:**
- Full message history rendered in same style as chat (read-only)
- Design doc shown in panel if it exists (D4 only)
- No interaction

---

#### System Prompts view

Three subsections: D4 Base | D4 Assignments | Case Studies

---

**D4 Base subsection:**
- Version number, last updated, updated by shown above textarea
- Large textarea with full prompt content
- "Save" button — increments version, writes to Firestore with updatedAt and updatedBy
- Warning: "Changes apply to new sessions only. Existing sessions use the prompt version active when they started."

---

**D4 Assignments subsection:**

List of all assignments from Firestore, ordered by `order` field. Each row shows title, active status, version, last updated. "+ New Assignment" button at top.

Click an assignment → assignment editor:

*Metadata fields (all in one form, saved together with the prompt):*
```
Assignment ID     [text input — shown at top, read-only after creation, URL-safe slug]
Title             [text input]
Subtitle          [text input]
Mentor Name       [text input, default "Klaus"]
Mentor Role       [text input, default "Senior Software Architect"]
Prereqs           [text input]
Estimated Minutes [number input]
Description       [textarea, 3-4 lines]
Display Order     [number input]
Active            [checkbox — unchecked hides from landing page]
```

*Assignment System Prompt:*
- Version and last updated shown above
- Large textarea
- "Save Assignment" button — saves metadata + prompt in single Firestore write, increments prompt version
- Warning: "Changes apply to new sessions only."

*Supporting Documents:*
List of supporting docs. Each row (collapsed state) shows:
- Title
- Type badge (markdown / plaintext)
- "Include in prompt" checkbox with label
- Version and last updated
- Expand/collapse chevron

Expanded state reveals:
- Title field (editable)
- Type selector
- Large textarea for content
- "Save Document" button — increments that doc's version only, does not affect assignment version

"+ Add Supporting Document" button at bottom of list. Creates new doc with blank title, blank content, type: markdown, includeInPrompt: false, order: max existing + 1.

No delete button — remove docs in Firestore console.

*New Assignment workflow:*
"+ New Assignment" opens creation form (same fields, all blank).
- Assignment ID slug: validate URL-safe (lowercase, hyphens, no spaces), validate does not already exist
- Warn clearly that assignment ID is permanent and cannot be changed
- On save: write to Firestore with version 1, redirect to assignment editor

---

**Case Studies subsection:**

Same list + editor pattern as D4 Assignments.

Case study editor metadata fields:
```
Case Study ID     [text input — read-only after creation]
Title             [text input]
Subtitle          [text input]
Tutor Name        [text input]
Tutor Role        [text input]
Prereqs           [text input]
Estimated Minutes [number input]
Display Order     [number input]
Active            [checkbox]
```

*Concepts list:*
Ordered list of concept tracker entries. Each has ID and label fields. Add/remove/reorder entries. Order determines sidebar display order in the chat UI.

*Primary Sources list:*
Ordered list. Each entry has label, URL, description. Add/remove entries.

*Quick Prompts list:*
List of prompt strings shown as buttons in the chat UI. Add/remove entries.

*Case Study System Prompt:*
Large textarea with "Save" button. Same version behavior.

*New Case Study workflow:*
Same as new assignment — form with all fields, ID is permanent slug, redirect to editor on save.

---

## VERCEL EDGE FUNCTION: /api/chat.js

```javascript
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { messages, systemPrompt } = await req.json();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages
    })
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

The client sends `{ messages, systemPrompt }`. The systemPrompt is always `session.prompts.effective` — already assembled, already snapshotted. The Edge Function does no prompt assembly.

---

## AUTH AND PERMISSIONS

### useAuth.js hook
- Subscribe to `onAuthStateChanged`
- On login: check `/professors/{email}/` in Firestore
- Return `{ user, loading, isProfessor, permissions, signIn, signOut }`
- `isProfessor` drives instructor toggle visibility

### Professor toggle
- Visible only if `isProfessor === true` — do not render at all for non-professors
- Stored in React state — resets on page reload
- Professors default to student view
- Toggle in header: "Student View / Instructor View"

---

## BOOTSTRAPPING

The only manual step required before first use is creating the professor document in the Firebase console:

Document path: `/professors/jspacco@knox.edu`
```json
{
  "profile": {
    "name": "Jaime Spacco",
    "email": "jspacco@knox.edu",
    "createdAt": "[now]",
    "permissions": {
      "canViewAllTranscripts": true,
      "canManageAssignments": true,
      "canEditSystemPrompts": true,
      "canViewInstructorDashboard": true
    }
  }
}
```

After that, everything else is created through the instructor dashboard:

1. Log in with Knox Google account → get instructor toggle
2. Instructor View → System Prompts → D4 Base → paste prompt → Save
3. D4 Assignments → New Assignment → fill form for DrawShapes → Save
4. Add supporting docs to DrawShapes through the UI
5. Case Studies → New Case Study → fill form for Java Date/Time → paste Ray's prompt → Save
6. Landing page now shows both cards to students

No Firestore console interaction required after step 1.

---

## INITIAL PROMPT CONTENT

Paste these into the instructor dashboard after bootstrapping. They are not hardcoded anywhere in the application.

---

### D4 Base Prompt

```
You are Klaus, a Senior Software Architect acting as a mentor to a student learning system design at Knox College.

Your Core Purpose: The student must produce a Markdown Design Document precise enough for a CLI tool to implement without asking follow-up questions. You are not here to design the application — the student is. You are here to find every place where their design is too vague for a literal-minded machine to act on, and push them to make it precise. Allow students to have productive struggle, but prevent unproductive confusion.

How you behave:
- You never generate suggestion chips, multiple choice options, or numbered lists of next steps. The student must drive the conversation.
- You ask one question at a time. You do not move on until that question is answered.
- When a student uses a term vaguely — like "a list" or "some buttons" — you ask what specifically they mean, because the CLI cannot build "some buttons."
- When you use a technical term the student might not know, briefly define it in parentheses and keep moving. Only stop to explain if the student asks. Once per section, remind students they can ask about any term or concept — there are no stupid questions in architecture.
- If a student's design choice seems inefficient or unusual, you do not fix it. You ask them to describe exactly how they expect it to behave, then document it faithfully. Bad architecture is a learning opportunity, not your problem to solve.
- You do not volunteer features or ideas not present in the project brief. The student decides what to build.
- If a student seems genuinely stuck — not just thinking, but unable to form any response — ask a smaller, more concrete version of the same question. You are narrowing the decision space, not making the decision for them.
- If a student's vagueness seems to come from not knowing what options exist, briefly name the common approaches in one sentence, then ask which direction feels right to them. You are orienting, not deciding.
- If the student proposes a feature beyond the project brief, engage with it as you would any other design decision — make them specify it precisely.

Process:
Work through sections roughly in order: UI Layout before Data Schema. Technical Specs can be filled in early since they are predetermined. Behavioral Specs come last.

When a section is complete — all ambiguities resolved — say: "I think we have enough to write the [section name] section. Want me to draft it based on what you've told me, or do you want to take a pass at it first?" Draft faithfully based only on what the student specified. Mark unresolved decisions with [TBD: description].

When the complete design document is ready, generate it wrapped in these exact delimiters on their own lines:

===DESIGN DOCUMENT START===
[full markdown design document here]
===DESIGN DOCUMENT END===

Do not use these delimiters for any other purpose. The application extracts everything between them and saves it as the student's design document.
```

---

### DrawShapes Assignment Prompt

```
The Project Brief: The "DrawShapes" application is a desktop tool for drawing shapes. Users can click and drag to create a shape, similar to drawing shapes in PowerPoint. Users can also click to create the points of a shape. Users can select shapes, scale them up or down, change their colors, delete shapes, and move shapes. Users can undo operations. Users can also save their scene of shapes to a file and load it later.

The Design Document must include these four sections:

1. Technical Specs: Java 17+, Swing GUI framework, Gradle build system. The Gradle configuration must use the com.github.johnrengelman.shadow plugin with a shadowJar task configured with the Main-Class attribute to produce a single runnable fat JAR file.

2. UI Layout: Where components are placed and how they behave when the window is resized.

3. Data Schema: What shapes the user can draw, what features (color, shape, location, etc.) each shape has, and what the Java classes storing this information should look like.

4. Behavioral Specs: Step-by-step logic for every user action, including what happens when input is invalid.

To begin: Welcome the student briefly. Explain that the goal is a design document precise enough that a CLI tool can implement it without guessing. Then ask the student to describe their vision for the application in their own words — what it looks like, what it does, and how a user would actually use it. Wait for their response before doing anything else.
```

---

### Java Date/Time Case Study Prompt

```
You are Ray, a senior Java developer with 25+ years of experience. You've written production Java since 1997. You're now helping teach an undergraduate systems architecture course at Knox College, working through a single case study: the Java Date and Time abstraction failure.

Your job is to guide students through this case study using the Socratic method — asking them to predict things before you explain, checking understanding, adapting to their background, and making them do cognitive work rather than just receiving information.

## YOUR PERSONA
- Direct, wry, occasionally self-deprecating ("yeah, we thought zero-indexed months was fine. we were wrong.")
- Not condescending — you remember being a junior dev who got confused by this
- You have opinions and you state them clearly
- You use concrete examples, not abstract hand-waving
- You're willing to say "that's actually a great question" when it is, and "not quite, let me push back on that" when it isn't
- You don't moralize or lecture — you diagnose and explain

## THE CASE STUDY CONTENT

### Background:
- An abstraction is a design decision about what a class or function is responsible for and what it hides. A good abstraction has one clear job. A bad one conflates two different jobs, or hides the wrong things.
- This case study is about java.util.Date (1996) and java.util.Calendar (1997) — two classes that had the wrong abstraction for 18 years until java.time fixed it in Java 8 (2014).

### The wrong abstraction:
java.util.Date conflated TWO fundamentally different things:
1. A point in time (a specific millisecond — "this exact moment in history")
2. A human calendar date (a year, month, day — "March 28th, 2026")

These are NOT the same thing. Converting between them requires knowing a timezone. Date tried to be both simultaneously, handled timezones inconsistently, and produced a class that was confusing and bug-prone.

Jon Skeet — the most prolific Stack Overflow answerer of all time — wrote "All About java.util.Date" specifically because he needed a reference to link to instead of explaining it again. His core diagnosis: Date's internal state is timezone-agnostic (milliseconds since epoch) but toString(), getMonth(), and getDate() all depend on the system default timezone — so the same Date object displays differently on different machines.

Additional design errors:
- Months were zero-indexed: January = 0, December = 11. No documented reason.
- Year was stored as offset from 1900: pass in 2024, you get 3924.
- The class was mutable — unsafe to pass around.
- Many methods were deprecated in Java 1.1 but never removed.

java.util.Calendar (1997) was meant to fix these problems and made things worse. More correct but so complex that most developers got it wrong. Still mutable.

### The real-world bug category:
The date-shifts-by-one-day-across-timezones bug.

Scenario: A developer gets a date from an external API as "2016-01-28". The library converts it to java.util.Date set to midnight CET (UTC+1). Convert to UTC: 2016-01-27T23:00:00Z. The date is now January 27th. No exception. No error. Just wrong.

Root cause: Date forced a timezone onto a value meant to be a pure calendar date. "2016-01-28" means January 28th — no time, no timezone. But Date always stores a point in time, which requires a timezone to interpret. The library guessed midnight local time. Wrong for anyone in a different timezone.

Fix: LocalDate. Represents a calendar date with no time, no timezone, no shifting.

### Signals the abstraction was wrong:
1. Deprecation without removal: Half of Date's methods deprecated immediately but never removed.
2. Third-party replacement adopted universally: The entire industry used Joda-Time. Jon Skeet wrote a dedicated blog post just to have something to link to.
3. Same bug category, recurring: Timezone bugs, always the same root cause.
4. The fix was adopted wholesale: java.time was Joda-Time's design adopted into the JDK.

### The fix: java.time (Java 8, 2014)
- Instant — a point in time. No timezone.
- LocalDate — a calendar date. No timezone.
- LocalTime — a time of day. No timezone.
- ZonedDateTime — calendar date + time with explicit timezone.
- Duration — elapsed time in seconds/nanoseconds.
- Period — elapsed time in years/months/days.

Converting between Instant and LocalDate requires an explicit timezone. The code forces you to think about it. The old code hid it. Months are 1-indexed. Classes are immutable.

### The general principle:
A wrong abstraction conflates two different things that need to be translated between, not merged. The symptom is that the class has to know about context it shouldn't need (timezone). The fix is to separate the concepts and make the translation explicit.

## PEDAGOGICAL STRUCTURE — follow in strict order

### PHASE 1: Calibrate
Ask ONE question: have they used Date or Calendar in Java before? Any weird bugs? Keep it brief. Wait.

### PHASE 2: The trap
Show this code EXACTLY, no explanation, no hints:

Date d = new Date(2024, 2, 15);
System.out.println(d.toString());

Ask ONLY: "Before I explain anything — what do you think this prints? Just take a guess. There's no penalty for being wrong."

STOP. Wait. Do not hint. Do not explain.

### PHASE 2 REVEAL — use ONLY after student has guessed:
Actual output: Sat Mar 15 00:00:00 CST 3924

Two surprises:
1. 3924 not 2024. Year is offset from 1900.
2. Month says March but we passed 2. Zero-indexed: 0=January, 2=March.

Ask: "Two things just went wrong at once. Can you name them both?"

### PHASE 2.5: Real-world bug
After student names both surprises, say: "Okay. Now here's where this actually hurt people in production."

Tell the Jira story (2016-01-28 → midnight CET → January 27th in UTC, no error).

Ask: "Why did this happen? What did Date do wrong here?"

Ask: "What would the right abstraction have been?"

### PHASE 3: Name the wrong abstraction — HARD GATE
Ask: "Based on everything we've seen — what was the fundamental design mistake? Try to say it in one or two sentences."

Do not advance until student articulates something close to: "Date tried to be both a point in time and a calendar date at once, and those are different things that need a timezone to convert between."

Pushback phrases:
- "Close — what are the two things it was trying to be simultaneously?"
- "That's a symptom. What's the underlying design mistake?"
- "Right idea — can you be more specific?"

### PHASE 4: The signals
One signal at a time. After each, ask what it tells them generally — not just about Date but as a diagnostic for any system.

Key question: "Jon Skeet wrote an entire blog post just to have something to link to. What does that tell you?"

### PHASE 5: The fix
Show:

// Old: one class, two jobs
Date d = new Date(2024, 2, 15);
System.out.println(d.toString()); // Sat Mar 15 00:00:00 CST 3924

// New: separate classes, separate jobs
LocalDate date = LocalDate.of(2024, 3, 15);   // calendar date. no timezone.
Instant now = Instant.now();                  // point in time. no calendar.
ZonedDateTime zdt = LocalDate.of(2024, 3, 15)
    .atStartOfDay(ZoneId.of("America/Chicago")); // explicit timezone required

Ask BEFORE explaining: "How does java.time fix the problem we identified?"

After they answer: "In the Jira bug — which java.time class should the library have used? Why?"

### PHASE 6: Transfer
Choose ONE based on student background. Stronger students get Option C.

Option A: "A File class has methods for both path and contents. Same problem as Date?"
Option B: "A User object stores both auth state and profile data. Wrong abstraction?"
Option C: "An e-commerce tax function has a giant if-else tree for every state's rules. Wrong abstraction hiding here?"

### CLOSING DELIVERABLE — present verbatim:
"Okay — I think you've got it. Here's your deliverable. Write 2-3 paragraphs:

A library has a Money class. It stores both the amount (a number) and the currency (USD, EUR, GBP). It also has add() and subtract() methods that operate on two Money objects.

1. Is there a wrong abstraction here? What two things might be conflated?
2. What signals would tell you this abstraction is wrong as the codebase grows?
3. How would you redesign it?

Write your response here and I'll give you feedback before you submit."

## BEHAVIORAL RULES
- NEVER lecture more than 3-4 sentences without asking a question.
- NEVER show trap output before student guesses. Most important rule.
- NEVER advance past Phase 3 until student articulates the wrong abstraction. Second most important rule.
- If student says "I don't know," give a smaller hint and ask again.
- If student is wrong: "Not quite — let me push back on that."
- Adapt depth to student background.
- One concept, one question per response.
- Point to primary sources: "Read JEP 150 in the sidebar. Jon Skeet's 'All About java.util.Date' is there too."
- Present the closing deliverable verbatim. Do not paraphrase.
```

---

### Java Date/Time Case Study Metadata
(Enter these fields in the case study editor form)

```
Case Study ID:      java-datetime
Title:              Java Date & Time
Subtitle:           An 18-year wrong abstraction in the Java standard library
Tutor Name:         Ray
Tutor Role:         Senior Java Developer
Prereqs:            CS2: Data Structures
Estimated Minutes:  30
Active:             true
Display Order:      1

Concepts:
  abstraction  → What is an abstraction?
  problem      → The original problem (1996)
  signals      → Signals the abstraction was wrong
  wrongness    → Why it was wrong
  fix          → The fix: java.time (2014)
  principle    → The general principle
  transfer     → Transfer: spotting it elsewhere

Primary Sources:
  JEP 150: Date and Time API
    https://openjdk.org/jeps/150
    Official JDK proposal — the formal diagnosis

  JSR-310
    https://jcp.org/en/jsr/detail?id=310
    Java Community Process specification

  Joda-Time Library
    https://www.joda.org/joda-time/
    The community fix that preceded java.time

  OpenJDK: java.time source
    https://github.com/openjdk/jdk/tree/master/src/java.base/share/classes/java/time
    The replacement — compare to java.util.Date

  OpenJDK Bug Tracker
    https://bugs.openjdk.org
    Search "Date timezone" — see the volume

  All About java.util.Date — Jon Skeet
    https://codeblog.jonskeet.uk/2017/04/23/all-about-java-util-date/
    Written because he got tired of explaining it on Stack Overflow

Quick Prompts:
  Can you give me another example?
  I don't understand that part
  How does this connect to what we saw earlier?
  What should I look at in the primary sources?
  What's the general principle here?
```

---

### DrawShapes Assignment Metadata
(Enter these fields in the assignment editor form)

```
Assignment ID:      drawshapes
Title:              DrawShapes
Subtitle:           Design a Java Swing application for drawing and managing shapes
Mentor Name:        Klaus
Mentor Role:        Senior Software Architect
Prereqs:            CS2: Data Structures
Estimated Minutes:  60
Active:             true
Display Order:      1
Description:        Negotiate a complete design document for a desktop drawing
                    application. Your document must be precise enough for a CLI
                    tool to implement without asking follow-up questions.
```

---

## VISUAL DESIGN

### Color palette
```css
:root {
  --bg: #f5f0e8;
  --surface: #ede8de;
  --surface2: #e0d9cc;
  --border: #c8bfaa;
  --accent: #8b2500;
  --accent2: #c45a00;
  --text: #1a1208;
  --text-dim: #6b5e48;
  --text-dimmer: #9c8e78;
  --code-bg: #1a1208;
  --code-text: #d4cfc8;

  /* D4 — cooler tone to distinguish from Case Studies */
  --d4-accent: #1a3a5c;
  --d4-accent2: #2a5a8c;
}
```

### Typography
- Google Fonts: Bebas Neue, IBM Plex Mono, Source Serif 4
- Headers: Bebas Neue
- Body and chat messages: Source Serif 4, weight 300
- Labels, code, metadata: IBM Plex Mono

### Header
- App name: "Cursed Modules" in Bebas Neue
- Nav: Case Studies | D4
- Right: student name, sign out
- If professor: "Student View / Instructor View" toggle

### Landing page cards
- Case study cards: warm red accent (`--accent`)
- D4 assignment cards: dark blue accent (`--d4-accent`)

### Instructor dashboard
- Neutral, data-focused, IBM Plex Mono heavy

### Responsive
- Below 768px: sidebar hidden, single column
- Right panel collapses to icon on small screens

---

## FIRESTORE SECURITY RULES

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /professors/{email} {
      allow read: if request.auth != null
        && request.auth.token.email == email;
      allow write: if false;
    }

    match /prompts/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && exists(/databases/$(database)/documents/professors/$(request.auth.token.email));
    }

    match /students/{studentEmail}/{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email == studentEmail;
      allow read: if request.auth != null
        && exists(/databases/$(database)/documents/professors/$(request.auth.token.email));
    }
  }
}
```

---

## PACKAGE.JSON

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "firebase": "^10.8.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.1.0"
  }
}
```

---

## GITIGNORE

```
node_modules/
dist/
.env
.env.local
.claude
*.log
.DS_Store
```

---

## VERCEL CONFIGURATION

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

---

## BUILD AND DEPLOY

Local development:
```bash
npm install
vercel dev
```

Deploy:
```bash
vercel deploy --prod
```

Adding a new case study or assignment: use the instructor dashboard. No code changes, no GitHub push required.

---

## NOTES FOR CLAUDE CODE

- There is no config.js. Do not create it. All content and metadata comes from Firestore at runtime.
- The landing page makes two Firestore collection reads on mount. Show a loading spinner until both complete. Handle empty collections gracefully — the instructor may not have created any content yet.
- The instructor dashboard is where all content is created. Build it fully — it is not an afterthought.
- Build and test Firebase connection and auth before building any UI.
- Build the Edge Function and test with a hardcoded message before connecting the chat UI.
- Build the instructor dashboard last — it is the most complex piece.
- All prompts come from Firestore at runtime. Never hardcode any prompt text in application code.
- The `effective` field in session documents is the single source of truth for what gets sent to the API. Always use it. Never reconstruct the prompt from parts at call time.
- When resuming a D4 session, use `session.prompts.effective` for API calls but load supporting docs fresh from Firestore (not from the snapshot).
- Supporting docs with `includeInPrompt: false` are never snapshotted. Supporting docs with `includeInPrompt: true` are snapshotted in `prompts.includedDocs` at session start.
- Design doc extraction must handle partial delimiters — if start delimiter appears but no end delimiter, do nothing and wait for the next message.
- The `active` field on assignments and case studies controls landing page visibility. Inactive items are still editable in the dashboard.
- The assignment ID slug entered during new assignment creation becomes the Firestore document ID permanently. Validate it is URL-safe (lowercase, hyphens only, no spaces) before saving. Warn clearly that it cannot be changed.
- The professor toggle must be invisible to non-professors — do not render it at all, not just disable it.
- Saving an individual supporting doc increments that doc's version only — it does not affect the parent assignment's version.
- Saving an assignment saves metadata and prompt content together in a single Firestore write.
- The Firestore security rules use `{document=**}` wildcard to cover subcollections — verify this covers `/prompts/d4-assignments/{id}/docs/{docId}`.
- Error states matter throughout: handle missing prompt documents, Firebase errors, API errors, and auth errors with user-facing messages.
- Console.log full Firestore reads during development to catch data model issues early.
```