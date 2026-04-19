# Design Changes Log

Changes made to the running application that are not reflected in `design.md`.
Merge these into `design.md` if rebuilding the app from scratch.

---

## 2026-04-10 — Fix: Use setDoc({ merge: true }) for all instructor dashboard saves

**File:** `src/pages/InstructorDashboard.jsx`

**Problem:** All four save operations used `updateDoc()`, which throws if the target document does not yet exist. This broke saving the D4 base system prompt on a fresh Firebase project where that document had never been written, and would similarly fail for any assignment, case study, or supporting doc that was created outside the normal "new item" flow.

**Fix:** Replaced all four `updateDoc()` calls with `setDoc(..., { merge: true })`. This creates the document if it does not exist and merges fields if it does, while preserving any fields not included in the write. The `updateDoc` import was removed from the Firestore imports.

**Calls changed:**

| Component | Document path |
|---|---|
| `InlinePromptEditor` | `/prompts/d4-base` (and any other prompt doc path) |
| `DocEditor` | `/prompts/d4-assignments/{id}/docs/{docId}` |
| `AssignmentEditor` | `/prompts/d4-assignments/{id}` |
| `CaseStudyEditor` | `/prompts/casestudies/{id}` |

**Design.md addition** (under `## INSTRUCTOR DASHBOARD → System Prompts`):

> All save operations use `setDoc(ref, data, { merge: true })` rather than `updateDoc()`. This ensures saves succeed even when the target document does not yet exist (e.g., the d4-base prompt on a fresh project). Never use `updateDoc()` for instructor dashboard writes.

---

## 2026-04-10 — Fix: Student View toggle navigation

**File:** `src/components/Header.jsx`

**Problem:** Clicking "Student View" in the instructor toggle only called `setViewMode('student')` but did not navigate away from `/instructor`. The view stayed on the instructor dashboard.

**Fix:** Both toggle buttons now call `navigate()` as well as `setViewMode()`:
- Student View → `setViewMode('student'); navigate('/')`
- Instructor View → `setViewMode('instructor'); navigate('/instructor')`

**Design.md addition** (under `## AUTH AND PERMISSIONS → Professor toggle`):

> Clicking "Student View" navigates to `/`. Clicking "Instructor View" navigates to `/instructor`. Both use `guardedNavigate` (see Dirty Buffer section below) so unsaved changes are not silently discarded.

---

## 2026-04-10 — Feature: Dirty buffer guard

**Files added:** `src/context/DirtyContext.jsx`

**Files modified:** `src/App.jsx`, `src/components/Header.jsx`, `src/pages/InstructorDashboard.jsx`, `src/styles/global.css`

### What it does

When any editor in the instructor dashboard has unsaved changes (dirty buffer), navigating away shows a modal with three choices:

- **Save** — runs the editor's save function, then proceeds with navigation
- **Discard** — discards changes and navigates immediately
- **Cancel** — closes the modal and stays on the current view

### Architecture

**`src/context/DirtyContext.jsx`** exports:

- `DirtyProvider` — wrap the app with this (done in `App.jsx`)
- `useDirty()` — returns `{ setDirty, guardedNavigate }`

```javascript
// Editors call this on any field change:
setDirty(true, handleSave)   // registers dirty state + save callback

// Editors call this when saved (or on unmount):
setDirty(false)

// Navigation points call this instead of navigating directly:
guardedNavigate(() => { /* the navigation action */ })
```

`setDirty` stores the dirty flag and save callback in refs (not state) to avoid re-renders on every keystroke. The save callback is updated on every change so it always closes over the latest field values.

Each editor uses a `fieldsRef` / `formRef` pattern: state drives the UI, the ref stays in sync, and `handleSave` reads from the ref. This avoids stale closure bugs when the modal's Save button invokes the callback.

### Navigation points guarded

| Location | Trigger |
|---|---|
| `Header.jsx` | Student View ↔ Instructor View toggle |
| `InstructorDashboard` main | Students ↔ System Prompts left nav |
| `SystemPromptsView` | D4 Base / D4 Assignments / Case Studies subnav tabs |
| `AssignmentEditor` | ← Back button |
| `CaseStudyEditor` | ← Back button |

### Editors that register dirty state

