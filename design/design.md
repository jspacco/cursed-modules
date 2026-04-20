# Cursed Modules — Design Document
## Version 2.0

---

## OVERVIEW

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
All variables above must be set in Vercel environment settings before the build runs. `ANTHROPIC_API_KEY` is server-only (no VITE_ prefix). Redeploy after setting them.

---

## LOCAL DEVELOPMENT

Use `vercel dev` (not `npm run dev`) for local development. `npm run dev` runs Vite only and does not serve the `api/` Vercel Functions. `vercel dev` starts Vite internally and also mounts the `api/` directory, so `/api/chat` is reachable at `localhost:3000/api/chat`.

Do not set the `dev` npm script to `vercel dev` — this causes a recursive invocation error because Vercel's dev server invokes the `dev` script internally.

---

## REPOSITORY STRUCTURE

```
/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── firebase.js
│   ├── context/
│   │   └── DirtyContext.jsx
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
├── design/
│   ├── README.md
│   ├── design.md          ← this file (canonical spec)
│   └── changes.md         ← append-only changelog
├── .env.example
├── .gitignore
├── vercel.json
├── vite.config.js
└── package.json
```

There is no `src/data/config.js`. All content comes from Firestore.

---

## FIRESTORE DATA MODEL

### Flat top-level collections

Firestore path segments must alternate collection/document. Never use a collection name as a document ID to create pseudo-nesting — documents at odd-segment paths are invalid. All collections in this app are flat and top-level.

---

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

This is the only document that must be seeded manually before first use. The instructor creates it in the Firebase console with their Knox email as the document ID and all permissions set to true. Everything else is created through the instructor dashboard UI. There is no UI for creating or editing professor records.

---

### /config/d4-base

Single document. Holds the D4 base system prompt shared across all D4 assignments.

```
{
  content: string,
  version: integer,       // start at 1, increment on every save
  updatedAt: Timestamp,
  updatedBy: string       // email of instructor who saved
}
```

---

### /d4-assignments/{assignmentId}/

```
{
  // Metadata
  title: string,
  description: string,
  active: boolean,        // false = hidden from landing page
  order: integer,         // default 0; present on all documents

  // Prompt
  content: string,
  version: integer,
  updatedAt: Timestamp,
  updatedBy: string
}
```

The assignment editor exposes only: ID (read-only after creation), title, description, active flag, and system prompt. Mentor name/role, subtitle, prereqs, and estimated minutes are defined inside the prompt text and are not stored as separate fields.

Do not use `orderBy('order', 'asc')` when querying `d4-assignments` unless every document in the collection is guaranteed to have an `order` field — Firestore silently excludes documents missing an `orderBy` field. Assignment documents written by `NewAssignmentForm` include `order: 0` as a default.

---

### /d4-assignments/{assignmentId}/docs/{docId}/

```
{
  title: string,
  content: string,
  type: string,             // 'markdown' | 'plaintext'
  includeInPrompt: boolean, // true = concatenated into effective prompt
  order: integer,           // display order in right panel tabs
  version: integer,
  updatedAt: Timestamp,
  updatedBy: string
}
```

---

### /casestudies/{caseStudyId}/

```
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
1. `/config/d4-base` → base prompt
2. `/d4-assignments/{id}/` → assignment prompt
3. `/d4-assignments/{id}/docs/` → all docs, ordered by `order` field

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
    effective: string
  },
  messages: [
    {
      role: "user" | "assistant",
      content: string,
      timestamp: string   // ISO 8601
    }
  ]
}
```

---

### /students/{email}/assignments/{assignmentId}/

Stub document written on every new session start. Ensures the parent document exists for progress detection.

```
{
  assignmentId: string,
  lastSessionAt: Timestamp
}
```

