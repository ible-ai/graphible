# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Graphible turns a prompt into an interactive, node-based "learning graph": an LLM streams JSON nodes, each one is placed in an infinite pan/zoom canvas as it arrives, and you keep exploring by selecting nodes and prompting again. Live demo: <https://ible-ai.github.io/graphible>.

## Commands

```bash
npm run dev        # Vite dev server on https://localhost:3000 (host: true)
npm run build      # Production build -> dist/ (sourcemaps on)
npm run preview    # Serve the production build
npm run lint       # ESLint (flat config)
npm run test       # Vitest unit suite (jsdom)
npm run test:watch # Vitest in watch mode
npm run test:e2e   # Playwright against a production build in headless Chromium
npm run test:all   # unit then e2e
npm run deploy     # build + gh-pages -d dist
```

No TypeScript — `.js`/`.jsx` only. **Node >= 22.22.2** — jsdom 30 accepts only
`^22.22.2 || ^24.15.0 || >=26`, and on Node 20 every vitest worker dies at
startup (`webidl.util.markAsUncloneable is not a function`) before a test runs.
Both workflows pin Node 24.

**Testing.** `test/` holds 261 Vitest unit tests: the streaming JSON parser, context
building, coordinates, clustering, the generation pipeline in `useGraphState`
(driven with a fake backend emitting the real envelope), the selection and
manipulation hooks, `BrowserLLMEngine`'s provider dispatch, and the shared
backend envelope via the demo model. `e2e/` holds 68 Playwright tests that drive a real build in
headless Chromium through the demo backend, which needs no Ollama, API key or
WebGPU — so the graph, camera, node controls and wizard are all exercisable
offline. Chromium launches with WebGPU enabled, and the browser-model capability
test skips itself where no adapter exists. `vite.config.e2e.js` exists because the main config
requires TLS certificates from the gitignored `.env/`; it drops the
server/preview/dev blocks so the suite can serve over plain HTTP (`mergeConfig`
keeps a base value when an override is `undefined`, so they must be omitted
rather than overridden). Interaction bugs here live in the wiring between
listeners and camera state, which unit tests do not reach — three such bugs were
found by the first e2e run alone. Prefer adding an e2e case for anything
involving the pointer, the camera, or node controls.

**`npm run dev` requires local TLS certs** at `.env/localhost+2-key.pem` and `.env/localhost+2.pem`. `.env/` is gitignored, so a fresh clone cannot start the dev server until you generate them (`mkcert localhost 127.0.0.1 ::1`). Vite declares HTTPS in three places (`server`, `preview`, and a non-standard `dev` block). HTTPS matters because WebGPU/WebLLM and the local Ollama fetches expect a secure context.

`npm run lint` is clean of errors; 4 `react-hooks/exhaustive-deps` warnings remain (two in `FeedbackModal`, two in `SetupWizard`). `globalIgnores` covers `dist`, `src/dev` and `_src`. The one rule override is `no-unused-vars` with `varsIgnorePattern: '^[A-Z_]'`.

