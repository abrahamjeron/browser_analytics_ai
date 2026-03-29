# Prism — Prototype Build Plan

> **Scope**: Web app (dashboard + backend) + Chrome extension (signal capture + prompts)
> Built in independent, testable phases. Each phase has a clear entry/exit condition before moving forward.

---

## Tech Stack Overview

| Layer | Technology | Why |
|---|---|---|
| Extension | TypeScript + Vite + crxjs | MV3-native, hot reload, clean bundling |
| Web App (Frontend) | React + Vite + TailwindCSS | Fast iteration, component reuse with extension popup |
| Web App (Backend) | Node.js + Express + TypeScript | Lightweight, easy Claude API proxy |
| Local Storage (Extension) | `chrome.storage.local` + IndexedDB via `idb` | On-device, MV3-compatible |
| Database (Backend) | SQLite via `better-sqlite3` (prototype) | Zero-config, swap to Postgres later |
| AI Insight Layer | Claude API (`claude-sonnet-4-20250514`) | Insight generation from anonymised pattern data |
| Auth (later phase) | Clerk or Supabase Auth | Freemium gating — skipped in Phase 1–3 |

---

## Phase Map

```
Phase 1 → Signal Engine (Extension only)
Phase 2 → Micro-Confirmation UI (Extension popup + overlay)
Phase 3 → Outcome Capture (Extension popup, end-of-day)
Phase 4 → Web Dashboard (React app, reads from extension storage)
Phase 5 → Pattern Engine (Service worker + backend)
Phase 6 → Weekly Insight (Claude API integration)
Phase 7 → Freemium Gate + Polish
```

Each phase is **independently runnable and testable** before the next begins.

---

## Phase 1 — Signal Engine

**Goal**: Capture raw behavioral signals in the extension service worker and verify they are being logged correctly.

**What gets built**:
- Chrome extension scaffold (Manifest V3, TypeScript, Vite + crxjs)
- Service worker (`background.ts`) that listens to:
  - `chrome.tabs.onActivated` — tab switch events
  - `chrome.tabs.onUpdated` — navigation within a tab
  - `chrome.idle.onStateChanged` — idle / active transitions
- Session tracker: records `{ tabId, domain, startTime, endTime, duration }` per active session
- Event logger: writes raw events to `chrome.storage.local`
- Debug panel: a minimal extension popup (`popup.html`) that shows a live log of captured events

**Trigger detection logic** (rules-based, all in service worker):
```
Primary trigger   → session in Domain A ≥ 5 min → switch to Domain B
                    AND total active time in last 60 min ≥ 15 min

Secondary trigger → ≥ 3 tab switches within any 2-minute window

Backup trigger    → no prompt fired in last 90 minutes of active use
```

**Suppression rules**:
- Max 4 triggers per day
- Min 20-minute gap between triggers
- Suppress if last 2 consecutive triggers were ignored (no label given)

**Folder structure**:
```
/extension
  manifest.json
  src/
    background.ts         ← service worker, all detection logic
    popup/
      popup.html
      popup.tsx           ← debug event log view
    lib/
      sessionTracker.ts   ← session timing logic
      triggerEngine.ts    ← rule evaluation
      storage.ts          ← chrome.storage.local wrappers
  vite.config.ts
  tsconfig.json
```

**Test checklist**:
- [ ] Open 3 tabs, switch between them — events appear in debug popup
- [ ] Stay on one domain for 5+ min, switch — primary trigger fires
- [ ] Switch tabs rapidly 3x in 2 min — secondary trigger fires
- [ ] Trigger fires max 4x per day, not more
- [ ] 20-min gap enforced between triggers
- [ ] All data visible in `chrome.storage.local` via DevTools

**Exit condition**: Triggers fire correctly and raw session data persists in local storage.

---

## Phase 2 — Micro-Confirmation UI

**Goal**: When a trigger fires, show the user a non-blocking overlay to label the decision moment in under 2 seconds.

**What gets built**:
- Content script (`content.ts`) injected into all tabs
- Service worker sends a message to content script on trigger: `{ type: 'SHOW_PROMPT', context: { domain, sessionDuration, switchCount } }`
- Overlay component: floating card (bottom-right, fixed position, z-index 999999)
  - Contextual line: "You just switched context after X min on [domain]"
  - 4 label buttons: **Rushed** / **Focused** / **Distracted** / **Overthinking**
  - Auto-dismiss timer bar (12 seconds)
  - One-click selection closes overlay immediately