Written with `setDoc(..., { merge: true })` so it does not overwrite existing data.

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
      // Reference-only docs are NOT snapshotted
      {
        docId: string,
        title: string,
        content: string,
        type: string,
        version: integer,
        savedAt: Timestamp
      }
    ],
    effective: string   // fully assembled and frozen at session start
  },
  messages: [
    {
      role: "user" | "assistant",
      content: string,
      timestamp: string
    }
  ],
  designDoc: string     // extracted when Klaus generates it, empty string until then
}
```

---

### Student progress detection

Do not check for assignment progress by querying the `students/{email}/assignments` collection for parent documents — the parent document may not exist even when sessions do, because Firestore subcollections don't create parent documents automatically.

Query `students/{email}/assignments/{assignId}/sessions` directly instead. `startNewSession` also writes a stub parent document on every new session (see above), so both approaches work for sessions created after that fix.

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
- All documents from `/casestudies/` where `active === true`, ordered by `order`
- All documents from `/d4-assignments/` where `active === true` (no `orderBy` — see data model note)

Use `Promise.all` for both reads. Show loading spinner while reads are in flight. Handle empty states gracefully.

If not signed in: centered sign-in prompt with Google SSO button and Knox College branding.

If signed in: greeting with student name. Two sections in this order:

**D4 Assignments** (shown first)
Grid of assignment cards. Each card shows title, description. When no sessions exist: single **Begin** button navigating to `/assignment/{id}`. When sessions exist: two buttons —
- **New Session** — navigates to `/assignment/{id}` with React Router state `{ autoNew: true }`
- **Continue** — navigates to `/assignment/{id}` normally (session list view)

**Case Studies** (shown second)
Grid of case study cards. Each card shows title, subtitle, tutor name and role, prereq badge, estimated time. Button shows "Begin" or "Resume" based on existing transcript. Completed case studies show a checkmark.

If professor: "Student View / Instructor View" toggle in header.

---

### CASE STUDY PAGE

Route: `/case/:caseStudyId`

On mount, load case study metadata and prompt from `/casestudies/{id}/`.

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
- **Auto-focus:** `ChatInput` focuses the textarea whenever `disabled` transitions to `false` — no manual click needed after a server response

**On session start:**
1. Load current prompt from `/casestudies/{id}/`
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

On mount, load assignment metadata from `/d4-assignments/{id}/` and all supporting docs from the docs subcollection.

**Auto-start new session:** If the page receives `location.state.autoNew === true` on mount (set by the "New Session" button on the landing page), wait for assignment data and sessions to finish loading, then call `handleNewSession()` automatically. Use a `useRef` flag (`autoNewTriggered`) to ensure this fires at most once per navigation.

---

**Session list view** (shown first if student has existing sessions):
- List of sessions with session number, start date, last active date, status (in progress / completed)
- "New Session" button at top
- Click any session to open it

---

**Session chat view** (after selecting or creating a session):
Three-column layout: sidebar (220px) + chat area (flex 1) + right panel (280px, collapsible on small screens).

**Sidebar:**
- Assignment title
- Session number and start date
- "← All Sessions" back link
- No "New Session" button — new sessions are started from the session list or the landing page

**Chat area:**
Same pattern as case study chat, including auto-focus behavior. Opening message for new session: "I'm ready to start the design exercise." (not displayed to student).

**Right panel — three tabs in this order:**

1. **Description** — shows `assignment.title` as heading and `assignment.description` as body text. This is the default tab on session open and session start.
2. **Supporting doc tabs** — one tab per supporting doc, ordered by `order` field. Tab label is doc `title`; fallback label is `'Other Docs'`. Content loaded fresh from Firestore on every session open (never from snapshot). Rendered read-only as markdown.
3. **Design Doc** — renders `session.designDoc` as markdown. Shows "No design document yet." placeholder until Klaus generates one. "Copy to clipboard" button. The Design Doc tab button must set `activeTab` to the string `'design'`.

---

**New session flow:**

Session creation and the opening-message API call are in **separate try-catch blocks**:

1. **First block:** call `startNewSession()`:
   - Load `/config/d4-base`
   - Load `/d4-assignments/{id}/`
   - Load all docs from subcollection
   - Assemble effective prompt (base + assignment + included docs)
   - Snapshot base, assignment, includedDocs, and effective into session document
   - Assign sessionNumber = count of existing sessions + 1
   - Write stub parent document at `students/{email}/assignments/{assignmentId}`
   - **Return the assembled effective prompt** so the caller does not depend on state propagation timing
   - On failure: show "Failed to start session" error and return early

2. **Second block:** call `callChatAPI([openingMsg], effectivePrompt)` using the value returned from `startNewSession`:
   - On failure: log to console only — the session is already open, student can begin typing

**On resume session:**
1. Load session document
2. Use `session.prompts.effective` for all API calls (never reload from source collections)
3. Load supporting docs fresh from Firestore (not from snapshot)
4. Render existing messages
5. Set default tab to Description

---

### INSTRUCTOR DASHBOARD

Route: `/instructor`

Only accessible to professors. On mount, check `/professors/{email}/` — redirect to `/` if not a professor.

**Layout:** Left nav (four items) + main content area.

**Left nav items:**
- **Students** (default)
- **D4 Base**
- **D4 Assignments**
- **Case Studies**

There is no "System Prompts" grouping. Each nav item dispatches directly to the corresponding content view. All nav clicks are wrapped in `guardedNavigate` to protect unsaved changes.

`SystemPromptsView` receives the active tab as a prop (`activeTab`) rather than managing its own sub-tab state.

---

#### Students view

Table of all students who have any activity. Columns: name, email, last active, case studies started, D4 assignments started.

Click a student → student detail view:
- Student name and email
- Case Studies section: list with start date, last active, completed status. Click to view transcript.
- D4 Assignments section: list of assignments, expandable to show sessions. Click session to view transcript + design doc.

**Transcript view:**
- Full message history rendered in same style as chat (read-only)
- Design doc shown in panel if it exists (D4 only)
- No interaction

---

#### D4 Base view

- Version number, last updated, updated by shown above textarea
- Large textarea with full prompt content
- "Save" button — increments version, writes to `/config/d4-base` with updatedAt and updatedBy
- Warning: "Changes apply to new sessions only."
- Uses `setDoc(ref, data, { merge: true })` — never `updateDoc()`

---

#### D4 Assignments view

List of all assignments from Firestore. Each row shows title, active status, version, last updated. "+ New Assignment" button at top.

Click an assignment → assignment editor:

**Assignment editor fields:**
```
Assignment ID     [text — read-only after creation, shown at top]
Title             [text input]
Description       [textarea, 3-4 lines]
Active            [checkbox — unchecked hides from landing page]
```

Mentor name/role, subtitle, prereqs, and estimated minutes are not stored as separate fields — define them in the system prompt text.

**Assignment System Prompt:**
- Version and last updated shown above
- Large textarea
- "Save Assignment" button — saves metadata + prompt content in a single Firestore write, increments prompt version
- Uses `setDoc(ref, data, { merge: true })` — never `updateDoc()`
- Warning: "Changes apply to new sessions only."

**Supporting Documents:**
List of supporting docs. Each row (collapsed) shows: title, type badge, "Include in prompt" checkbox, version, last updated, expand/collapse chevron.

Expanded state: title field, type selector, large content textarea, "Save Document" button.

"Save Document" increments that doc's version only — does not affect the parent assignment's version. Uses `setDoc(ref, data, { merge: true })`.

"+ Add Supporting Document" creates a new doc with blank title, blank content, type: markdown, includeInPrompt: false, order: max existing + 1.

No delete button — remove docs in Firestore console.

**New Assignment workflow:**
Form collects: ID (permanent slug), title, description, display order (written as `order: 0` if not set), active flag, and system prompt content. Mentor name/role are defined in the prompt text. Prereqs and estimated minutes are omitted.

- Validate ID is URL-safe (lowercase, hyphens only, no spaces)
- Validate ID does not already exist
- Warn clearly that assignment ID is permanent and cannot be changed
- On save: write to Firestore with version 1, redirect to assignment editor

---

#### Case Studies view

Same list + editor pattern as D4 Assignments.

Case study editor metadata fields:
```
Case Study ID     [text — read-only after creation]
Title             [text input]
Subtitle          [text input]
Tutor Name        [text input]
Tutor Role        [text input]
Prereqs           [text input]
Estimated Minutes [number input]
Display Order     [number input]
Active            [checkbox]
```

**Concepts list:** Ordered list. Each entry has ID and label fields. Add/remove/reorder. Order determines sidebar display order in the chat UI.

**Primary Sources list:** Ordered list. Each entry has label, URL, description. Add/remove.

**Quick Prompts list:** List of prompt strings shown as buttons in the chat UI. Add/remove.

**Case Study System Prompt:** Large textarea with "Save" button. Same version behavior and `setDoc({ merge: true })` requirement.

**New Case Study workflow:**
Form collects only: ID, title, display order, active flag, and system prompt content. Subtitle, tutor name/role, prereqs, and estimated minutes are omitted from creation — fill in via the case study editor after creation.

- ID validation same as assignment (URL-safe slug, permanent)
- On save: write to Firestore with version 1, redirect to editor

---

## DIRTY BUFFER GUARD

Any navigation action that would discard unsaved changes in an instructor editor must pass through `guardedNavigate()` from `DirtyContext`.

### Architecture

**`src/context/DirtyContext.jsx`** exports:
- `DirtyProvider` — wrap the app with this in `App.jsx`
- `useDirty()` — returns `{ setDirty, guardedNavigate }`

```javascript
// Editors call on any field change:
setDirty(true, handleSave)   // registers dirty state + save callback

