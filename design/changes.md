# Design Changes Log — v2

Changes made after the v2 rebuild that are not yet reflected in `design.md`.

## 2026-04-20 — Add markdown rendering to assistant chat messages
**Files modified:** src/components/MessageBubble.jsx, package.json
**Problem:** Assistant messages containing markdown (e.g. `**Technical Specs**`) were displayed as raw text — asterisks and all — instead of rendered formatting.
**Fix/Change:** Installed `react-markdown` and rendered assistant-role messages through `ReactMarkdown` with inline styles matching the app's design tokens. User messages remain plain `pre-wrap` text.
**design.md note:** MessageBubble renders assistant messages as markdown; user messages remain plain text.