# Handoff

Last verified: 2026-08-30, on `main` at the merge `afab95f`.

## State

`main` is clean. Lint 0 errors (2 pre-existing `exhaustive-deps` warnings in
`SetupWizard`), **234 unit**, **60 e2e**, build clean. **Not pushed** —
`origin/main` is behind and nothing here has ever been pushed.

## Next task: a "back" button to the landing screen

The landing screen is `CenteredPrompt`, gated entirely on **`showPromptCenter`**
(`App.jsx:66`). It starts `true` and is set `false` once a graph exists.
`CenteredPrompt` early-returns `null` when it is false, and the whole header
block is `{!showPromptCenter && (...)}` at `App.jsx:511`. So "go back" is
`setShowPromptCenter(true)` — the open question is what happens to the graph.

Worth deciding before writing code:

- **Keep the graph or clear it?** Setting the flag alone leaves nodes in state,
  so returning and prompting again appends to the existing graph rather than
  starting fresh. If the button is meant to read as "new graph", it needs
  `resetGraph` from `useGraphState` too; if it is meant as "go look at the start
  screen", it must not.
- **Where does it live?** The header hides itself on the landing screen, so a
  header button disappears exactly when you would want to leave it — that is
  fine for a one-way "back", but means the button cannot toggle.
- Anything floating goes on the `Z` scale in `src/constants/zLayers.js`. Note a
  z-index only competes inside its own stacking context; the header is one, and
  that is what trapped the model menu under the details panel (`8ae8616`).
- A `<button>` is already in `isInteractiveTarget` in `useCanvasInteraction`, so
  it will not pan the camera. A non-button element would.
- `useKeyboardNavigation` is suppressed while `showPromptCenter` is true, so
  returning to the landing screen also disables WASD. That is probably wanted.

## What just landed

`code-assist`: sign in with Google, generate on the user's own Gemini
allowance. No API key, no Cloud project. Verified end to end against a live
account. The architecture, the three flow gotchas and the two model
vocabularies are documented in `CLAUDE.md` under "Why `code-assist` exists" —
read that before touching the auth path.

## Open decisions, carried forward

- **Push or not.** `main` has never been pushed. History on this branch was
  rewritten earlier to strip a 59MB screencap, but since nothing was ever
  pushed there is no divergence and a normal `git push` works.
- `public/CNAME` pins `graph.ible.ai`. Still unreviewed.
- The `code-assist` client id belongs to gemini-cli. If Google rotates it or
  withdraws the flow — already withdrawn for AI Pro/Ultra tiers — this breaks
  with no warning here, and there is no fallback wired up yet.
- `loadCodeAssist` returning no `cloudaicompanionProject` may need an
  `onboardUser` call. Not implemented; the live account did not need it.
- The browser-model download path is still unverified end to end. Note WebGPU
  reports **no adapter at all** in this environment (headless *and* headed), so
  it cannot be exercised here — it needs a real machine with a working adapter.
- `App.jsx` is ~960 lines. Model and modal orchestration are the next seams.