| Editor | Fields tracked |
|---|---|
| `InlinePromptEditor` | `content` (via `contentRef`) |
| `DocEditor` | `title`, `content`, `type`, `includeInPrompt` (via `fieldsRef`) |
| `AssignmentEditor` | All metadata fields + prompt content (via `formRef`) |
| `CaseStudyEditor` | All metadata fields + `concepts`, `primarySources`, `quickPrompts`, prompt content (via separate refs) |

### CSS classes added to `global.css`

```
.dirty-overlay      — full-screen semi-transparent backdrop
.dirty-modal        — centered card containing the prompt
.dirty-modal-title  — modal heading
.dirty-modal-body   — explanatory text
.dirty-modal-actions — flex row for Save / Discard / Cancel buttons
```

### Design.md addition

Add a new top-level section:

```
## DIRTY BUFFER GUARD

Any navigation action that would discard unsaved changes in an instructor
editor must pass through `guardedNavigate()` from `DirtyContext`.

Editors signal dirty state by calling `setDirty(true, handleSave)` on any
field change and `setDirty(false)` after a successful save or on unmount.

Save callbacks must read from refs (not closed-over state) to ensure the
modal's Save button sees the latest field values.

The DirtyProvider renders the confirmation modal at the app root and is
responsible for calling the registered save function, clearing dirty state,
and invoking the pending navigation.
```

---

## 2026-04-10 — Fix: Restructure Firestore paths to flat top-level collections

**Files modified:** `src/pages/InstructorDashboard.jsx`, `src/pages/Assignment.jsx`, `src/pages/CaseStudy.jsx`, `src/pages/Landing.jsx`

**Problem:** The original design used paths like `/prompts/d4-base`, `/prompts/d4-assignments/{id}`, and `/prompts/casestudies/{id}`. These are invalid in Firestore because Firestore requires paths to alternate collection/document segments. `/prompts/d4-assignments/{id}` has 3 segments, which is a valid document path only if `d4-assignments` is a subcollection inside the document `prompts` — but `prompts` is being used as a collection, not a document. You cannot nest a collection inside another collection.

**Fix:** Restructured to flat top-level collections:

| Old path | New path |
|---|---|
| `doc(db, 'prompts', 'd4-base')` | `doc(db, 'config', 'd4-base')` |
| `collection(db, 'prompts', 'd4-assignments')` | `collection(db, 'd4-assignments')` |
| `doc(db, 'prompts', 'd4-assignments', id)` | `doc(db, 'd4-assignments', id)` |
| `collection(db, 'prompts', 'd4-assignments', id, 'docs')` | `collection(db, 'd4-assignments', id, 'docs')` |
| `collection(db, 'prompts', 'casestudies')` | `collection(db, 'casestudies')` |
| `doc(db, 'prompts', 'casestudies', id)` | `doc(db, 'casestudies', id)` |
| `docPath="prompts/d4-base"` (prop) | `docPath="config/d4-base"` |

**Landing.jsx:** Also simplified the multi-fallback loading strategy (which tried several broken paths in sequence) to a single `Promise.all` against the correct flat paths.

**Design.md addition** (replace Firestore path references in `## DATA MODEL`):

> **Firestore collections:**
> - `/config/d4-base` — single document holding the D4 base system prompt (`content`, `version`, `updatedAt`, `updatedBy`)
> - `/d4-assignments/{id}` — one document per assignment (metadata + prompt content); subcollection `/d4-assignments/{id}/docs/{docId}` holds supporting documents
> - `/casestudies/{id}` — one document per case study (metadata + prompt + concepts + primarySources + quickPrompts)
> - `/students/{email}/casestudies/{id}` and `/students/{email}/assignments/{id}` — per-student progress (unchanged)
>
> All paths use flat top-level collections. Firestore path segments must alternate collection/document. Never use a collection name as a document ID to create pseudo-nesting.

---

## 2026-04-10 — Change: Remove mentor name, mentor role, prereqs, and estimated minutes from New Assignment form

**File:** `src/pages/InstructorDashboard.jsx` (`NewAssignmentForm`)

**Change:** Removed four fields from the "New Assignment" creation form:
- Mentor Name
- Mentor Role
- Prereqs
- Estimated Minutes

These fields are not needed at creation time: mentor name and role are defined inside the system prompt itself, and prereqs/estimated minutes are metadata the instructor can add later via the AssignmentEditor if desired. Removing them keeps the creation form focused on the essentials: ID, title, subtitle, description, display order, active flag, and system prompt.

The corresponding state initializers and Firestore write fields were also removed so these values are no longer written to new assignment documents.