- On label selection OR dismiss: writes a `DecisionRecord` to `chrome.storage.local`

**DecisionRecord schema**:
```typescript
interface DecisionRecord {
  id: string                          // uuid
  timestamp: number                   // unix ms
  triggerType: 'primary' | 'secondary' | 'backup'
  domain: string                      // e.g. "notion.so"
  sessionDurationMs: number
  switchCount: number
  label: 'rushed' | 'focused' | 'distracted' | 'overthinking' | null
  outcome: 'good' | 'bad' | null      // filled in Phase 3
  ignored: boolean
}
```

**Folder additions**:
```
/extension/src
  content/
    content.ts            ← message listener, mounts overlay
    Overlay.tsx           ← React component (injected into page DOM)
    overlay.css           ← scoped styles, won't bleed into page
```

**Styling rules for overlay**:
- Shadow DOM or scoped CSS to avoid page style conflicts
- Dark/light auto-detect via `prefers-color-scheme`
- Keyboard: `1` `2` `3` `4` keys map to labels, `Esc` dismisses

**Test checklist**:
- [ ] Trigger fires → overlay appears on current tab within 1 second
- [ ] Auto-dismisses after 12 seconds
- [ ] Clicking a label closes overlay and saves `DecisionRecord` with label set
- [ ] Dismissing without clicking saves record with `label: null, ignored: true`
- [ ] Debug popup shows updated record list
- [ ] Overlay doesn't break layout on Gmail, Notion, Linear, Figma (manual spot check)

**Exit condition**: Decision records with labels are persisting correctly in local storage.

---

## Phase 3 — Outcome Capture

**Goal**: End-of-day batch review — show the user their labeled decisions and let them tag each as good or bad outcome.

**What gets built**:
- Badge counter on extension icon showing number of un-tagged decisions
- End-of-day prompt: service worker fires at a configurable time (default 6pm local) OR when user clicks the icon — whichever comes first
- Extension popup `OutcomeCapture` view: shows up to 5 most recent labeled decisions
  - Each card: domain, time, label → 👍 / 👎 buttons
  - "Skip all" option
  - Completion saves outcome back to the `DecisionRecord`
- Summary screen after tagging: "X decisions logged today"

**Popup view states**:
```
Default view      → today's stats (decisions tracked, outcomes pending)
Outcome view      → list of decisions awaiting outcome tag
Weekly view       → placeholder for Phase 6 insight (shows "coming soon")
```

**Folder additions**:
```
/extension/src/popup
  views/
    DefaultView.tsx
    OutcomeCaptureView.tsx
    WeeklyInsightView.tsx   ← placeholder
  components/
    DecisionCard.tsx
    StatsBadge.tsx
```

**Test checklist**:
- [ ] Badge shows correct count of un-tagged decisions
- [ ] Outcome capture view shows last 5 labeled decisions
- [ ] Tagging 👍/👎 updates the correct `DecisionRecord` in storage
- [ ] "Skip all" marks all as skipped without deleting
- [ ] Completing all tags resets badge to zero
- [ ] Daily prompt fires at configured time (test by temporarily setting to 2 min from now)

**Exit condition**: Full decision records (trigger → label → outcome) persisting locally. Core product loop is closed.

---

## Phase 4 — Web Dashboard

**Goal**: A browser-based dashboard that reads decision history from the extension and visualises patterns. This is the first piece the founder can show to users/investors.

**What gets built**:

**Backend** (`/server`):
- Express + TypeScript server
- `POST /api/decisions/sync` — receives batched decision records from extension, stores in SQLite
- `GET /api/decisions` — returns all records for a user session (session-token auth for now, no full auth)
- `GET /api/stats/weekly` — returns aggregated stats for dashboard

**Frontend** (`/web`):
- React app with TailwindCSS
- Pages:
  - `/` — Dashboard: weekly stats, decision count, outcome rate, label distribution
  - `/decisions` — Full decision log table (filterable by label, outcome, date)
  - `/insight` — Placeholder for Phase 6 weekly insight card

**Dashboard components**:
```
WeeklySummaryCard     → decisions this week, outcome rate %
LabelDistributionBar  → breakdown: rushed / focused / distracted / overthinking
OutcomeByLabelChart   → for each label, % good outcomes (bar chart)
DecisionTimeline      → dot-plot of decisions by time-of-day and day-of-week
RecentDecisions       → last 10 records in a table
```

