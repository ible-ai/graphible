# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Graphible turns a prompt into an interactive, node-based "learning graph": an LLM streams JSON nodes, each one is placed in an infinite pan/zoom canvas as it arrives, and you keep exploring by selecting nodes and prompting again. Live demo: <https://ible-ai.github.io/graphible>.

## Commands

```bash
npm run dev        # Vite dev server on https://localhost:3000 (host: true)
npm run build      # Production build -> dist/ (sourcemaps on)
npm run preview    # Serve the production build
npm run lint       # ESLint (flat config)
npm run deploy     # build + gh-pages -d dist
npm run test-build # build + preview
```

No test suite, no test runner, no TypeScript — `.js`/`.jsx` only. Node >= 18.

**`npm run dev` requires local TLS certs** at `.env/localhost+2-key.pem` and `.env/localhost+2.pem`. `.env/` is gitignored, so a fresh clone cannot start the dev server until you generate them (`mkcert localhost 127.0.0.1 ::1`). Vite declares HTTPS in three places (`server`, `preview`, and a non-standard `dev` block). HTTPS matters because WebGPU/WebLLM and the local Ollama fetches expect a secure context.

**`npm run lint` currently fails on a clean tree** — 62 problems (56 errors, 6 warnings), mostly `no-unused-vars`, plus a `no-undef` in `src/dev/themes/ocean.js` and a `no-async-promise-executor` in `src/utils/setupWizardUtils.js`. Don't read a red lint run as damage you caused; diff against this baseline. `globalIgnores` only lists `dist`, so the gitignored `src/dev/` scratch fork gets linted too and contributes errors. The one rule override is `no-unused-vars` with `varsIgnorePattern: '^[A-Z_]'`.

