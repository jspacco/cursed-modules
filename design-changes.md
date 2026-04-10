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
