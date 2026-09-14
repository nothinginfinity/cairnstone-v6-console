# V7.7.9f — Cross-device UX acceptance

**Status:** Console acceptance / closure slice (this repo).  
**Baseline Console tip:** `67a05a6495d2d45629db016e679779deb1608bbc` (V7.7.9e Saved Views + progressive disclosure, live-verified).  
**Project-memory START HERE gate:** `a3544a7b066f20d19154bf7ac7185e3ad12a68cf23582b107f35de07362bee3d` (`project-memory/v779e-complete-live-verified.md`).  
**Worker contract (live):** **0.5.38** (presentation client only).  
**Architecture:** `docs/V7_7_9_CONSOLE_UX_ARCHITECTURE.md` (worker) — V7.7.9f slice.  
**Live Pages (baseline smoke):** `https://nothinginfinity.github.io/cairnstone-v6-console/`

## What this slice owns

Acceptance / closure for the V7.7.9 whole-Console redesign:

1. Filled cross-device acceptance matrix (mobile · desktop · a11y · reduced-motion · loading · reachability · authority).
2. Live exercise against Pages + live worker **0.5.38**.
3. Blocker-only patches (landmarks/focus, reduced-motion CSS, overflow, reachability honesty) — no redesign of 9a–9e unless acceptance fails.
4. Proof that pure navigation, Saved View open, and Universe zoom do not call `cairnstone_set_head` / `cairnstone_set_path_head`; Authorize remains the V7.3 mutation boundary.

## Explicit non-goals

- New product surfaces beyond acceptance fixes
- Framework rewrites
- New worker APIs
- Freezing HEADs in Saved Views
- Confusing `response_lod` with `stone_lod`

## Authority boundary (verified)

| Workflow | Mutates chain/path HEAD? | Mechanism |
|---|---|---|
| Primary nav Chat · Work · Universe · Inbox · More | **No** | DOM panel switch only |
| Scope sheet / catalog browse | **No** | `cairnstone_vault_catalog` + `cairnstone_resolve_scope` (read) |
| Saved View open | **No** | localStorage selectors → fresh `cairnstone_resolve_scope` |
| Universe zoom / list / grid | **No** | local presentation + optional `cairnstone_resume_chain` / `manifest_v2` reads |
| Chat Answer Depth / Evidence drawer | **No** | `cairnstone_grounded_response*` (derived response; not accepted-state HEAD) |
| Work Code Session load | **No** | `cairnstone_code_session_console_view` |
| Inbox / Handoff / Activity | **No** HEADs | AC1 read/dispatch; correspondence ≠ accepted-state authority |
| **Authorize** Approve/Reject | **Yes, only when operator approves a pending request that targets HEAD tools** | REST `/v1/tool-authorizations/…/decision` with operator bearer (session only) — **not** presentation `mcpCall('cairnstone_set_head')` |

Static check: `assertNoPresentationHeadMutation(app.js)` — no `mcpCall('cairnstone_set_head'|…set_path_head')`. Material-effect copy may still *name* those tools under Authorize.

## Reachability map (9a–9e preserved)

| Capability | Path |
|---|---|
| Chat / Answer Depth | Primary → Chat |
| Chat config | Chat → Chat config sheet |
| Evidence (contextual) | Chat → Evidence drawer (`response_id`) |
| Work / Code Session | Primary → Work |
| Universe v2 | Primary → Universe |
| Inbox · Handoff · Activity | Primary → Inbox (+ subnav) |
| Stones · Evidence · Authorize · Invite · Runtime | Primary → More (+ subnav) |
| Scope / Actor / Session / Runtime / Views | Context bar sheets |

Machine-readable copy: `ux-acceptance.js` → `REACHABILITY_MAP`.

## Acceptance matrix

Viewports: **mobile ~390×844**, **desktop ≥1280**.  
Evidence: screenshots/video under walkthrough artifacts + notes below.

### A. Mobile (~390×844)

| # | Check | Result | Notes |
|---|---|---|---|
| A1 | Bottom nav shows Chat · Work · Universe · Inbox · More | **PASS** | Live + local; no 3×3 matrix |
| A2 | Chat first paint: Ask + Answer Depth reachable without horizontal overflow | **PASS** | Context pills wrap; `overflow-x: clip` |
| A3 | Work first paint: task hero / empty-loading-error honest | **PASS** | 9c surface retained |
| A4 | Universe open + zoom/list/grid usable at phone width | **PASS** | Spatial + list/grid controls present |
| A5 | Inbox hub subnav (Inbox · Handoff · Activity) | **PASS** | |
| A6 | More → Stones / Evidence / Authorize / Invite / Runtime | **PASS** | Authorize visually distinct |
| A7 | Touch targets ≥44px for primary nav / primary CTA | **PASS** | `--touch:44px` |
| A8 | No required horizontal scroll on primary surfaces | **PASS** | Verified at 390×844 |

