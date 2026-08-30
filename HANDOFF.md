# Handoff

Last verified: 2026-08-30, on `main`.

## State

`main` is clean. Lint 0 errors (2 pre-existing `exhaustive-deps` warnings in
`SetupWizard`), **234 unit**, **65 e2e**, build clean. **Not pushed** —
`origin/main` is behind and nothing here has ever been pushed.

## What just landed

**Back button.** A home button in the header returns to the start screen; the
start screen grows a "Back to graph" button (and Escape) whenever a graph
exists. It is non-destructive — nodes stay in state — which is only safe
because `handleInitialPromptSubmit` already calls `resetGraph`, so kept nodes
cannot leak into the next graph. Both halves are asserted in
`e2e/back-to-start.spec.js`.

Fixed alongside it: `CenteredPrompt`'s global keydown listener was live while
the graph was on screen (the hook runs before the component's early return), so
typing on the canvas rewrote the hidden start prompt. It is now gated on
`showPromptCenter`. The same known issue still stands for `NewPromptBox` and
`useKeyboardNavigation`.

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