**Design.md addition** (under `## INSTRUCTOR DASHBOARD → D4 Assignments → New Assignment`):

> The New Assignment form collects only: ID (permanent slug), title, subtitle, description, display order, active flag, and system prompt content. Mentor name/role are defined in the prompt text. Prereqs and estimated minutes are omitted from creation and can be added later in the assignment editor if needed.

---

## 2026-04-10 — Change: Remove subtitle, tutor name, tutor role, prereqs, and estimated minutes from New Case Study form

**File:** `src/pages/InstructorDashboard.jsx` (`NewCaseStudyForm`)

**Change:** Removed five fields from the "New Case Study" creation form:
- Subtitle
- Tutor Name
- Tutor Role
- Prereqs
- Estimated Minutes

These are defined in the system prompt or can be added later via the CaseStudyEditor. The creation form now collects only: ID, title, display order, active flag, and system prompt content.

The corresponding state initializers and Firestore write fields were also removed.

**Design.md addition** (under `## INSTRUCTOR DASHBOARD → Case Studies → New Case Study`):

> The New Case Study form collects only: ID (permanent slug), title, display order, active flag, and system prompt content. Subtitle, tutor name/role, prereqs, and estimated minutes are omitted from creation and can be filled in via the case study editor after creation.

---

## 2026-04-10 — Change: Simplify Assignment Metadata & Prompt editor; remove display order from assignment creation

**File:** `src/pages/InstructorDashboard.jsx` (`AssignmentEditor`, `NewAssignmentForm`)

**Changes:**

**`AssignmentEditor` (Assignment Metadata & Prompt section):**
Removed five fields that are either defined in the prompt itself or not relevant to edit post-creation:
- Subtitle
- Mentor Name
- Mentor Role
- Prereqs
- Estimated Minutes
- Display Order

The `handleSave` write was also tightened to explicitly list only the fields that remain (`title`, `description`, `content`, `active`) rather than spreading the full form object, which prevented stale removed fields from being re-written to Firestore.

**`NewAssignmentForm`:**
Removed Display Order field and its state initializer. The main assignment prompt is always displayed first and has no meaningful position relative to other assignments on the landing page that would need to be set at creation time.

**Rationale for display order:**
The main assignment prompt always appears first in a session — it is the primary content, not a peer of the supporting documents. Display order only applies to supporting documents (which tab they appear in and in what sequence in the right panel). Supporting documents retain their `order` field and it can be set in `DocEditor`.

**Design.md addition** (under `## INSTRUCTOR DASHBOARD → D4 Assignments`):

> The assignment editor exposes only: ID (read-only), title, description, active flag, and system prompt. Mentor name/role, subtitle, prereqs, and estimated minutes are defined inside the prompt text. Display order does not apply to the main assignment — only supporting documents have an `order` field that controls their tab sequence.

---

## 2026-04-17 — Fix: Active D4 assignments not appearing in Student View

**Files modified:** `src/pages/Landing.jsx`, `src/pages/InstructorDashboard.jsx` (`NewAssignmentForm`)

**Problem:** Assignments created via the instructor dashboard were marked `active: true` but were invisible on the landing page. The `Landing.jsx` query for `d4-assignments` used `orderBy('order', 'asc')`, but the `NewAssignmentForm` never wrote an `order` field to new assignment documents. Firestore silently excludes documents that are missing the field referenced in `orderBy`, so all assignments were filtered out of the query results.

**Fix (Landing.jsx):** Removed `orderBy('order', 'asc')` from the `d4-assignments` query. Assignments have no meaningful display order at this time, so no ordering is applied. Existing and future assignments now appear regardless of whether they have an `order` field.

**Fix (NewAssignmentForm):** Added `order: 0` to the Firestore write in `handleSave` so newly created assignments have the field present, making them forward-compatible if ordering is re-introduced later.

**Design.md addition** (under `## DATA MODEL → d4-assignments`):

> Do not use `orderBy('order', 'asc')` when querying `d4-assignments` unless every document in the collection is guaranteed to have an `order` field. Firestore silently excludes documents missing an `orderBy` field. Assignment documents written by `NewAssignmentForm` include `order: 0` as a default.

---

## 2026-04-17 — Fix: `/api/chat` returns 404 in local development

**Files modified:** `package.json` (no net change — reverted after confirming the right approach)

