# Handoff

Session of 2026-08-28/29. Everything below is on branch
**`fix/dead-code-and-wiring`** — 49 commits, unmerged, not pushed.

`CLAUDE.md` is the durable architecture reference and is up to date. This file
is the session-specific part: what changed, what needs your decision, and what
is still unverified.

## State

```
branch      fix/dead-code-and-wiring   (49 commits ahead of main, local only)
tests       192 unit (vitest) + 56 e2e (playwright), all passing
lint        0 errors, 2 warnings (pre-existing, in SetupWizard)
build       clean
```

```bash
npm run test      # unit
npm run test:e2e  # browser, against a production build
npm run test:all  # both
npm run lint
```

**Running the app.** `npm run dev` still needs mkcert certificates in the
gitignored `.env/`. Until those exist, use:

```bash
npx vite --config vite.config.e2e.js --port 5173 --host
```

That config exists because the main one requires TLS; it drops the server
blocks and serves over plain HTTP. A dev server was left running on port 5173
during this session — it is not managed by anything, so kill it when done.

## Decisions waiting on you

1. **`public/CNAME` pins `graph.ible.ai`.** Added so `npm run deploy` (which
   replaces the gh-pages branch wholesale) cannot drop the custom domain.
   **Delete it if the domain is managed only through repository settings.**
2. **The branch name is now wrong.** It began as dead-code cleanup and became
   bug fixes, a test suite, favicons, model updates and two features. Rename
   before opening a PR, or merge as-is.
3. **The LLM-authored-CSS feature was removed.** `FeedbackModal` asked a model
   to return JSON that became `customCSS` injected into a `<style>` tag. I had
   wired its entry point back up earlier in the session and then judged that
   wrong. Feedback itself still works. Say the word if you want it back.
4. **Graph mode vs. small browser models.** Selecting a browser backend now
   switches you to single-response mode, because a 270M model will not reliably
   emit the JSON node format and would otherwise silently fall back to one node.
   If you would rather it attempt graph mode and degrade, that is one constant:
   `RESPONSE_MODE_BY_BACKEND` in `graphConstants.jsx`.

## What changed

**Bugs fixed** (each has a test; `git log` has the reasoning)

- Node ids came from `nodes.length + n`, so deleting then generating reissued
  live ids. Now a monotonic counter. This was the root of the whole class.
- Five sites resolved nodes by array index, so after any delete edges were
  dropped or drawn between the wrong pair, and focus, keyboard navigation and
  the context sent to the model all read the wrong node.
- The setup wizard refused every non-demo option — it read state in the same
  event that set it, so no real model could be configured at all.
- The model dropdown was 816px tall in a 720px viewport with `overflow: hidden`,
  so "Apply Settings" was unreachable and no model could be applied.
- Download consent was one global flag, so a grant for an old model counted for
  a new one and a stale denial could never be revisited. Now per-model, and
  skipped entirely when the weights are already cached.
- `cleanJsonString` appended a second `}` to every valid object, so the
  streaming parser could never parse anything and the end-of-stream flush
  silently dropped whatever was still buffered.
- A completed stream that parsed to nothing produced zero nodes — thousands of
  tokens discarded, empty canvas.
- Node hover controls never fired: focusing a node re-centred the camera and
  slid the button out from under the pointer.
- The root node could never be deleted (`n.id &&` — id 0 is falsy).
- Demo and saved graphs loaded without their edges.
- Background panning was registered twice, doubling every drag.
- Gemini generation settings were sent as `generationConfig`, which
  `@google/genai` ignores — temperature and token limits never reached the API.
- The startup effect looped forever once it actually ran.
- Closing the details panel did not stick; it reset size and position on every
  streamed chunk.

**Added**

- Vitest + Playwright + a CI workflow. There were no tests; `test-build` was
  build+preview and `local_test.sh` deleted the lockfile then ran `git add .`.
- Single-response mode: the whole reply in one node, streaming in live.
- Thread view, sibling alternatives, and branch-from-a-quoted-passage.
- Graphs in `localStorage` (were `sessionStorage`, lost on restart) with
  export/import as versioned JSON.
- A real favicon set. Search results showed none because `/favicon.ico` 404'd,
  the only icon was 32px (Google ignores under 48), two `rel="icon"` entries
  competed, and `brain-icon.svg` began with a stray backtick.
- `zLayers.js`, `panelLayout.js`, `threadUtils.js`, `modelConsent.js`,
  `useCanvasInteraction.js`, `composePrompt` in `contextUtils`.
- In-app failure notices; `alert()` and `confirm()` are gone from these paths.

**Removed**: the adaptive-UI feature, `App.css`, `ConnectionComponent.jsx`,
`local_test.sh`, the unfinished LLM cluster-labeller, and a pile of unused
props and exports.

**Models updated**: Gemini 2.5 → 3.5/3.6/3.7; browser models to
gemma-3-270m (273 MB, default), Qwen3-0.6B, gemma-3-1b. Sizes are now the real
download at the configured dtype, measured from the HF file listings — the old
figures were parameter counts, and the default was pulling 1.2 GB while
advertising 0.6 GB. `transformers.js` 3.7.3 → 4.2.0, `web-llm` → 0.2.84.

## Unverified

- **The browser-model round trip.** Consent, capability detection, provider
  dispatch and the stream envelope are all tested. Nothing exercises an actual
  model download and generation, which pulls hundreds of megabytes. If
  gemma-3-270m fails to load or produces unusable output, that is the gap — the
  failure reason now surfaces in the notice rather than being swallowed.
- **The transformers.js v4 upgrade** rests on that same gap. Note that
  Node-side smoke tests of transformers.js fail from inside this project's
  `node_modules` because of an onnxruntime conflict; test it in an isolated
  directory or in a browser.

## Two patterns worth suspecting first

Nearly every bug this session was one of two kinds.

**State read in the same event that set it.** The wizard refused every
transition this way. The WebLLM engine was invisible to the caller that had just
created it. Consent decisions raced their own storage. React has not re-rendered
yet; pass the value explicitly or mirror it into a ref.

**Positional identity.** Ids treated as array indices. This holds until
something is deleted and then diverges permanently, and it fails silently
because both are integers.

Both are now covered by tests. When something behaves as though it is one step
behind, or points at the wrong node, look there first.

## Repo quirks

- `.gitignore` lists **itself**, so edits to it never reach another clone. A
  change I made there (excluding demo media) exists only in this working copy.
- A 59MB screencap and an 8.8MB gif were swept into a commit by an over-broad
  `git add -A` and then removed from this branch's history with
  `git filter-branch`. The files are still on disk. **Because history was
  rewritten, do not merge this branch into anything that already has those
  commits** — nothing was pushed, so this should not arise.
- `src/dev/` and `_src/` are gitignored scratch; `src/dev/App.jsx` is a stale
  fork. Both are excluded from lint.

## Suggested next steps

1. Try the browser model end to end — the one thing tests cannot reach.
2. Extract model and modal orchestration from `App.jsx`, still ~890 lines. The
   pointer layer is already out and has its own tests.
3. Build on single mode: it is the stronger product, and thread view,
   alternatives and quote-branching are the foundations for it.