**Extension → Backend sync**:
- Extension syncs decision records to backend every time the popup is opened (or on a 15-min background interval)
- Records are keyed by `id` — upsert on conflict, no duplicates

**Folder structure**:
```
/server
  src/
    index.ts
    routes/
      decisions.ts
      stats.ts
    db/
      schema.sql
      db.ts
  tsconfig.json

/web
  src/
    pages/
      Dashboard.tsx
      Decisions.tsx
      Insight.tsx
    components/
      WeeklySummaryCard.tsx
      LabelDistributionBar.tsx
      OutcomeByLabelChart.tsx
      DecisionTimeline.tsx
      RecentDecisions.tsx
    lib/
      api.ts            ← typed API client
  tailwind.config.ts
  vite.config.ts
```

**Test checklist**:
- [ ] Extension syncs records to backend — verify in SQLite
- [ ] Dashboard loads and shows correct counts from DB
- [ ] Label distribution chart reflects actual logged labels
- [ ] Outcome-by-label chart shows correct percentages
- [ ] Decision log table is sortable and filterable
- [ ] Works with 0 records (empty state), 1 record, and 20+ records

**Exit condition**: Full decision data flows from browser → extension → backend → dashboard. Visualisations are accurate.

---

## Phase 5 — Pattern Engine

**Goal**: Correlate decision records and surface rule-based patterns, ready to be consumed by the insight generator in Phase 6.

**What gets built**:

**Service worker** (extension): Weekly pattern computation runs locally as a fallback.

**Backend** (`/server/src/patterns`):
- `patternEngine.ts` — core correlation logic
- Inputs per pattern computation:
  - `label` (feeling)
  - `triggerType`
  - `timeOfDay` (morning / afternoon / evening bucket)
  - `switchCount`
  - `sessionDuration`
  - `outcome`
- Pattern types detected:

```
RushPattern        → label='rushed' AND outcome='bad' frequency > threshold
FocusPattern       → label='focused' AND outcome='good' frequency > threshold
HighSwitchPattern  → switchCount ≥ 4 AND outcome correlation
TimeOfDayPattern   → outcome rate differs significantly by time bucket
```

- Output: `PatternSummary` object

```typescript
interface PatternSummary {
  userId: string
  weekStart: string                   // ISO date
  totalDecisions: number
  outcomeRate: number                 // % good
  dominantLabel: string
  patterns: DetectedPattern[]
  rawStats: {
    byLabel: Record<string, { count: number; goodOutcomes: number }>
    byTimeOfDay: Record<string, { count: number; goodOutcomes: number }>
    byTriggerType: Record<string, { count: number; goodOutcomes: number }>
  }
}
```

- `GET /api/patterns/weekly` — returns `PatternSummary` for the current week

**Test checklist**:
- [ ] Seed DB with 15–20 synthetic decision records covering all label types
- [ ] Pattern engine returns correct `dominantLabel`
- [ ] `RushPattern` detected when ≥ 60% of rushed decisions have bad outcomes
- [ ] `TimeOfDayPattern` detected when morning vs afternoon outcome rates differ by ≥ 20%
- [ ] `PatternSummary` serialises cleanly as JSON
- [ ] Edge case: < 5 decisions this week → returns `{ insufficient_data: true }`

**Exit condition**: Pattern engine returns structured `PatternSummary` from real decision data.

---

## Phase 6 — Weekly Insight (Claude API)

**Goal**: Use the `PatternSummary` to generate a human-readable weekly insight via Claude API and display it in both the extension popup and the web dashboard.

**What gets built**:

**Backend** (`/server/src/routes/insight.ts`):
- `POST /api/insight/generate`
  - Fetches current week's `PatternSummary`
  - Builds prompt from pattern data (no raw personal content sent — only anonymised stats)
  - Calls Claude API (`claude-sonnet-4-20250514`)
  - Stores generated insight in DB with `weekStart` key (one per week)
- `GET /api/insight/latest` — returns most recent stored insight

**Prompt template**:
```
You are a decision-quality coach. A user has logged their decisions this week.
Here is their anonymised pattern summary:

- Total decisions: {{totalDecisions}}
- Overall good outcome rate: {{outcomeRate}}%
- Label breakdown: {{byLabel}}
- Time of day breakdown: {{byTimeOfDay}}
- Detected patterns: {{patterns}}

Generate a weekly insight in exactly this JSON format:
{
  "pattern": "One sentence describing the key behavioural pattern",
  "quantification": "One sentence with the most compelling number",
  "suggestion": "One concrete, specific action they can take next week"
}

Be direct and specific. Avoid generic advice. Use the numbers.
```