// Editors call after successful save or on unmount:
setDirty(false)

// Navigation points call instead of navigating directly:
guardedNavigate(() => { /* the navigation action */ })
```

`setDirty` stores the dirty flag and save callback in **refs** (not state) to avoid re-renders on every keystroke. The save callback is updated on every change so it always closes over the latest field values.

Each editor uses a `fieldsRef` / `formRef` pattern: state drives the UI, the ref stays in sync, and `handleSave` reads from the ref. This avoids stale closure bugs when the modal's Save button invokes the callback.

### Modal behavior

When `guardedNavigate` is called with a pending dirty buffer, show a modal with three choices:
- **Save** — runs the editor's save function, then proceeds with navigation
- **Discard** — discards changes and navigates immediately
- **Cancel** — closes the modal, stays on current view

`DirtyProvider` renders the modal at the app root.

### Navigation points that use guardedNavigate

| Location | Trigger |
|---|---|
| `Header.jsx` | Student View ↔ Instructor View toggle |
| `InstructorDashboard` main | Left nav items (Students, D4 Base, D4 Assignments, Case Studies) |
| `AssignmentEditor` | ← Back button |
| `CaseStudyEditor` | ← Back button |

### Editors that register dirty state

| Editor | Fields tracked |
|---|---|
| `InlinePromptEditor` | `content` (via `contentRef`) |
| `DocEditor` | `title`, `content`, `type`, `includeInPrompt` (via `fieldsRef`) |
| `AssignmentEditor` | All metadata fields + prompt content (via `formRef`) |
| `CaseStudyEditor` | All metadata fields + `concepts`, `primarySources`, `quickPrompts`, prompt content (via separate refs) |

### CSS classes (in global.css)

```
.dirty-overlay        — full-screen semi-transparent backdrop
.dirty-modal          — centered card
.dirty-modal-title    — modal heading
.dirty-modal-body     — explanatory text
.dirty-modal-actions  — flex row for Save / Discard / Cancel buttons
```

---

## SESSION HOOKS

### useSession.js

Maintains a `messagesRef` in sync with `messages` state. All functions that append or replace messages must use `setMessagesSync` (which updates both the ref and the state) and must read from `messagesRef.current` — never from the `messages` state variable directly. This prevents stale-closure bugs when multiple async appends fire before a re-render.

```javascript
const messagesRef = useRef([]);