**Problem:** Clicking "New Session" on a D4 assignment failed with "Failed to start session." The root cause was a 404 on `POST /api/chat`. Running `npm run dev` starts Vite only — Vite has no knowledge of the `api/` directory, so Vercel Edge Functions in that directory are never served locally.

**Fix:** The `npm run dev` script remains `vite` (required to avoid a recursive-invocation error where Vercel's dev server calls the `dev` npm script, which would call `vercel dev` again). Instead, run `vercel dev` directly from the terminal for local development. `vercel dev` detects the Vite framework, starts it internally, and also serves the `api/` functions on the same port.

**Design.md addition** (under `## LOCAL DEVELOPMENT`):

> Use `vercel dev` (not `npm run dev`) for local development. `npm run dev` runs Vite only and does not serve the `api/` Vercel Functions. `vercel dev` starts Vite internally and also mounts the `api/` directory, so `/api/chat` is reachable at `localhost:3000/api/chat`. Do not set the `dev` npm script to `vercel dev` — this causes a recursive invocation error because Vercel's dev server invokes the `dev` script internally.

---

## 2026-04-17 — Feature: D4 Assignments above Case Studies; New Session / Continue buttons

**File:** `src/pages/Landing.jsx`, `src/styles/landing.css`

**Changes:**

**Section order:** The D4 Assignments section now renders above the Case Studies section on the landing page.

**Assignment card buttons:** When a student has existing sessions for an assignment, the card footer shows two buttons instead of one:
- **New Session** — navigates to `/assignment/{id}` with React Router state `{ autoNew: true }`, which triggers automatic session creation on arrival.
- **Continue** — navigates to `/assignment/{id}` normally, landing on the session list.

When no sessions exist, a single **Begin** button navigates to `/assignment/{id}`.

**CSS:** `.card-footer` changed to `display: flex; gap: 8px`. `.card-btn` changed from `width: 100%` to `flex: 1` so a single button still fills the full width while two buttons share the row equally.

**Design.md addition** (under `## STUDENT LANDING → D4 Assignments`):

> Assignment cards show "Begin" when no sessions exist. When sessions exist, two buttons appear: "New Session" (navigates with `{ state: { autoNew: true } }`) and "Continue" (navigates to session list). D4 Assignments section renders above Case Studies.

---

## 2026-04-17 — Feature: Auto-start new session from landing page

**File:** `src/pages/Assignment.jsx`

**Change:** When `Assignment` is navigated to with React Router state `{ autoNew: true }` (set by the "New Session" button on the landing page), it automatically calls `handleNewSession()` once the assignment data and sessions have finished loading. A `useRef` flag (`autoNewTriggered`) prevents double-firing if the loading state changes multiple times.

**Design.md addition** (under `## D4 ASSIGNMENT PAGE`):

> If the page receives `location.state.autoNew === true` on mount, it waits for `assignLoading` and `sessionsLoading` to both be false, then calls `handleNewSession()` automatically. The ref guard `autoNewTriggered` ensures this fires at most once per navigation.

---

## 2026-04-17 — Fix: Assignment progress not detected on landing page

**Files modified:** `src/pages/Landing.jsx`, `src/hooks/useSession.js`

**Problem:** The landing page checked for assignment progress by querying `students/{email}/assignments`, expecting documents there. But sessions are stored at `students/{email}/assignments/{assignId}/sessions/{sessionId}` — only the subcollection is written. Firestore subcollections do not auto-create their parent document, so `getDocs(collection(db, 'students', email, 'assignments'))` always returned empty results, and `hasAssignProgress` always returned `false`. The "Begin" button was shown even for assignments with existing sessions.

**Fix (Landing.jsx):** Instead of querying the `assignments` collection for parent documents, `loadContent` now queries each assignment's `sessions` subcollection directly with `Promise.all`. Any assignment with at least one session document is marked as having progress. This correctly detects sessions whether or not a parent document exists.

**Fix (useSession.js):** `startNewSession` now also writes a stub document at `students/{email}/assignments/{assignmentId}` (with `assignmentId` and `lastSessionAt`) using `setDoc` with `merge: true`. This ensures the parent document exists going forward, and is belt-and-suspenders alongside the direct subcollection check.

**Design.md addition** (under `## DATA MODEL → student progress`):

> Do not check for assignment progress by querying the `students/{email}/assignments` collection directly — the parent document may not exist even when sessions do, because Firestore subcollections don't create parent documents. Query `students/{email}/assignments/{assignId}/sessions` instead. As of this change, `startNewSession` also writes a stub parent document on every new session, so both approaches will work for sessions created after this fix.

---

## 2026-04-17 — Feature: Description tab in D4 assignment right panel

**File:** `src/pages/Assignment.jsx`

**Change:** The right panel in the assignment chat view now has three tab types in this order:

1. **Description** (new) — shows `assignment.title` and `assignment.description`
2. **Supporting docs** — one tab per supporting document (unchanged)
3. **Design Doc** — moved from first to last position

The default active tab on session open and session start changed from `'design'` to `'description'`. All three `setActiveTab('design')` call sites (initial state, `handleSelectSession`, `handleNewSession`) were updated to `setActiveTab('description')`.

**Design.md addition** (under `## D4 ASSIGNMENT PAGE → Right panel`):

> Right panel tab order: Description → supporting docs (one tab each) → Design Doc. Default tab is always Description. The Description tab renders `assignment.title` as a heading and `assignment.description` as body text.

---

## 2026-04-17 — Fix: Design Doc tab broken; rename supporting doc fallback label to "Other Docs"

**File:** `src/pages/Assignment.jsx`

**Problems:**
1. A mass `replace_all` that changed all `setActiveTab('design')` → `setActiveTab('description')` also accidentally replaced the `onClick` handler of the Design Doc tab button itself, making the Design Doc tab unclickable.
2. The supporting document tab fallback label was `'Doc'`, which is generic and confusing when there are multiple supporting documents.

**Fix:** Explicitly restored `onClick={() => setActiveTab('design')}` on the Design Doc tab button. Changed the supporting doc fallback label from `'Doc'` to `'Other Docs'`.

When there is no design doc yet, the Design Doc tab renders a placeholder message ("No design document yet.") via the `DesignDocPanel` component.

**Design.md addition** (under `## D4 ASSIGNMENT PAGE → Right panel`):

> The Design Doc tab button must set `activeTab` to the string `'design'`. Supporting document tabs use the document's `title` field; if absent, the label falls back to `'Other Docs'`.

---

## 2026-04-17 — Fix: Student messages not visible in chat window

**Files modified:** `src/hooks/useSession.js`

**Problem:** The `appendMessage` function in `useSession` built the updated message list as `[...messages, message]`, where `messages` was captured in the function's closure at the time the hook rendered. When the opening assistant message and a user message were both appended in quick succession before a re-render, the second append read the stale `messages` closure (still empty) and overwrote the first message. Only the server's replies were visible because each one started from a clean stale snapshot.

**Fix:** Added a `messagesRef = useRef([])` that stays in sync with `messages` state via a `setMessagesSync` helper:

```javascript
const setMessagesSync = (msgs) => {
  messagesRef.current = msgs;
  setMessages(msgs);
};
```

`appendMessage` now reads from `messagesRef.current` instead of the closed-over `messages` state, so it always appends to the true current list regardless of render timing.

**Design.md addition** (under `## D4 ASSIGNMENT PAGE → Session hooks`):

> `useSession` maintains a `messagesRef` in sync with `messages` state. All functions that append or replace messages must use `setMessagesSync` (which updates both the ref and the state) and must read from `messagesRef.current` — never from the `messages` state variable directly. This prevents stale-closure bugs when multiple async appends fire before a re-render.

---

## 2026-04-17 — Fix: Opening assistant message not triggered automatically on new session

**File:** `src/pages/Assignment.jsx`

**Problem:** After `startNewSession` completed, the code immediately called `callChatAPI([openingMsg], effectivePrompt)`, but `effectivePrompt` was still the stale value from the previous render — the newly assembled effective prompt hadn't propagated to state yet. This caused the API call to use an empty or wrong prompt, and any failure there was caught by the same `try-catch` as session creation, surfacing a misleading "Failed to start session" error even though the session was actually created.

**Fix:** Split `handleNewSession` into two separate try-catch blocks:
1. **First block:** session creation via `startNewSession` — failure here shows "Failed to start session" and returns early.
2. **Second block:** opening message via `callChatAPI([openingMsg], effectivePrompt)` — failure here is logged to console only and does not surface an error to the student (the session is already open; the student can simply type).

`startNewSession` was also updated to return the assembled `effective` prompt, so the opening message call uses the fresh value rather than the stale state.

**Design.md addition** (under `## D4 ASSIGNMENT PAGE → New session flow`):

> Session creation and the opening-message API call are in separate try-catch blocks. A failure in the opening message does not surface an error — the session is already open and the student can begin typing. `startNewSession` returns the effective prompt so the opening call does not depend on state propagation timing.

---

## 2026-04-17 — Fix: Propagate HTTP status from Anthropic API through `/api/chat`

**File:** `api/chat.js`

**Problem:** The edge function always returned `status: 200` regardless of whether the Anthropic API call succeeded. When the API returned a 4xx or 5xx error, the response body contained an error object but the HTTP status was 200, so `callChatAPI` in the frontend did not throw and silently returned an empty string from `data.content?.[0]?.text`.

**Fix:** Changed the `Response` constructor to pass `status: response.status`, so Anthropic HTTP errors are propagated to the frontend. `callChatAPI` throws on non-OK responses (`if (!res.ok) throw new Error(...)`), which surfaces the error correctly.

**Design.md addition** (under `## API → /api/chat`):

> The edge function must forward `status: response.status` from the Anthropic response. Always returning 200 masks API errors and causes silent empty-reply bugs.

---

## 2026-04-17 — Change: Remove "+ New Session" button from assignment chat sidebar

**File:** `src/pages/Assignment.jsx`

**Change:** Removed the "+ New Session" button that appeared in the left sidebar while a session was open. Starting a new session is available from the "All Sessions" list view (which has a "New Session" button), and from the landing page (the "New Session" card button). Having it in the sidebar while a chat is in progress was redundant and potentially disruptive (a student could accidentally start a new session mid-conversation).

The sidebar now contains only the assignment title, session number/date, and the "← All Sessions" back link.

**Design.md addition** (under `## D4 ASSIGNMENT PAGE → Sidebar`):

> The sidebar in chat view shows assignment title, session number, session start date, and a back link to the session list. It does not contain a "New Session" button — new sessions are started from the session list or the landing page.

---

## 2026-04-17 — Change: Flatten instructor left nav (Students, D4 Base, D4 Assignments, Case Studies)

**File:** `src/pages/InstructorDashboard.jsx`

**Before:** The left nav had two items: **Students** and **System Prompts**. Clicking "System Prompts" expanded sub-tabs for D4 Base, D4 Assignments, and Case Studies inside the main content area.

**After:** The left nav has four direct items: **Students**, **D4 Base**, **D4 Assignments**, **Case Studies**. Each dispatches to the corresponding content view immediately, with no intermediate sub-tab layer.

**Implementation:**
- `navTab` values changed from `'students' | 'prompts'` to `'students' | 'd4base' | 'd4assignments' | 'casestudies'`
- `SystemPromptsView` signature changed from `({ userEmail })` to `({ userEmail, activeTab })` — it no longer manages its own `subTab` state
- Internal sub-nav tabs and "System Prompts" heading removed from `SystemPromptsView`; `subTab ===` checks replaced with `activeTab ===` throughout
- Main dashboard renders `<SystemPromptsView userEmail={...} activeTab={navTab} />` when `navTab` is any of the three content tabs
- `guardedNavigate` still wraps all nav clicks to protect unsaved editor changes

**Design.md addition** (under `## INSTRUCTOR DASHBOARD → Navigation`):

> The instructor left nav has four items: Students (default), D4 Base, D4 Assignments, Case Studies. There is no "System Prompts" grouping. `SystemPromptsView` receives the active tab as a prop rather than managing its own sub-tab state. All nav clicks are wrapped in `guardedNavigate` to protect unsaved changes.

---

## 2026-04-18 — Fix: Chat input does not auto-focus after server response

**File:** `src/components/ChatInput.jsx`

**Problem:** After the server responded, the student had to click the message textarea to regain focus before typing. This was required after every single server reply, making the chat feel sluggish.

**Fix:** Added a `useEffect` that watches the `disabled` prop. When `disabled` transitions from `true` to `false` (i.e. `isThinking` clears after a server response), the textarea is immediately focused:

```javascript
useEffect(() => {
  if (!disabled) {
    textareaRef.current?.focus();
  }
}, [disabled]);
```

This fires after the opening assistant message, after every subsequent reply, and after any other operation that temporarily disables the input.

**Design.md addition** (under `## D4 ASSIGNMENT PAGE → Chat input`):

> `ChatInput` auto-focuses the textarea whenever `disabled` transitions to `false`. No manual click is needed to resume typing after a server response.