To run against a real local model: install [Ollama](https://ollama.ai), start it with CORS open (`OLLAMA_ORIGINS=* ollama serve`), and pull a model (`ollama pull gemma3:4b`, or `gemma3:270m` for the lightweight path). Without any of that the app still runs — it defaults to demo mode.

Push to `main` → `.github/workflows/deploy.yml` builds and deploys to GitHub Pages. `base: './'` makes the bundle work from the Pages subpath. `vite-plugin-node-polyfills` (util/buffer/process/global) is needed by the LLM SDKs; `crypto` is marked external in the rollup config. `.github/workflows/local_test.sh` is not a workflow — it's a three-line scratch script (clean install, build, `git add .`).

## Repo map

36 source files under `src/`:

```
src/App.jsx              1069 lines — the whole app shell; all UI state lives here
src/main.jsx                        — React root; hides index.html's #loading div
src/index.css                       — Tailwind + KaTeX imports, hit-test classes, hand-rolled .prose
src/hooks/          (10)            — camera, graph state, LLM, selection, manipulation, feedback, save/load, keyboard, browser-LLM engine
src/utils/           (5)            — coordinates, LLM parsing, context building, clustering, wizard helpers
src/constants/       (2)            — graphConstants.jsx, setupWizardConstants.jsx
src/components/     (16)            — Minimap (806) and SetupWizard (824) are the two big ones
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
| `external` | Google Gemini via `@google/genai`; `generateContentStream`, chunks flattened across `candidates[].content.parts[].text` |
| `webllm` | `BrowserLLMEngine` (`useBrowserLLMEngine.js`), which dispatches per model id through `BROWSER_LLM_TO_PROVIDER` to either `@mlc-ai/web-llm` (`MLCEngine.chat.completions.create`) or `@huggingface/transformers` (`pipeline` + `TextStreamer`), re-wrapping both into the same envelope |

Connection state is a tri-state string: `'pending' | 'connected' | 'disconnected'`. `testLLMConnection` throttles itself — after `maxFailures` (3) it refuses to retry within a `cooldownPeriod` (5s).

WebLLM consent flow, in order: `testWebLLMConnection` first checks `navigator.gpu` and requests an adapter (**no consent needed for the capability check**); returns early if an engine for that same `modelId` already exists; otherwise calls `requestWebLLMConsent` (a `window.confirm`, though the code notes it should be a modal), which no-ops once `consentRequested` is set — that flag is seeded from `graphible-webllm-consent` on mount, so a prior "denied" is sticky across reloads. Only then does `initializeWebLLMWithConsent` construct and `load()` the engine. Progress callbacks drive `WEBLLM_STATE` (`''` → `downloading` → `reloading` → `done`) and `WebLLMProgressTracker`. Switching away from `webllm` in `handleModelChange` tears the engine down.

### 2. Generation — `useGraphState(generateWithLLM)`

Wraps the user prompt in one of two hard-coded templates; the *context-aware* variant is chosen when the prompt contains `CONTEXT:` or `SELECTED NODES`. Both instruct the model to emit one JSON object per node separated by exactly four newlines. Then:

1. Each decoded chunk goes to `extractJsonFromLlmResponse` (`src/utils/llmUtils.js`). It tries **static extraction** first — fenced ```json block → whole-string parse → brace matching — and falls back to a module-level `StreamingJsonParser`, a string/escape-aware brace matcher that pulls complete objects out of a growing buffer and returns `[node, remainingBuffer]`.
2. That parser is a **stateful singleton**. `resetStreamingParser()` must run at the start of each generation; `useGraphState` does it, other callers don't (see Known issues).
3. Parsing is deliberately forgiving: `cleanJsonString` quotes bare keys, converts single→double quotes, strips trailing commas; `attemptJsonRepair` appends missing braces/quotes; `repairJsonObject` backfills `label`/`type`/`description`/`content` from aliases (`title`, `name`, `summary`, `text`) and coerces an unknown `type` to `concept`.
4. Each object → `processNewNode` → `createNode`, which computes a world position and returns an `Object.freeze`d node, pushed onto state immediately — so the graph grows live while the model is still talking.
5. On stream end, `extractMultipleJsonFromResponse` (capped at 10 nodes) sweeps whatever is left in the buffer. On a thrown error the same sweep runs, and if it finds nothing but there are >20 characters of text, `createFallbackNode` turns the raw text into a visible node rather than dropping it. Failures surface through `alert()`.

`generationStatus` is `{ isGenerating, currentNodeId, tokensGenerated, startTime, elapsedTime }`, mirrored into a `generationStateRef` so the streaming loop can read a fresh token count without re-rendering; a 1s interval updates `elapsedTime` and feeds `GenerationStatusBar`. Token counts are character counts, not real tokens. An `AbortController` guards the whole loop.

**Node shape**: `{ id, label, type: 'root'|'concept'|'example'|'detail', description, content, context, worldX, worldY, width, height?, batchId, parentNodeId, depth, createdAt }`. **Connections**: `{ from, to }` holding node ids.

Two structural facts worth knowing before touching graph code:

- **`id` is the index into the `nodes` array** (`uniqueNodeId = nodes.length + nodeCount`). Much of the app depends on it: `App.jsx` draws edges via `nodes[conn.from]`, `useKeyboardNavigation` reads `nodes[currentNodeId]`, `Minimap` uses `nodes.at(conn.from)`, `buildContextUpToNode` does `allNodes[targetNodeId]`. Deletion filters the array without reindexing, so afterwards index-based and id-based lookups disagree. This is the single most load-bearing invariant in the codebase.
- **New nodes are chained, not treed.** Within a batch, the first node connects to `sourceNodeId` (the node you prompted from) and every subsequent node connects to the *previous* node in the stream. `parentNodeId` is set as `previousNodeId > 0 ? previousNodeId : null`, so node 1 always records a `null` parent — which matters to `hierarchical` clustering, which groups by `parentNodeId`.

`currNodeDepth` increments once per completed generation, and depth is what rotates the layout direction (below). `cleanupOrphanedConnections` runs automatically whenever `nodes` changes.

### 3. Coordinates, layout, rendering

`src/utils/coordinateUtils.js` owns the transform: `worldToScreen`/`screenToWorld` with camera `{x, y, zoom}`, zoom clamped 0.1–3.0 by the wheel handler. Note these read `window.innerWidth/innerHeight` directly, while `App.jsx`'s render path re-derives the same math inline in a `style` transform — two parallel implementations of one transform.

`calculateNodePosition` fans each new node out along a direction rotated by `RAD_PER_DEPTH` (π/3) per depth level (`depthToScalar`), which is why each new conversational branch heads off in a visually distinct direction. Sibling spacing calls `getCurrentElementDimensions`, which **measures the live DOM** via `getBoundingClientRect`, falling back to `estimateNewNodeDimensions` — a character-width heuristic (`fontSize * 0.4`) — when the element isn't rendered yet. Layout therefore depends on what is already on screen. There's a standing `TODO` to cache dimensions on the node instead.

`applyForceDirectedLayout` (d3-force: link + charge + center + collision) runs its iterations **synchronously** in a loop — 300 by default, 200 as called from `applyLayoutOptimization` behind the "Optimize Layout" button.

Rendering deliberately avoids per-node transforms: **one wrapper div** carries the whole camera transform, nodes are absolutely positioned divs at `worldX/worldY` inside it (centered with `translate(-50%, -50%)`), and **every edge is drawn in a single inline `<svg>`** as a quadratic Bézier with a shared arrowhead marker. Stroke widths and endpoint radii are divided by `camera.zoom` so they stay visually constant while zooming.

`useCamera` exposes two setters and they are not interchangeable: `setCameraImmediate` is a plain state write, while **`setCameraTarget` animates** — a 300ms cubic ease-out (`ANIMATION_SETTINGS.CAMERA_TRANSITION_DURATION`) driven by `requestAnimationFrame`. Node clicks use the immediate one; minimap navigation and "Reset View" use the animated one.

### 4. Interaction layer

Four independent global mouse-listener systems coexist. Check all of them when touching pointer behavior:

- **`App.jsx`, twice.** Two near-duplicate `useEffect`s each attach document-level `mousedown`/`mousemove`/`mouseup` for background panning — one gated on `!showPromptCenter` with a longer element list, one ungated with a shorter one. Both decide "is this the background?" with `e.target.closest()` against `.node-component`, `.minimap-container`, `.details-panel`, `.modal`, `.node-controls`, `.resize-handle`, plus `button/input/textarea/select/a`. **Renaming or dropping those class names silently breaks panning.** A separate non-passive `wheel` listener does zoom.
- **`useNodeManipulation`** — node drag and resize. Snapshots the start point and camera into a ref, converts screen delta to world delta by `/ camera.zoom`, and attaches its listeners only while a manipulation is active. Resize clamps to 200–800 × 100–600. **Name mismatch:** the hook returns `draggingNodeId`/`isResizingNodeId`, but `App.jsx` destructures `isDraggingNode`/`isResizingNode` — permanently `undefined`, so every `if (isDraggingNode !== null) return;` guard in the pan handlers is inert and background panning can't tell a node drag is underway.
- **`NodeDetailsPanel`** and **`Minimap`** — each implements its own drag/pan/resize with its own document listeners.

Node verbs (`NodeComponent`): plain click focuses (sets `currentNodeId`, opens the details panel, centers the camera); **Ctrl/Cmd+click** toggles selection; **Shift+click** or the drag handle moves; the corner handle resizes; the ✕ soft-deletes into the deletion store. `isClickable` blocks clicks on nodes ahead of the generation cursor. The component is `memo`'d with a **hand-written comparator** — a new prop that should trigger re-render must be added to that list or it silently won't.

`useKeyboardNavigation`: WASD/arrows **snap to the nearest node in that direction** (>50px away, minimum Euclidean distance) rather than moving the camera freely; polled on a 50ms interval (`KEYBOARD_THROTTLE_MS`) and suppressed while the centered prompt, a modal, or the prompt box is active. Two components additionally register global keydown listeners that fire on any alphanumeric key: `CenteredPrompt` (replaces the start prompt with that character) and `NewPromptBox` (opens the follow-up prompt). Neither unregisters when hidden, since both hooks run before the component's early return.

### 5. Context selection — what actually gets sent back

`useNodeSelection` holds the selection `Set` plus `contextMode`, cycled by `toggleContextMode` through `auto → manual → branch → batch`:

- `auto` — `updateAutoContext` scores: the current node, up to 3 siblings from the same `batchId`, all directly connected nodes, up to 3 ancestors, plus keyword-overlap matches (>30% of the current node's top-5 keywords), capped at 8 total
- `manual` — click toggles a single node
- `branch` — recursive subtree from the clicked node
- `batch` — every node sharing the clicked node's `batchId`

The hook also exposes debounced hygiene helpers (`cleanupInvalidSelections`, `scheduleCleanup` — throttled to once per 200ms, then a 100ms debounce) to drop selections pointing at deleted nodes. `App.jsx` doesn't call them.

`NewPromptBox` assembles the outgoing prompt. It inlines its own `CONTEXT:` and `SELECTED NODES CONTEXT:` blocks — topic lists and label/description summaries built from `buildContextUpToNode` — plus checkboxes to include/exclude each, and a live preview of which nodes are in context. `useGraphState` then sniffs that prefix to pick its template. **Changing those marker strings breaks the handshake.**

`contextUtils.js` exports richer builders that the live path never calls: `buildContextString` (full content, length-budgeted to 4000 chars, recency-prioritized truncation), `buildContextSummaryString` (grouped by node type), and `buildSelectedNodesContext` (emoji-prefixed summaries plus common-word relationship hints). The file then ends with ~200 lines of commented-out, explicitly unimplemented analysis helpers.

### 6. Minimap and clustering

`Minimap.jsx` (806 lines) is effectively a self-contained sub-app: its own SVG viewport driven by `viewBox`, its own pan and zoom (0.5–3.0, wheel + buttons), expand/collapse (280×200 → 600×400), click-to-navigate, and a dashed rect showing the main viewport. Nodes render as **layered blurred circles** — a heat-map look rather than dots — with root nodes and the current node getting extra glow.

Cluster rendering adds: per-cluster zoom-visibility thresholds with opacity fades (`getClusterLabelVisibility`, scored by node count, presence of a root node, and rank), viewport-relevance ranking (`calculateClusterViewportRelevance`), a cap on how many clusters get labels at once (`baseLimit + zoom * 4`), and **spiral collision avoidance** for label placement (`calculateSmartLabelPositions`, 12 attempts around 8 directions). Below 1.5× zoom individual nodes are replaced by merged cluster blobs. Label font size and blur radii all scale by `1 / minimapZoom` so text grows as you zoom out.

`src/utils/clusteringUtils.js` exposes four algorithms through `clusteringLogic` (the dropdown labels them None/Topic/Time/Space/Level):

| key | grouping | labels |
|---|---|---|
| `semantic` | MiniLM sentence embeddings + cosine similarity (threshold 0.7); **falls back to keyword overlap above 20 nodes** or if the model fails to load | top words from member labels |
| `temporal` | `batchId` | relative time ("Yesterday", `HH:MM`) |
| `spatial` | proximity within 800 units; single-node clusters filtered out | NATO phonetic alphabet |
| `hierarchical` | `depth`, subdivided by `parentNodeId` when a level exceeds 4 nodes | the depth number |

`applyClustering` merges per-algorithm defaults and falls back to `groupByTypeSimplified` on any error. Semantic clustering downloads `Xenova/all-MiniLM-L6-v2` through `@huggingface/transformers` on first use, cached in a module-level pipeline with a 1000-entry FIFO embedding cache. Cluster labels can optionally come from the LLM via `setLabelGenerator` — a **module-level singleton** callback that `Minimap` re-registers whenever the model changes.

### 7. Onboarding, modals, persistence

`SetupWizard/` opens on first launch (`loadSetupConfig().isComplete === false`) and from the header. Steps run `welcome → choice → consent → setup → testing → success`, with `getAccessibleSteps` gating forward movement on consent and a passing connection test. It has breadcrumb navigation, keyboard support (←/→, Home, Ctrl+R to reset, number keys 1–6, a Tab focus trap, Escape to close), an exit-confirmation dialog when abandoning mid-flow, `role="dialog"`/`aria-*` wiring, and an `AbortController` guarding in-flight detection.

The wizard's option vocabulary (`demo`/`browser`/`cloud`/`local`) is **not** the config vocabulary (`demo`/`webllm`/`external`/`local`) — `handleSetup` maps between them. `DEMO_GRAPH_DATA` is a hand-authored 4-node "Understanding Neural Networks" graph (with KaTeX in its content) that makes the app fully explorable with no model at all; picking demo loads it and closes the wizard immediately.

`setupWizardUtils.js` backs it: `detectAvailableModels` probes only Ollama (5s timeout; WebLLM and external are assumed available), `testModelConnection` uses a 30s timeout for local and 10s for Gemini and maps errors to user-facing suggestions, `validateApiKey` only checks length ≥ 10, `checkBrowserCompatibility` gates on Chrome 113+/Firefox 141+/Safari, and `copyToClipboard` falls back to a hidden textarea + `execCommand`.

Modals, all gated by `App.jsx` booleans: `SaveLoadModal`, `DeletionStoreModal` (checkbox multi-select, bulk restore / permanent delete with confirm; restore drops connections whose other endpoint no longer exists), `ConnectionManager` (two-panel: click two nodes to connect, X to remove; refuses duplicates in either direction), `ModelSelector` (Browser/Local/External tabs, click-outside-to-close, saves then tests after 100ms — also embedded in `CenteredPrompt`), `FeedbackModal`, `SetupWizard`.

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

## Known dead code and inconsistencies

All verified by reading the tree. Worth checking before "fixing" something that was never wired up, or before assuming a feature works.

**Unreachable features**
- **Feedback is dead from the UI.** `NodeComponent` accepts an `onFeedback` prop and never calls it; nothing else sets `showFeedbackModal`. So `FeedbackModal`, `useFeedback`, and the whole adaptive-UI path can't be triggered.
- **`InstallationGuide` is unreachable** — it's rendered, but `setShowInstallationGuide(true)` is never called; its former trigger now opens the wizard.
- **No cancel button for generation** despite full `AbortController` support: `useGraphState` returns `cancelGeneration`, `getNodeById`, `getConnectedNodes`, `nodeMap`, and `cleanupOrphanedConnections`, none of which `App.jsx` destructures.

**Dead files and props**
- `src/components/ConnectionComponent.jsx` — superseded by the inline SVG in `App.jsx`. It also calls `worldToScreen` without passing a camera, so it would render at default-camera coordinates if revived.
- `src/App.css` — Vite boilerplate, imported nowhere.
- `Minimap` receives a `colorScheme` prop it never reads; `useLLMConnection` exports `hasUserConsent`/`requestWebLLMConsent` that `App.jsx` ignores; `useSaveLoad.loadGraph` is an identity function (the real load lives in `App.jsx`).
- The `useCallback` at `App.jsx:324` is never invoked, so the legacy `initializeConnection` inside it never runs.

**Logic bugs**
- **`isDraggingNode`/`isResizingNode` are always `undefined`** (the hook returns `draggingNodeId`/`isResizingNodeId`), so the node-drag guards inside the background-pan handlers never fire.
- **Background panning is registered twice**, by two near-identical effects with different element lists. Both run; edit both or consolidate.
- **`contextMode === 'smart'`** is tested in `App.jsx`'s mode buttons and defaulted in `NodeComponent`, but `useNodeSelection` only produces `auto`/`manual`/`branch`/`batch` — so the mode label renders blank in two of four modes.
- **`buildContextUpToNode` early-returns on `!targetNodeId`**, so node id `0` — always the root — yields empty context.
- **`extractFromCodeBlock` uses `String.match` with `/g` regexes**, where `match[1]` is the second whole match rather than a capture group; that extraction strategy rarely does what it looks like it does.
- **Both init effects read a config assigned inside a `setTimeout` callback** synchronously afterward, so the value is always `undefined`/stale.
- **`parentNodeId` is `null` for node 1** because of a `> 0` truthiness check, which skews `hierarchical` clustering.
- `VIEWPORT_CENTER` in `graphConstants.jsx` is computed once at module load, so it's wrong after a window resize.
- `FeedbackModal` uses `<style jsx>`, a Next.js styled-jsx construct this Vite setup doesn't process.

**Stale or inconsistent config**
- The wizard's browser step advertises "Llama 3.2 3B, ~2GB", and `WEBLLM_MODELS` in `setupWizardConstants.jsx` lists a model absent from `LLM_CONFIG.WEBLLM` — while the actual `DEFAULT_MODEL_CONFIGS.WEBLLM` is `onnx-community/Qwen3-0.6B-ONNX`. `WebLLMProgressTracker` also hardcodes a 2048 MB total for its percentage and ETA math.
- `LLM_CONFIG` keeps a flat backwards-compatibility block (`BASE_URL`, `MODEL`, `LW_MODEL`, …) alongside the structured `LOCAL`/`WEBLLM`/`EXTERNAL` sections; the feedback path is what still reads the flat one.
- `index.html` references two favicon PNGs that don't exist in `public/`.