const setMessagesSync = (msgs) => {
  messagesRef.current = msgs;
  setMessages(msgs);
};
```

`startNewSession` returns the assembled effective prompt string so the caller can pass it directly to the opening-message API call without waiting for state propagation.

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

  // Forward Anthropic's HTTP status — always returning 200 masks API errors
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

The client sends `{ messages, systemPrompt }`. The systemPrompt is always `session.prompts.effective` — already assembled, already snapshotted. The Edge Function does no prompt assembly.

The frontend must throw on non-OK responses: `if (!res.ok) throw new Error(...)`.

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
- Clicking "Student View" calls `guardedNavigate` → `setViewMode('student'); navigate('/')`
- Clicking "Instructor View" calls `guardedNavigate` → `setViewMode('instructor'); navigate('/instructor')`

---

## FIRESTORE RULES

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /professors/{email} {
      allow read: if request.auth != null
        && request.auth.token.email == email;
      allow write: if false;
    }

    match /config/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && exists(/databases/$(database)/documents/professors/$(request.auth.token.email));
    }

    match /d4-assignments/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && exists(/databases/$(database)/documents/professors/$(request.auth.token.email));
    }

    match /casestudies/{document=**} {
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

Note: The `/config/{document}` rule replaces the old `/prompts/{document=**}` rule. The `{document=**}` wildcard on `d4-assignments` and `casestudies` covers their subcollections.

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

### Card footer buttons
- `.card-footer`: `display: flex; gap: 8px`
- `.card-btn`: `flex: 1` (fills full width when solo; shares row equally when two buttons present)

### Instructor dashboard
- Neutral, data-focused, IBM Plex Mono heavy

### Responsive
- Below 768px: sidebar hidden, single column
- Right panel collapses to icon on small screens

---

## BOOTSTRAPPING

The only manual step required before first use:

**Create professor document in Firebase console:**

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
2. Instructor View → D4 Base → paste prompt → Save
3. D4 Assignments → New Assignment → fill form for DrawShapes → Save
4. Add supporting docs to DrawShapes through the UI
5. Case Studies → New Case Study → fill form for Java Date/Time → paste Ray's prompt → Save
6. Landing page now shows both cards to students

---

## INSTRUCTOR DASHBOARD SAVE RULES

All save operations in the instructor dashboard use `setDoc(ref, data, { merge: true })` rather than `updateDoc()`. This ensures saves succeed even when the target document does not yet exist (e.g., the d4-base prompt on a fresh project). Never use `updateDoc()` for instructor dashboard writes.

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

```
Assignment ID:      drawshapes
Title:              DrawShapes
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