To run against a real local model: install [Ollama](https://ollama.ai), start it with CORS open (`OLLAMA_ORIGINS=* ollama serve`), and pull a model (`ollama pull gemma3:4b`, 3.3GB). `gemma3:270m` (292MB) is the lightweight path; `gemma4:e4b` is the current generation but over 7GB, which is why the default stays on gemma3. Without any of that the app still runs — it defaults to demo mode.

**Model catalogs live in `LLM_CONFIG` only.** Google models are defined once in `LLM_CONFIG.EXTERNAL.GOOGLE.MODELS` and reach the UI through `GOOGLE_MODEL_LIST`; the WebLLM download copy comes from `DEFAULT_WEBLLM_MODEL_INFO`. Both exist because these lists were previously duplicated across `ModelSelector`, `InstallationGuide` and the wizard constants, and drifted. Add or change a model in one place.

Browser-LLM dependencies are `@huggingface/transformers` v4 (rewritten WebGPU runtime) and `@mlc-ai/web-llm`. Note Node-side smoke tests of transformers.js from inside this project's `node_modules` fail on an onnxruntime conflict; test it in an isolated directory instead, or in the browser, where Vite bundles onnxruntime-web.

Push to `main` → `.github/workflows/deploy.yml` builds and deploys to GitHub Pages. `base: './'` makes the bundle work from the Pages subpath. `vite-plugin-node-polyfills` (util/buffer/process/global) is needed by the LLM SDKs; `crypto` is marked external in the rollup config. `.github/workflows/local_test.sh` is not a workflow — it's a three-line scratch script (clean install, build, `git add .`).

## Repo map

44 source files under `src/`:

```
src/App.jsx               920 lines — the whole app shell; all UI state lives here
src/main.jsx                        — React root; hides index.html's #loading div
src/index.css                       — Tailwind + KaTeX imports, hit-test classes, hand-rolled .prose
src/hooks/          (10)            — camera, graph state, LLM, selection, manipulation, feedback, save/load, keyboard, browser-LLM engine
src/utils/           (11)            — coordinates, LLM parsing, context building, clustering, wizard helpers, Google/Code Assist auth
src/constants/       (3)            — graphConstants.jsx, setupWizardConstants.jsx, zLayers.js
scripts/             (1)            — probe-code-assist.mjs, the live-API probe (see below)
src/components/     (17)            — Minimap (784) and SetupWizard (825) are the two big ones
```

Gitignored and unimported: `src/dev/` (7 files; `src/dev/App.jsx` is a stale 1117-line fork of `App.jsx`) and `_src/`. Don't edit them for app changes.

## Architecture

React 19 + Vite SPA. No router, no state library, no backend — everything runs in the browser. `src/App.jsx` (`Graphible`) owns all UI state, composes the hooks, and renders the graph canvas inline. Components are presentational and prop-driven; `App.jsx` is the only place that wires them together.

### 1. Model layer — `useLLMConnection`

Normalizes four backends behind one `generateWithLLM(prompt, stream, config)`. **Every backend returns the same shape**: a fetch-like `{ ok, status, body: ReadableStream }` whose stream emits newline-delimited `{"response": "<text chunk>"}` envelopes (non-streaming returns `{ ok, status, json() }` instead). `useGraphState.parseStreamResponse` just `JSON.parse`s each chunk and reads `.response`. **Preserve that envelope when adding a backend** — it is the contract every consumer assumes.

| `config.type` | Path |
|---|---|
| `demo` | one canned node wrapped in a synthetic `ReadableStream`; the default, so the app works with nothing configured |
| `local` | Ollama at `config.address` — `POST /api/generate`, `GET /api/tags` |
| `external` | Google Gemini via `@google/genai`; `generateContentStream`, chunks flattened across `candidates[].content.parts[].text`. Generation params go in `config` (the SDK ignores the older `generationConfig`) and come from `LLM_CONFIG.EXTERNAL.GOOGLE.DEFAULT_CONFIG` |
| `webllm` | `BrowserLLMEngine` (`useBrowserLLMEngine.js`), which dispatches per model id through `BROWSER_LLM_TO_PROVIDER` to either `@mlc-ai/web-llm` (`MLCEngine.chat.completions.create`) or `@huggingface/transformers` (`pipeline` + `TextStreamer`), re-wrapping both into the same envelope |
| `code-assist` | Gemini on the **signed-in user's own** allowance, over `cloudcode-pa.googleapis.com/v1internal` (`codeAssist.js`). The only cloud path that bills nobody who deployed the app |
| `google-oauth` | Gemini Developer API with an OAuth bearer token instead of a key, billed to a Cloud project the user names. Built, works, but needs a project id — kept as a power-user option |

### Why `code-assist` exists

Every Gemini Developer API request is attributed to a billable Cloud project, so
it can only bill whoever deployed Graphible or a project the user creates
themselves. The OAuth scope that used to shift usage to the end user,
`generative-language.peruserquota`, is gone — the API lists its accepted scopes
in a `www-authenticate` header on any 403 and that one is absent. Code Assist
attributes to the signed-in Google account instead, which is the allowance
gemini-cli spends.

Reaching it means presenting a Google desktop client's OAuth client id and
secret, both published in source; each is registered as a public client, so
PKCE rather than the secret is what protects the exchange. Google's consent
screen names the client, and the sign-in button says so too.

**The `User-Agent` selects the model vocabulary, and a browser cannot set it.**
This is the single most important fact about this backend, and it was
established with real credentials against a live account:

| client | User-Agent sent | result |
|---|---|---|
| gemini-cli | Node/undici default | `UNSUPPORTED_CLIENT`, no project, no tier |
| gemini-cli | any browser UA | free tier, project resolved, **generates** |
| antigravity | any browser UA | free tier, but every Antigravity model 404s |
| antigravity | Antigravity's Electron UA | free tier, project `aicode-consumers`, **generates** |

`User-Agent` is a forbidden header name, so `fetch` cannot set it and every
request from a page carries the browser's own string. That pins Graphible to
gemini-cli's vocabulary: `gemini-3-flash` and the other Antigravity ids return
"Requested entity was not found" from a browser regardless of host, project, or
which OAuth client minted the token. Antigravity's sign-in is kept but marked
unavailable — sound auth, unreachable models.

**Beware of probing this from Node.** Doing so once produced a confident and
completely wrong conclusion — that Google had retired the gemini-cli client for
individuals — because undici's default `User-Agent` is not a browser's, and the
API answers `UNSUPPORTED_CLIENT` to anything it does not recognise.
`scripts/probe-code-assist.mjs` therefore sends a browser UA. Reproduce the
client's real conditions or the answer describes something nobody ships.

If a request does come back ineligible, `loadCodeAssist` surfaces
`ineligibleTiers[].reasonMessage` — the only place Google explains itself.
Otherwise generation fails with "You do not have a valid license (#3501)",
which names neither cause nor remedy.

**Two clients reach this API** (`AUTH_PROVIDERS` in `codeAssistAuth.js`), and
which one you present decides which models you are served:

**The User-Agent selects the *surface*, not just the vocabulary.** With a
browser's UA the account resolves the Code Assist project (`able-module-…`) and
its models; with Antigravity's own UA the same account resolves
`aicode-consumers` and a much larger catalog on a separate, untouched quota:
Gemini 3.5/3.6/3.7, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`,
`gpt-oss-120b-medium`. Confirmed generating: `gemini-3.7-flash-tiered`,
`gemini-3.6-flash-high`, `gemini-3-flash`.

Since `User-Agent` is forbidden to `fetch`, a web page reaches that surface only
when the browser it runs in already says Antigravity — its own embedded browser
does. `canReachAntigravity()` tests for it, and `ModelSelector` **omits the
client entirely** when it is absent, rather than offering a menu on which every
choice reports "not found". A saved config naming it falls back to `gemini-cli`.

| | `gemini-cli` (default) | `antigravity` |
|---|---|---|
| redirect | `codeassist.google.com/authcode` | `antigravity.google/oauth-callback` |
| extra scopes | — | `cclog`, `experimentsandconfigs` |
| models | 3.1 Flash Lite, 3 Flash, 3.1 Pro, 2.5 Pro | 3.7/3.6/3 Flash, 3.1 Flash Lite |
| host | `cloudcode-pa` | `daily-cloudcode-pa` → prod |
| project | `able-module-…` | `aicode-consumers` |
| needs UA | no | **yes** — Antigravity's own |

**The hosts are not interchangeable.** Prod does not serve Antigravity's models
and answers a bare 404, which reads as a bad model id rather than a wrong host.
Note `daily-cloudcode-pa.googleapis.com` — *not* the `.sandbox` variant a
third-party plugin names, which resolves and answers and so 404s every model
instead of failing loudly. `postToEndpoints` falls through on 404 only, so a
401 or 403 is never masked by a retry.

Grants, verifiers, refresh tokens, projects and catalogs are all **per client** —
a code minted under one is rejected by the other with `invalid_grant`, which
reads exactly like an expired code. `migrateModelConfig` is provider-aware for
the same reason.

Which redirects a client accepts is undocumented. Establish it by asking
Google's authorize endpoint and reading which pairings answer
`redirect_uri_mismatch` — that is how `antigravity.google/oauth-callback` was
found after the loopback redirect in Antigravity's own source suggested, wrongly,
that no hosted page existed. Antigravity's page is titled "Google Antigravity
Authentication" and has a Copy to Clipboard button.

Antigravity's desktop app also sends a spoofed Electron `User-Agent` and a
`Client-Metadata` header. **A browser can send neither**, and not only because
`User-Agent` is forbidden to `fetch`: this API's CORS allowlist is exactly
`authorization,content-type`, so any third header fails the *preflight* with
403 and the real request never leaves. The browser then reports "No
`Access-Control-Allow-Origin` header", which points at the response rather than
at the header you added.

Verified end to end against a real account: **none of that identification is
required**. Generation works from the browser with the two allowed headers and
the client named only in the `loadCodeAssist` body. What the 403
"you do not have a valid license (#3501)" actually tracked was sending an
Antigravity model to the wrong host, not a missing client fingerprint.

Three things make this work from a static site, and each was a bug before it was
a feature:

- **The redirect.** `https://codeassist.google.com/authcode` is a Google-hosted
  page that displays the code. gemini-cli's other redirect is a loopback port a
  web page can neither listen on nor read across origins.
- **The popup must open inside the click.** `beginSignIn` awaits
  `crypto.subtle.digest`; opening the window after that await has lost the
  user-gesture context and browsers block it. The window is opened empty and
  navigated once the URL exists.
- **One verifier per attempt.** Minting a fresh one per click invalidates the
  code from a page the user already has open, which surfaces as `invalid_grant`
  — the same error as an expired code.

**Two model vocabularies.** Code Assist and the Developer API do not accept the
same ids: `gemini-3.5-flash-lite` exists only on the latter,
`gemini-3.1-flash-lite` only on the former. Sending the wrong one returns
"Requested entity was not found", naming neither the entity nor the field.
The authoritative list is **the account's own quota**:
`retrieveUserQuota` returns one bucket per model it may use, which
`scripts/probe-code-assist.mjs` prints. gemini-cli's `VALID_GEMINI_MODELS` is a
useful cross-check but is not what this endpoint serves — `gemini-3.5-flash`
appears there and 404s here.

**404 and 429 mean opposite things and were once confused.** 404 "Requested
entity was not found" is a bad model id; 429 "You have exhausted your capacity
on this model" is a *good* id whose quota is spent. `gemini-3.1-pro-preview` was
removed from the catalog on the strength of a failure that was really a 429, on
the theory that preview ids need undetectable account access. They do not: they
are ordinary ids and they work.

**The catalog is a fallback, not the source of truth.** `retrieveUserQuota`
(`v1internal:retrieveUserQuota`, `{project}` in, `{buckets:[{modelId,…}]}` out)
returns one bucket per model the signed-in account has an allowance for, and
`ModelSelector` builds its list from that once a grant exists. gemini-cli reads
its own preview access out of the same field. Discovery failing returns `[]`,
which `buildCodeAssistModelList` reads as "use the static catalog", so the worst
case is the behaviour that shipped before it.

gemini-cli itself never sends a picked id through — `resolveModel()` rewrites it
against per-account state — but that is a convenience for its own users, not a
requirement of the API. Graphible sends the id verbatim and that is fine, so
long as the id is one the account's quota actually names.
`CODE_ASSIST_MODELS` is separate from `LLM_CONFIG.EXTERNAL.GOOGLE.MODELS` and
the selected id is held apart in `ModelSelector` so switching cannot carry a
name across. `migrateModelConfig` rewrites a saved id against its own backend's
catalog for the same reason — a Code Assist id migrated against the Developer
API catalog is exactly how one crosses over.

Connection state is a tri-state string: `'pending' | 'connected' | 'disconnected'`. `testLLMConnection` throttles itself — after `maxFailures` (3) it refuses to retry within a `cooldownPeriod` (5s).

WebLLM consent flow, in order: `testWebLLMConnection` first checks `navigator.gpu` and requests an adapter (**no consent needed for the capability check**); returns early if an engine for that same `modelId` already exists; otherwise calls `requestWebLLMConsent` (a `window.confirm`, though the code notes it should be a modal), which no-ops once `consentRequested` is set — that flag is seeded from `graphible-webllm-consent` on mount, so a prior "denied" is sticky across reloads. Only then does `initializeWebLLMWithConsent` construct and `load()` the engine. Progress callbacks drive `WEBLLM_STATE` (`''` → `downloading` → `reloading` → `done`) and `WebLLMProgressTracker`. Switching away from `webllm` in `handleModelChange` tears the engine down.

### 2. Generation — `useGraphState(generateWithLLM)`

**Two response modes**, chosen by the caller's `responseMode` argument and
surfaced as a header toggle plus a control on the start screen
(`RESPONSE_MODES` in `graphConstants.jsx`, persisted under
`graphible-response-mode`):

- `graph` (default) — the original behaviour below: ask for several JSON node
  objects and lay each out as its own node.
- `single` — send the prompt through essentially unchanged and keep the whole
  reply in one node, streaming into it as chunks arrive. The node is titled from
  the reply's own Markdown heading (`deriveHeadingFromText`), falling back to its
  first sentence and then the prompt. Branching, not decomposition, builds the
  graph: a follow-up hangs off the node it was asked from.

In `graph` mode it wraps the user prompt in one of two hard-coded templates; the *context-aware* variant is chosen when the prompt contains `CONTEXT:` or `SELECTED NODES`. Both instruct the model to emit one JSON object per node separated by exactly four newlines. Then:

1. Each decoded chunk goes to `extractJsonFromLlmResponse` (`src/utils/llmUtils.js`). It tries **static extraction** first — fenced ```json block → whole-string parse → brace matching — and falls back to a module-level `StreamingJsonParser`, a string/escape-aware brace matcher that pulls complete objects out of a growing buffer and returns `[node, remainingBuffer]`.
2. That parser is a **stateful singleton**. `resetStreamingParser()` must run at the start of each generation; `useGraphState` does it, other callers don't (see Known issues).
3. Parsing is deliberately forgiving: `cleanJsonString` quotes bare keys, converts single→double quotes, strips trailing commas; `attemptJsonRepair` appends missing braces/quotes; `repairJsonObject` backfills `label`/`type`/`description`/`content` from aliases (`title`, `name`, `summary`, `text`) and coerces an unknown `type` to `concept`.
4. Each object → `processNewNode` → `createNode`, which computes a world position and returns an `Object.freeze`d node, pushed onto state immediately — so the graph grows live while the model is still talking.
5. On stream end, `extractMultipleJsonFromResponse` (capped at 10 nodes) sweeps whatever is left in the buffer. On a thrown error the same sweep runs, and if it finds nothing but there are >20 characters of text, `createFallbackNode` turns the raw text into a visible node rather than dropping it. Failures surface through `alert()`.

`generationStatus` is `{ isGenerating, currentNodeId, tokensGenerated, startTime, elapsedTime }`, mirrored into a `generationStateRef` so the streaming loop can read a fresh token count without re-rendering; a 1s interval updates `elapsedTime` and feeds `GenerationStatusBar`. Token counts are character counts, not real tokens. An `AbortController` guards the whole loop, surfaced as the Stop button in `GenerationStatusBar`.

**Node shape**: `{ id, label, type: 'root'|'concept'|'example'|'detail', description, content, context, worldX, worldY, width, height?, batchId, parentNodeId, depth, createdAt }`. **Connections**: `{ from, to }` holding node ids.

**Ids come from a monotonic counter** in `useGraphState`, never from array
position. It resets with the graph and is raised past any ids adopted from a
loaded or demo graph. Everything resolves nodes by id — `nodeMap`, or
`find(n => n.id === …)` — never by index.

Two structural facts worth knowing before touching graph code:

- **`id` is the index into the `nodes` array** (`uniqueNodeId = nodes.length + nodeCount`). Much of the app depends on it: `App.jsx` draws edges via `nodes[conn.from]`, `useKeyboardNavigation` reads `nodes[currentNodeId]`, `Minimap` uses `nodes.at(conn.from)`, `buildContextUpToNode` does `allNodes[targetNodeId]`. Deletion filters the array without reindexing, so afterwards index-based and id-based lookups disagree. This is the single most load-bearing invariant in the codebase.
- **New nodes are chained, not treed.** Within a batch, the first node connects to `sourceNodeId` (the node you prompted from) and every subsequent node connects to the *previous* node created. `parentNodeId` is derived from that same condition, so it always names the node the edge actually points from.

`currNodeDepth` increments once per completed generation, and depth is what rotates the layout direction (below). `cleanupOrphanedConnections` runs automatically whenever `nodes` changes.

### 3. Coordinates, layout, rendering

`src/utils/coordinateUtils.js` owns the transform: `worldToScreen`/`screenToWorld` with camera `{x, y, zoom}`, zoom clamped 0.1–3.0 by the wheel handler. Note these read `window.innerWidth/innerHeight` directly, while `App.jsx`'s render path re-derives the same math inline in a `style` transform — two parallel implementations of one transform.

`calculateNodePosition` fans each new node out along a direction rotated by `RAD_PER_DEPTH` (π/3) per depth level (`depthToScalar`), which is why each new conversational branch heads off in a visually distinct direction. Sibling spacing calls `getCurrentElementDimensions`, which **measures the live DOM** via `getBoundingClientRect`, falling back to `estimateNewNodeDimensions` — a character-width heuristic (`fontSize * 0.4`) — when the element isn't rendered yet. Layout therefore depends on what is already on screen. There's a standing `TODO` to cache dimensions on the node instead.

`applyForceDirectedLayout` (d3-force: link + charge + center + collision) runs its iterations **synchronously** in a loop — 300 by default, 200 as called from `applyLayoutOptimization` behind the "Optimize Layout" button.

Rendering deliberately avoids per-node transforms: **one wrapper div** carries the whole camera transform, nodes are absolutely positioned divs at `worldX/worldY` inside it (centered with `translate(-50%, -50%)`), and **every edge is drawn in a single inline `<svg>`** as a quadratic Bézier with a shared arrowhead marker. Stroke widths and endpoint radii are divided by `camera.zoom` so they stay visually constant while zooming.

`useCamera` exposes two setters and they are not interchangeable: `setCameraImmediate` is a plain state write, while **`setCameraTarget` animates** — a 300ms cubic ease-out (`ANIMATION_SETTINGS.CAMERA_TRANSITION_DURATION`) driven by `requestAnimationFrame`. Node clicks use the immediate one; minimap navigation and "Reset View" use the animated one.

### 4. Interaction layer

Three independent global mouse-listener systems coexist. Check all of them when touching pointer behavior:

- **`App.jsx`** — background panning, one effect gated on `!showPromptCenter`. It decides "is this the background?" with `e.target.closest()` against `.node-component`, `.minimap-container`, `.details-panel`, `.modal`, `.node-controls`, `.resize-handle`, plus `button/input/textarea/select/a`. **Renaming or dropping those class names silently breaks panning**, and conversely a new interactive overlay needs one of them or dragging from it will pan the camera. A separate non-passive `wheel` listener does zoom.
- **`useNodeManipulation`** — node drag and resize. Snapshots the start point and camera into a ref, converts screen delta to world delta by `/ camera.zoom`, and attaches its listeners only while a manipulation is active. Resize clamps to 200–800 × 100–600. It returns `draggingNodeId`/`isResizingNodeId`; the pan handlers bail out while either is set.
- **`NodeDetailsPanel`** and **`Minimap`** — each implements its own drag/pan/resize with its own document listeners.

Node verbs (`NodeComponent`): plain click focuses (sets `currentNodeId`, opens the details panel, centers the camera); **Ctrl/Cmd+click** toggles selection; **Shift+click** moves; the corner handle resizes; hover controls give thumbs up/down (feedback) and ✕ (soft-delete into the deletion store). `isClickable` blocks clicks on nodes ahead of the generation cursor. The component is `memo`'d with a **hand-written comparator** — a new prop that should trigger re-render must be added to that list or it silently won't.

`useKeyboardNavigation`: WASD/arrows **snap to the nearest node in that direction** (>50px away, minimum Euclidean distance) rather than moving the camera freely; polled on a 50ms interval (`KEYBOARD_THROTTLE_MS`) and suppressed while the centered prompt, a modal, or the prompt box is active. Two components additionally register global keydown listeners that fire on any alphanumeric key: `CenteredPrompt` (replaces the start prompt with that character) and `NewPromptBox` (opens the follow-up prompt). Neither unregisters when hidden, since both hooks run before the component's early return.

### 5. Context selection — what actually gets sent back

`useNodeSelection` holds the selection `Set` plus `contextMode`, cycled by `toggleContextMode` through `auto → manual → branch → batch`:

- `auto` — `updateAutoContext` scores: the current node, up to 3 siblings from the same `batchId`, all directly connected nodes, up to 3 ancestors, plus keyword-overlap matches (>30% of the current node's top-5 keywords), capped at 8 total
- `manual` — click toggles a single node
- `branch` — recursive subtree from the clicked node
- `batch` — every node sharing the clicked node's `batchId`

`App.jsx`'s "Normal" button calls `setContextMode('auto')`; the adjacent button cycles. Tooltips live in `CONTEXT_MODE_LABELS` at the top of `App.jsx` — keep it in sync with the hook's mode list.

The hook also exposes debounced hygiene helpers (`cleanupInvalidSelections`, `scheduleCleanup` — throttled to once per 200ms, then a 100ms debounce) to drop selections pointing at deleted nodes. `App.jsx` doesn't call them.

`NewPromptBox` assembles the outgoing prompt. It inlines its own `CONTEXT:` and `SELECTED NODES CONTEXT:` blocks — topic lists and label/description summaries built from `buildContextUpToNode` — plus checkboxes to include/exclude each, and a live preview of which nodes are in context. `useGraphState` then sniffs that prefix to pick its template. **Changing those marker strings breaks the handshake.**

`contextUtils.js` exports richer builders that the live path never calls: `buildContextString` (full content, length-budgeted to 4000 chars, recency-prioritized truncation), `buildContextSummaryString` (grouped by node type), and `buildSelectedNodesContext` (emoji-prefixed summaries plus common-word relationship hints). The file then ends with ~200 lines of commented-out, explicitly unimplemented analysis helpers.

### 6. Minimap and clustering

`Minimap.jsx` (~780 lines) is effectively a self-contained sub-app: its own SVG viewport driven by `viewBox`, its own pan and zoom (0.5–3.0, wheel + buttons), expand/collapse (280×200 → 600×400), click-to-navigate, and a dashed rect showing the main viewport. Nodes render as **layered blurred circles** — a heat-map look rather than dots — with root nodes and the current node getting extra glow.

Cluster rendering adds: per-cluster zoom-visibility thresholds with opacity fades (`getClusterLabelVisibility`, scored by node count, presence of a root node, and rank), viewport-relevance ranking (`calculateClusterViewportRelevance`), a cap on how many clusters get labels at once (`baseLimit + zoom * 4`), and **spiral collision avoidance** for label placement (`calculateSmartLabelPositions`, 12 attempts around 8 directions). Below 1.5× zoom individual nodes are replaced by merged cluster blobs. Label font size and blur radii all scale by `1 / minimapZoom` so text grows as you zoom out.

`src/utils/clusteringUtils.js` exposes four algorithms through `clusteringLogic` (the dropdown labels them None/Topic/Time/Space/Level):

| key | grouping | labels |
|---|---|---|
| `semantic` | MiniLM sentence embeddings + cosine similarity (threshold 0.7); **falls back to keyword overlap above 20 nodes** or if the model fails to load | top words from member labels |
| `temporal` | `batchId` | relative time ("Yesterday", `HH:MM`) |
| `spatial` | proximity within 800 units; single-node clusters filtered out | NATO phonetic alphabet |
| `hierarchical` | `depth`, subdivided by `parentNodeId` when a level exceeds 4 nodes | the depth number |

`applyClustering` merges per-algorithm defaults and falls back to `groupByTypeSimplified` on any error. Semantic clustering downloads `Xenova/all-MiniLM-L6-v2` through `@huggingface/transformers` on first use, cached in a module-level pipeline with a 1000-entry FIFO embedding cache. All labels are computed locally. Note clustering re-runs on every `nodes`/`connections` change, so anything added here runs often — an earlier LLM-labelling hook was removed for exactly that reason.

### 7. Onboarding, modals, persistence

`SetupWizard/` opens on first launch (`loadSetupConfig().isComplete === false`) and from the header. Steps run `welcome → choice → consent → setup → testing → success`, with `getAccessibleSteps` gating forward movement on consent and a passing connection test. It has breadcrumb navigation, keyboard support (←/→, Home, Ctrl+R to reset, number keys 1–6, a Tab focus trap, Escape to close), an exit-confirmation dialog when abandoning mid-flow, `role="dialog"`/`aria-*` wiring, and an `AbortController` guarding in-flight detection.

The wizard's option vocabulary (`demo`/`browser`/`cloud`/`local`) is **not** the config vocabulary (`demo`/`webllm`/`external`/`local`) — `handleSetup` maps between them. `DEMO_GRAPH_DATA` is a hand-authored 4-node "Understanding Neural Networks" graph (with KaTeX in its content) that makes the app fully explorable with no model at all; picking demo loads it and closes the wizard immediately.

`setupWizardUtils.js` backs it: `detectAvailableModels` probes only Ollama (5s timeout; WebLLM and external are assumed available), `testModelConnection` uses a 30s timeout for local and 10s for Gemini and maps errors to user-facing suggestions, `validateApiKey` only checks length ≥ 10, `checkBrowserCompatibility` gates on Chrome 113+/Firefox 141+/Safari, and `copyToClipboard` falls back to a hidden textarea + `execCommand`.

Modals, all gated by `App.jsx` booleans: `SaveLoadModal`, `DeletionStoreModal` (checkbox multi-select, bulk restore / permanent delete with confirm; restore drops connections whose other endpoint no longer exists), `ConnectionManager` (two-panel: click two nodes to connect, X to remove; refuses duplicates in either direction), `ModelSelector` (Browser/Local/External tabs, click-outside-to-close, saves then tests after 100ms — also embedded in `CenteredPrompt`), `FeedbackModal`, `SetupWizard`.

The header's home button returns to `CenteredPrompt` by setting
`showPromptCenter` back to `true`. It leaves the graph in state, so the start
screen offers "Back to graph" (and Escape) whenever `nodes.length > 0`. That is
only safe because `handleInitialPromptSubmit` calls `resetGraph` before
generating — a kept graph can be returned to, but never appended to.

`NodeDetailsPanel` is the **only** place a node's full `content` renders — Markdown through `react-markdown` + `remark-math` + `rehype-katex`, in a draggable, resizable panel. Graph nodes themselves show only label and description.

Persistence is browser-only — there is no server:

- `localStorage` — `graphible-model-config`, `graphible-google-api-key`, `graphible-setup-complete`, `graphible-setup-timestamp`, `graphible-webllm-consent`, `graphible-consent-<option>`. `saveSetupConfig` deliberately strips `apiKey` out of the main config blob and stores it under its own key.
- `sessionStorage` — `graphible`, the saved-graph list via `useSaveLoad`. **Saved graphs do not survive a browser restart.**

### 8. Feedback and adaptive UI

`uiPersonality` in `App.jsx` is a runtime theme object — colors (with a `root` variant), typography, layout, effects, animations, `customProperties`, `decorativeElements`, and free-form `customCSS`. It is applied as inline styles on nodes and injected by an effect into a `<style id="adaptive-styles">` element, with some font-family keyword sniffing (`bubble` → Comic Sans, `mono`, `serif`). It is separate from `colorSchemes` in the constants, which supplies the conventional palette selected as `currentScheme`.

`FeedbackModal` asks an LLM to return a mutated `uiPersonality` as JSON and deep-merges each sub-object; `useFeedback.analyzeFeedback` separately categorizes feedback into content/visual/layout/interaction and accumulates `feedbackHistory` (surfaced per node in `NodeDetailsPanel`) and `feedbackCategories`. Quick-option buttons only appear after 2+ prior feedback entries.

**Both LLM calls hardcode Ollama at `localhost:11434`** instead of routing through `useLLMConnection`, and both call `extractJsonFromLlmResponse` without resetting the shared streaming parser. The subsystem also has no UI entry point at all — see below.

### 9. Styling and page shell

Tailwind v4 via `@tailwindcss/vite`; there is **no `tailwind.config.js`**. Global styles live in `src/index.css`, which imports Tailwind and `katex/dist/katex.min.css`, defines the `.node-component` / `.minimap-container` / `.details-panel` classes that the pointer hit-testing depends on, and **hand-writes the `.prose` rules** used by `NodeDetailsPanel` — `@tailwindcss/typography` is not a dependency, so the `prose-slate` utility class does nothing. Graph and node theming is inline styles from `uiPersonality` + `colorSchemes`, not Tailwind classes.

`index.html` paints a dark full-screen `#loading` spinner that `main.jsx` hides once React mounts, and inlines its own scrollbar/body CSS. It also has duplicated `<meta charset>`/`viewport` tags and links two favicon PNGs (`favicon-32x32.png`, `favicon-16x16.png`) that don't exist in `public/` — only `favicon.svg` and `brain-icon.svg` do. `src/App.css` is untouched Vite-template boilerplate imported nowhere.

## Layout and layering

A z-index only competes within its own stacking context. The model menu opens
inside the header, so its `z-50` could never lift it above the details panel —
the panel is a sibling of the *header*, not of the menu, and the panel swallowed
clicks on the menu's controls. The header takes `Z.HEADER` and rises to
`Z.DROPDOWN` while a menu inside it is open; the container has to do the lifting
the child cannot. Overlap only happens at narrower viewports, so the regression
test runs at 900px.

`src/constants/zLayers.js` is the stacking order. These were ad hoc numbers
scattered across components and they collided twice: the details panel sat below
the minimap it overlaps, and raising it then hid modals behind it. Anything that
floats belongs in that scale.

The details panel opens at half the viewport, docked right, and focusing a node
offsets the camera by half the panel width (`panelLayout.js`) so the node is not
parked behind the panel describing it.

Panels must fit the viewport: `body` and `#root` both set `overflow: hidden`, so
anything taller than the window has content that literally cannot be reached.
The model dropdown shipped that way and its Apply button was unclickable.

## Testing against the live API

`scripts/probe-code-assist.mjs` exercises a Code Assist backend with real
credentials, which is the only way to learn anything true about it. Point it at
a refresh token:

```bash
# after signing in through the app, in the browser console:
#   localStorage.getItem('graphible-code-assist-refresh')   # or -antigravity-
echo '<token>' > .env/code-assist-refresh                   # .env/ is gitignored
node scripts/probe-code-assist.mjs gemini-cli               # or: antigravity
```

It prints the project each host resolves, the model ids the account's own quota
names, and which host × project × model combinations generate.

**Every wrong turn this backend produced came from testing a proxy for the real
thing**, and each was corrected only by a real request:

| believed | actually |
|---|---|
| `gemini-3.7-flash` is the current model | not in this vocabulary at all — 404 |
| `gemini-3.1-pro-preview` is a bad id | valid; the failure was a **429**, quota, not 404 |
| preview ids need undetectable account access | they are ordinary ids and work |
| Google retired the gemini-cli client | an artifact of Node's User-Agent, not a fact about Google |
| Antigravity cannot work from a web page | its models work; only its *User-Agent* is out of reach |

404 means a bad model id. 429 means a good one whose quota is spent. Confusing
the two removed the model the user had asked for.

## Known issues

Verified by reading and by test runs. `git log` has what was fixed and why.

**Still open**
- The `code-assist` client ids belong to gemini-cli and to Antigravity, not to
  this project. If Google rotates either or withdraws the flow, the path breaks
  with no warning here. `loadCodeAssist`
  returning no `cloudaicompanionProject` may need an `onboardUser` call that is
  not implemented.
- `useKeyboardNavigation`'s snap navigation and `NewPromptBox`'s global
  alphanumeric listener are registered even while their components are hidden,
  because the hooks run before the early return. `CenteredPrompt` had the same
  bug and is now gated on `showPromptCenter`.
- `calculateNodePosition` measures the live DOM through
  `getCurrentElementDimensions`, so layout depends on what is already rendered.
  It also uses `NODE_SPACING.x` for both axes, which may or may not be deliberate.
- `worldToScreen`/`screenToWorld` read `window.innerWidth/innerHeight` directly
  while `App.jsx` re-derives the same transform inline in a style attribute.
- `useNodeSelection` exports `cleanupInvalidSelections`/`scheduleCleanup`;
  nothing calls them, so selections can point at deleted nodes.
- `NodeComponent` syncs width/height from props inside a `useMemo` used as an
  effect.
- 2 `react-hooks/exhaustive-deps` warnings in `SetupWizard`.
- `LLM_CONFIG` still carries a flat backwards-compatibility block that nothing
  reads, and `setupWizardConstants.jsx` exports several unused objects.
- `App.jsx` is still ~920 lines. The pointer layer is extracted; the model and
  modal orchestration are the next seams.
- The browser-model download path is still unverified end to end: consent,
  capability detection and dispatch are tested, but nothing exercises a real
  model load, which would pull hundreds of megabytes. WebGPU reports **no
  adapter at all** in this dev environment, headless and headed, so it cannot be
  exercised here.
- The Gemini Developer API catalog (`LLM_CONFIG.EXTERNAL.GOOGLE.MODELS`) is the
  one model list never checked against a live endpoint — verifying it needs an
  API key, and nothing here has one. Every other catalog was read from a real
  account's quota.

**Two patterns worth suspecting first**

Most bugs here were one of two kinds. **State read in the same event that set
it** — the wizard refused every transition this way, the WebLLM engine was
invisible to the caller that had just created it, and consent decisions raced
their own storage. **Positional identity** — ids treated as array indices, which
holds until something is deleted and then diverges permanently.

Both are now covered by tests. When something behaves as though it is one step
behind, or points at the wrong node, look there first.