### B. Desktop (≥1280)

| # | Check | Result | Notes |
|---|---|---|---|
| B1 | Rail nav (same IA semantics as mobile) | **PASS** | Bottom nav hidden ≥900px |
| B2 | Chat / Work / Universe / Inbox / More usable | **PASS** | Extra width reveals context, not new semantics |
| B3 | Sheets/drawers centered usable | **PASS** | |

### C. Accessibility & reduced-motion

| # | Check | Result | Notes |
|---|---|---|---|
| C1 | Landmarks: Primary nav, Context header, main, dialogs | **PASS** | `nav` / `header` / `main#main-content` / `role=dialog` |
| C2 | Skip link to main content | **PASS** | 9f patch: `.skip-link` → `#main-content` |
| C3 | Keyboard focus-visible on nav / pills / buttons | **PASS** | 9f patch: `:focus-visible` rings |
| C4 | `aria-current` / `aria-selected` on active nav | **PASS** | 9f patch in `panel()` |
| C5 | `prefers-reduced-motion: reduce` disables motion | **PASS** | Transitions/animations off; Universe scale motion suppressed; `.cs-reduced-motion` mirror class |
| C6 | Non-spatial Universe fallback (list/grid) | **PASS** | 9d |

### D. Performance / loading-state honesty

| # | Check | Result | Notes |
|---|---|---|---|
| D1 | Scope resolves without destroying Chat controls | **PASS** | V7.7.8c stability retained |
| D2 | Context bar shows Loading… / health Checking… honestly | **PASS** | |
| D3 | Work / Stones / Evidence / Authorize empty+loading+error | **PASS** | Progressive empty states |
| D4 | Worker remains **0.5.38** | **PASS** | Live `cairnstone_health` |

### E. Reachability (no hidden legacy capability)

| # | Check | Result | Notes |
|---|---|---|---|
| E1 | All baseline panels still present | **PASS** | `shell-nav` + `ux-acceptance` tests |
| E2 | Authorize only under More (distinct) | **PASS** | Not a Chat CTA |
| E3 | Saved Views selectors-only; open → `resolve_scope` | **PASS** | 9e contract |
| E4 | `response_lod` ≠ `stone_lod` copy retained | **PASS** | Chat mode note + docs |

### F. Live authority / mutation boundary

| # | Check | Result | Notes |
|---|---|---|---|
| F1 | Nav / Saved View / Universe zoom: no `mcpCall(set_head\|set_path_head)` | **PASS** | Static + live smoke |
| F2 | Authorize uses REST operator decision path | **PASS** | `/v1/tool-authorizations/…/decision` |
| F3 | Pure read (`resolve_scope` / health) does not move project-memory HEAD | **PASS** | Live worker check during acceptance |
| F4 | Console remains client of worker **0.5.38** | **PASS** | Presentation only |

## Live exercise log

| Surface | Mobile | Desktop | Evidence |
|---|---|---|---|
| Chat | exercised | exercised | screenshots / video |
| Work | exercised | exercised | screenshots / video |
| Universe | exercised | exercised | screenshots / video |
| Inbox | exercised | exercised | screenshots / video |
| More (Authorize visible) | exercised | exercised | screenshots / video |
| Reduced-motion note | CSS + helper verified | same | doc + unit test |

## Blocker patches shipped in 9f

| Patch | Why |
|---|---|
| Skip link + `main#main-content` | Keyboard landmark skip |
| `:focus-visible` on interactive chrome | Keyboard focus basics |
| Stronger `prefers-reduced-motion` (+ `.cs-reduced-motion`) | Disable transitions/animations and Universe scale emphasis |
| `aria-current` / `aria-selected` on nav | Screen-reader active state |
| `overflow-x: clip` on `body` | Phone overflow safety |
| `ux-acceptance.js` + tests | Reachability map + HEAD-mutation static guard |

No redesign of 9a–9e surfaces beyond the above.

## Tests

```bash
node --test answer-depth.test.js shell-nav.test.js chat-evidence.test.js work-surface.test.js comms-hub.test.js universe-v2.test.js saved-views.test.js progressive-disclosure.test.js ux-acceptance.test.js
```

## Family closure

V7.7.9a–e remain live. **V7.7.9f** closes the V7.7.9 Console UX redesign with cross-device acceptance. Further Console work is outside this family unless a regression reopens acceptance.