## NOTES FOR CLAUDE CODE

- There is no config.js. Do not create it. All content and metadata comes from Firestore at runtime.
- Use `vercel dev` for local development, not `npm run dev`. Vite alone does not serve `/api/` functions.
- All instructor dashboard saves use `setDoc(ref, data, { merge: true })`. Never use `updateDoc()`.
- The landing page makes two Firestore reads on mount with `Promise.all`. Show a loading spinner until both complete. Handle empty collections gracefully.
- The instructor dashboard has four left nav items: Students, D4 Base, D4 Assignments, Case Studies. No "System Prompts" grouping.
- All nav clicks in the instructor dashboard go through `guardedNavigate` from `DirtyContext`.
- The D4 base prompt lives at `/config/d4-base`, not under `/prompts/`. D4 assignments are at `/d4-assignments/{id}`. Case studies are at `/casestudies/{id}`. All flat top-level collections.
- Do not query `d4-assignments` with `orderBy('order')` unless guaranteed all documents have that field. Firestore silently excludes documents missing the ordered field.
- Check for assignment progress by querying the sessions subcollection directly — do not rely on the parent assignment document existing.
- `startNewSession` must return the assembled effective prompt string so the opening message call does not depend on state propagation timing.
- Session creation and the opening message API call are in separate try-catch blocks. Opening message failure is console-only — the session is already open.
- `useSession` must use a `messagesRef` kept in sync with state via `setMessagesSync`. Never read from the `messages` state variable in async append functions — always read from `messagesRef.current`.
- The edge function must forward `status: response.status` from the Anthropic response. The frontend must throw on non-OK responses.
- `ChatInput` auto-focuses the textarea when `disabled` transitions to `false`.
- The right panel default tab is always Description, not Design Doc.
- The Design Doc tab button must set `activeTab` to the string `'design'`.
- Supporting doc tab labels fall back to `'Other Docs'` if title is absent.
- The assignment editor does not have a "New Session" button in the sidebar — only in the session list and on the landing page.
- The professor toggle must be invisible to non-professors — do not render it at all.
- Supporting docs with `includeInPrompt: false` are never snapshotted. Those with `includeInPrompt: true` are snapshotted in `prompts.includedDocs`. When resuming, always load supporting docs fresh from Firestore regardless of snapshot.
- Saving a supporting doc increments that doc's version only — it does not affect the parent assignment's version.
- Design doc extraction must handle partial delimiters — if start delimiter appears but no end delimiter, do nothing and wait.
- The `active` field controls landing page visibility. Inactive items remain editable in the dashboard.
- The assignment ID slug is permanent and becomes the Firestore document ID. Validate URL-safe before saving. Warn clearly that it cannot be changed.
- Error states matter: handle missing prompt documents, Firebase errors, API errors, and auth errors with user-facing messages.
- Console.log full Firestore reads during development to catch data model issues early.