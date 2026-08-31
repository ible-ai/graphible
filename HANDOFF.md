# Handoff

Last verified: 2026-08-31, on `main` at `f6ebfb5`, pushed and deployed.

## State

`main` is clean and in sync with `origin/main`. Lint 0 errors (2 pre-existing
`exhaustive-deps` warnings in `SetupWizard`), **261 unit**, **68 e2e**, build
clean. CI and Pages both green; `graph.ible.ai` serves the current bundle.

## What just landed

**A back button.** The header's home button returns to the start screen; the
start screen offers "Back to graph" (and Escape) whenever a graph exists. It is
non-destructive — nodes stay in state — which is only safe because
`handleInitialPromptSubmit` calls `resetGraph` before generating, so a kept
graph can be returned to but never appended to. Both halves are asserted in
`e2e/back-to-start.spec.js`. `CenteredPrompt`'s global keydown listener is now
gated on `showPromptCenter`; it had been live over the graph, rewriting the
hidden start prompt on every keystroke.

**The model panel, trimmed.** The External tab's banner is gone and its
single-option Provider select is commented out rather than deleted. Browser-tab
models show name, size and performance without the prose.

**`code-assist`, rebuilt against the live API.** Two Google desktop clients now
reach it (`AUTH_PROVIDERS`), model discovery reads the account's own quota, and
`onboardUser` provisions a project for accounts that lack one. Read the
"Why `code-assist` exists" and "Testing against the live API" sections of
`CLAUDE.md` before touching any of it — particularly the table of things that
were believed and turned out false.

**CI had never been green.** It was added on a branch that was never pushed, and
pinned Node 20, on which jsdom 30 kills every vitest worker before a test runs.
Both workflows now pin Node 24.

## The one thing to understand before touching the Gemini path

**The `User-Agent` decides which model surface Google serves**, and a browser
cannot set it — it is a forbidden header name, so every request carries the
browser's own string.

- Browser UA → the Code Assist project and its models. This is what ships and
  it works: 3.1 Flash Lite, 3 Flash, 3.1 Pro, 2.5 Pro.
- Antigravity's own UA → the `aicode-consumers` project, a much larger catalog
  (Gemini 3.5/3.6/3.7, Claude, gpt-oss) on a separate quota.

So Antigravity's models are reachable only from a browser that already
identifies as Antigravity — its own embedded browser does. `canReachAntigravity()`
tests for that, and `ModelSelector` omits the client entirely where it fails.

## Open decisions, carried forward

- `.env/code-assist-refresh` and `.env/antigravity-refresh` hold live refresh
  tokens for the maintainer's Google account, used by the probe. Gitignored,
  revocable at myaccount.google.com. Delete them if this repo changes hands.
- The Code Assist free-tier quota on that account is partly spent from probing;
  the Antigravity surface is untouched. A 429 during testing may be that, not a
  bug.
- The Gemini Developer API catalog is the only model list never checked against
  a live endpoint — it needs an API key and nothing here has one.
- Both `code-assist` client ids are borrowed from Google's own desktop clients.
  If either is rotated, the path breaks with no warning here and there is no
  fallback wired up.
- GitHub push protection flags those client ids on every push that moves them.
  Each needs approving through the link in the rejection, or push protection
  turning off for the repo.
- `public/CNAME` pins `graph.ible.ai`. Still unreviewed.
- The browser-model download path is still unverified end to end; WebGPU
  reports no adapter in this environment, headless or headed.
- `App.jsx` is ~920 lines. Model and modal orchestration are the next seams.
