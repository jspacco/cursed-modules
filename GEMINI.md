# CLAUDE.md — Standing Instructions

## On every session start
1. Read design/design.md in full before writing any code.
2. Read design/changes.md in full before writing any code.
3. If these files conflict, changes.md takes precedence — it reflects the current state.

## After each completed task
A task is one thing you were asked to do — one feature, one fix, one refactor. When the task is working:
1. Append an entry to design/changes.md using this format:
   ## YYYY-MM-DD — [Short description]
   **Files modified:** list them
   **Problem:** what was wrong or what was needed
   **Fix/Change:** what you did and why
   **design.md note:** one sentence on what the canonical spec should say when merged

2. Commit with a message matching the changes.md heading.
   Example: `git add -A && git commit -m "Fix: stale closure in useSession appendMessage"`

3. Only commit when the changed feature is in a working state.

## Hard rules
- Never put API keys or secrets in any documentation file.
- All instructor dashboard saves use setDoc({ merge: true }). Never updateDoc().
- There is no config.js. All content comes from Firestore.
- Do not append to changes.md without also committing.
- Do not commit without also appending to changes.md.