**Extension popup** (`WeeklyInsightView.tsx`):
- Fetches `GET /api/insight/latest` on popup open
- Renders: Pattern card → Quantification → Suggestion
- "Refresh insight" button (rate-limited to once per day)
- If no insight yet: "Check back after your first week of tracking"

**Web dashboard** (`/insight` page):
- Full insight card with the three sections
- Below it: the `PatternSummary` stats that generated it (transparency layer)
- History: list of past weekly insights (clicking expands)

**Test checklist**:
- [ ] `POST /api/insight/generate` with a seeded `PatternSummary` returns valid JSON insight
- [ ] Claude response is correctly parsed and stored in DB
- [ ] Extension popup renders insight correctly
- [ ] Dashboard insight page renders with stats breakdown
- [ ] Calling generate twice in the same week returns the cached insight, not a new API call
- [ ] Handles Claude API error gracefully (shows "Insight unavailable" state)
- [ ] Prompt sends zero raw user content — verify by logging the exact payload sent

**Exit condition**: End-to-end flow works — decisions logged → pattern computed → insight generated → rendered in popup and dashboard.

---

## Phase 7 — Freemium Gate + Polish

**Goal**: Add auth, paywall, and production-ready polish before any user testing.

**What gets built**:

**Auth**:
- Clerk (recommended) or Supabase Auth
- Extension popup login flow (OAuth via `chrome.identity`)
- All API routes gated behind JWT middleware
- User ID propagated through all decision records

**Freemium tiers**:

| Feature | Free | Paid |
|---|---|---|
| Detection + labeling | ✅ | ✅ |
| Weekly insight (last 7 days) | ✅ | ✅ |
| History (30–90 days) | ❌ | ✅ |
| Trend insights ("improving / declining") | ❌ | ✅ |
| Deeper correlations | ❌ | ✅ |
| Data export (CSV) | ❌ | ✅ |

**Payment**: Stripe Checkout, one subscription tier. Webhook updates `users.plan` in DB.

**Polish items**:
- Onboarding flow in extension (first-run wizard: what Prism tracks, what it doesn't, privacy promise)
- Empty states for all dashboard views
- Extension icon states: active (tracking), idle, needs-outcome (badge)
- Error boundaries on all React components
- Rate limiting on all API routes (`express-rate-limit`)
- Basic logging (`pino`) on the server

**Test checklist**:
- [ ] User can sign up, log in, and see their own data only
- [ ] Free user cannot access 30-day history — sees upgrade prompt
- [ ] Stripe checkout flow completes and plan upgrades in DB
- [ ] Onboarding wizard shows on first install, not on subsequent opens
- [ ] All empty states render without errors

**Exit condition**: A real user can install the extension, sign up, use it for a week, and receive a weekly insight — with the freemium gate enforced.

---

## Development Sequence Summary

```
Week 1    Phase 1 + 2    Signal capture + overlay prompt
Week 2    Phase 3        Outcome capture, full local loop closed
Week 3    Phase 4        Web dashboard wired to backend
Week 4    Phase 5        Pattern engine, seeded + validated
Week 5    Phase 6        Claude API insight, end-to-end demo ready
Week 6+   Phase 7        Auth, Stripe, polish — user testing ready
```

---

## Key Dependencies Between Phases

```
Phase 1 ──► Phase 2 ──► Phase 3       (extension core loop)
                  └──────────────► Phase 4 ──► Phase 5 ──► Phase 6
                                    (web stack)
Phase 6 + Phase 7 ──► User Testing
```

Phase 4 (dashboard) can be scaffolded with synthetic seed data in parallel with Phase 3.
Phase 5 and 6 require real decision data — do not skip validation in Phase 3.

---

## Repo Structure (Monorepo)

```
/prism
  /extension          ← Chrome extension (Vite + crxjs + React)
  /web                ← Dashboard frontend (Vite + React + Tailwind)
  /server             ← Backend API (Express + TypeScript + SQLite)
  /shared             ← Shared TypeScript types (DecisionRecord, PatternSummary, etc.)
  package.json        ← pnpm workspaces
  pnpm-workspace.yaml
  README.md
  PLAN.md             ← this file
```

Shared types package ensures `DecisionRecord` and `PatternSummary` stay in sync across extension, web, and server without duplication.