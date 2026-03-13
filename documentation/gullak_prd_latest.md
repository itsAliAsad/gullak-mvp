# Gullak — Product Requirements Document

**Version:** 1.0 (As-Built)
**Date:** 2026-03-13
**Project:** AWS AI Hackathon Submission
**Status:** MVP Complete

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [User Personas](#3-user-personas)
4. [User Journey](#4-user-journey)
5. [System Architecture](#5-system-architecture)
6. [Agent Specifications](#6-agent-specifications)
7. [Orchestrator](#7-orchestrator)
8. [API Reference](#8-api-reference)
9. [Frontend](#9-frontend)
10. [Data Model](#10-data-model)
11. [Implemented Features Checklist](#11-implemented-features-checklist)
12. [Known Limitations / Out of Scope](#12-known-limitations--out-of-scope)

---

## 1. Product Overview

**Gullak** (Urdu: گُلَّک — a piggy bank) is an AI-powered mutual fund advisor for Pakistani retail investors. It guides users through a conversational profiling flow, scores and shortlists funds from a database of 522 Pakistani mutual funds, and delivers plain-language explanations with an interactive dashboard.

### Hackathon Context

Built for the **AWS AI Hackathon**. The project demonstrates end-to-end use of AWS managed AI and serverless infrastructure with a production-quality frontend.

### Tech Stack Summary

| Layer | Technology |
|---|---|
| AI Framework | `pydantic_ai` |
| LLMs | Amazon Bedrock — Claude Haiku 4.5 (Profiler), Claude Sonnet 4.5 (Analyst, Explainer, Progress Narrator) |
| Backend Runtime | AWS Lambda (single function) |
| API Exposure | Lambda Function URL for chat, progress polling, and transcription; API Gateway WebSocket for live progress push |
| Session State | Amazon DynamoDB |
| Speech-to-Text | Amazon Transcribe Streaming |
| Frontend | React + Vite |
| Fund Data | `fund_features.json` (522 funds, loaded at cold-start) |

---

## 2. Problem Statement

Pakistan's mutual fund industry presents three compounding barriers for retail investors:

1. **Scale without accessibility.** There are 312+ mutual funds across multiple categories. No single consumer-facing tool exists to meaningfully compare them.
2. **Jargon-heavy industry.** Terms like expense ratio, capture score, drawdown, and alpha are opaque to non-specialist investors. AMC websites are data-dense but not advisory.
3. **No personalized recommendation engine.** MUFAP (the regulator) publishes performance data but provides no filtering, ranking, or suitability matching.

The consequence: retail investors either park money in savings accounts (negative real returns) or rely on relationship managers with sales incentives. Neither serves the investor's interest.

Gullak addresses all three barriers: it replaces jargon with conversational input, replaces static data with a weighted scoring engine, and replaces generic fund lists with investor-specific shortlists.

---

## 3. User Personas

### Persona 1: The First-Time Investor
- **Profile:** 24–32 years old, salaried, Rs 5,000–20,000/month to invest
- **Pain points:** Doesn't know where to start; confused by fund categories; worried about losing money
- **Needs:** Step-by-step guidance, simple language, no-jargon explanations
- **Gullak fit:** Quick-reply buttons remove decision paralysis; Explainer agent uses plain Urdu-inflected English; education panel explains every metric on tap

### Persona 2: The Goal-Oriented Saver
- **Profile:** 30–45 years old, saving toward a specific milestone (child's education, home down-payment, retirement corpus)
- **Pain points:** Doesn't know which fund category suits their timeline; unsure how much to invest monthly
- **Needs:** Horizon-appropriate recommendations, SIP projection, category explanation
- **Gullak fit:** Time horizon → category mapping; Investment Calculator pre-filled from profiling; Explainer narration anchored to their specific goal

### Persona 3: The Shariah-Conscious Investor
- **Profile:** Any age; will not invest in conventional (interest-bearing) funds under any circumstance
- **Pain points:** Hard to identify truly Shariah-compliant funds; fears accidental exposure to riba
- **Needs:** Hard filter on Shariah compliance; confidence that shortlist contains only halal instruments
- **Gullak fit:** Shariah flag is a hard filter, not a preference weight — conventional funds are completely excluded when the user says yes

### Persona 4: The Experienced Investor Seeking a Second Opinion
- **Profile:** 35–55 years old, already invests but wants to re-evaluate existing portfolio or validate a new decision
- **Pain points:** Doesn't trust sales-motivated advisors; wants quantitative basis for decisions
- **Needs:** Detailed fund metrics, performance history, comparison capability
- **Gullak fit:** Analyst agent surfaces 30+ fund fields; follow-up chat allows fund-specific deep dives; reanalysis loop lets them explore alternative risk tolerances

---

## 4. User Journey

### End-to-End Flow

```
Landing Page
    │
    ▼
[PROFILING phase]
GullakChat widget
    │  User answers 5 core profiling questions conversationally
    │  Quick-reply buttons for structured choices
    │  Agent 1 (Profiler) drives the conversation
    │  Language is detected and stored (English / Urdu)
    │  Optional target amount is extracted if the user mentions one
    │
    ▼  (terminal state detected: "COMPLETE" in response)
[ANALYZING screen]
    │  Animated progress indicator
    │  "This may take 60–90 seconds" message
    │  POST / triggers Analyst + Explainer from stored session phase
    │  Frontend subscribes to progress over WebSocket and falls back to GET /progress
    │
    ▼
[CONVERSING phase — Dashboard]
    │  Top picks (TopPickCard × up to 3 funds)
    │  Remaining funds in FundCard list
    │  RecommendationHero: opening narration + follow-up chat
    │  Sidebar progress tracker (3 steps, persistent)
    │
    ├── User taps metric label → auto-sends field education question
    │       └── EducationPanel slides in (definition / in-context / why-it-matters)
    │
    ├── User taps fund header → auto-sends "tell me more about [fund]"
    │
    ├── User taps narration card → auto-sends elaboration question
    │
    ├── User types follow-up question
    │       └── Agent 3 (Explainer) responds
    │
    └── Agent 3 triggers reanalysis (up to 3×)
            │  Two-step flow: detect change → ask for confirmation → rerun on confirm
            │  Orchestrator re-runs Analyst with updated profile
            ├── Shortlist updates in place
            └── "Shortlist updated" badge appears
```

### Phase State Transitions

| From | To | Trigger |
|---|---|---|
| PROFILING | ANALYZING | Frontend detects terminal profiling state |
| ANALYZING | CONVERSING | Analyst + Explainer complete; response returned |
| CONVERSING | CONVERSING | Follow-up question answered |
| CONVERSING | REANALYZING | User confirms a pending profile change and Explainer calls `request_reanalysis` |
| REANALYZING | CONVERSING | Analyst + Explainer rerun completes |

### Timing

- **Profiling:** Conversational, no hard limit. Typically 4–8 exchanges.
- **Analyzing:** Single Lambda call; 60–90 seconds typical (Bedrock cold-start + 3-agent pipeline).
- **Follow-up:** Single Lambda call; 10–20 seconds typical.
- **Live progress:** During initial analysis, the backend stores up to 40 progress events and pushes snapshots to subscribed clients.

---

## 5. System Architecture

### Overview

```
Browser (React/Vite)
    │  HTTPS POST / GET
    ▼
Lambda Function URL
    │
    ▼
Lambda Handler (Python)
    │
    ├── DynamoDB  ◄──────── session read/write
    │       └── same table also stores WebSocket connection mappings
    │
    ├── Amazon Transcribe Streaming ◄── POST /transcribe
    │
    ├── fund_features.json  ◄── loaded at cold-start (module-level)
    │
    └── Orchestrator
        │
        ├── Agent 1: Profiler  (PROFILING phase)
        │       └── Amazon Bedrock (Claude Haiku)
        │
        ├── Agent 2: Analyst   (ANALYZING phase)
        │       └── Amazon Bedrock (Claude Sonnet)
        │
        ├── Agent 3: Explainer (CONVERSING phase)
        │       └── Amazon Bedrock (Claude Sonnet)
        │
        └── Progress Narrator
            └── Amazon Bedrock (Claude Sonnet)

Browser (React/Vite)
    │  WebSocket subscribeProgress / ping
    ▼
API Gateway WebSocket API
    │
    ▼
Lambda Orchestrator
    │
    └── pushes analysis progress snapshots to subscribed clients
```

### Session State Machine (Implemented)

```
PROFILING → ANALYZING → CONVERSING
            ↘
         REANALYZING
```

- **PROFILING:** Profiler agent collects investor profile over multiple turns
- **ANALYZING:** One-shot call; Analyst scores/ranks funds, Explainer generates opening narration
- **CONVERSING:** Stateful follow-up Q&A; Explainer may trigger re-analysis
- **REANALYZING:** Transient internal phase while the shortlist is being recomputed after user-confirmed profile changes

### Infrastructure Notes

- **Single Lambda, multiple route shapes.** The same Lambda handles the main chat POST flow, `GET /progress`, `/transcribe`, and API Gateway WebSocket route events.
- **Function URL for HTTP.** The request body does not need a `phase`; the orchestrator reads the session from DynamoDB and decides which phase handler to run.
- **API Gateway WebSocket for progress.** Clients subscribe with `subscribeProgress`; the backend stores connection mappings and pushes fresh snapshots after each persisted progress event.
- **DynamoDB.** One table. Partition key: `session_id`. Stores full session state as a JSON attribute.
- **Cold-start optimization.** `fund_features.json` (522 funds, ~2 MB) is read once at module import and held in Lambda memory for the lifetime of the execution environment.
- **Progress trace generation.** Analyst and Explainer progress copy is generated dynamically by a separate Bedrock-powered `progress_narrator` helper instead of hardcoded strings.

---

## 6. Agent Specifications

### Agent 1: Profiler

**Purpose:** Drive a conversational intake flow to produce a complete stored investor profile for the analyst pipeline.

#### State Machine

The Profiler advances through states sequentially based on whichever profile field is still missing:

| State | Question asked |
|---|---|
| `AMOUNT` | Monthly investment amount in PKR |
| `HORIZON` | Time horizon in months / years |
| `RISK` | Risk tolerance (`Low` / `Medium` / `High`) |
| `SHARIAH` | Whether the user wants Shariah-only funds |
| `LIQUIDITY` | Plain-language liquidity needs |
| `SUMMARY` | Internal step used until `goal_summary` is saved |
| `COMPLETE` | Profile finalized; frontend can transition to Analyzing |

#### InvestorProfile Data Model

```python
class InvestorProfile(BaseModel):
    investment_amount_pkr: float
    time_horizon_months: int
    risk_tolerance: str                  # "Low" | "Medium" | "High"
    shariah_compliant_only: bool | None  # True, False, or no preference
    liquidity_needs: str
    target_amount_pkr: float | None      # only if user explicitly mentions a target
    language: str                        # "en" or "ur"
    goal_summary: str | None             # generated from conversation, not asked directly
```

#### Implemented Behaviors

- Detects user language on the first turn and switches the rest of the profiling conversation to English or Urdu.
- Advises unsure users instead of only collecting answers. It can infer a reasonable monthly investment from income and expenses and infer risk tolerance from follow-up questions.
- Extracts a target amount if the user mentions one naturally.
- Writes a short `goal_summary` after liquidity is collected so downstream agents can personalize recommendations without another explicit question.
- Generates validated quick replies before each non-final question.

#### Tools (9)

| Tool | Purpose |
|---|---|
| `generate_clarifying_options` | Return validated quick-reply options for the current question |
| `save_investment_amount` | Record monthly investment amount |
| `save_time_horizon` | Record time horizon in months |
| `save_risk_tolerance` | Record `Low` / `Medium` / `High` |
| `save_shariah_preference` | Record Shariah-only vs no restriction |
| `save_language` | Persist detected English / Urdu language |
| `save_target_amount` | Persist a user-mentioned target corpus |
| `save_liquidity_needs` | Persist free-text liquidity needs |
| `save_goal_summary` | Persist a synthesized 1–2 sentence goal summary |

#### Quick-Reply Button Generation

The `generate_clarifying_options` tool returns a validated `QuickReplySet` for the current state. Labels are capped at 30 characters and the option count must stay between 2 and 4. The prompt explicitly forbids meta-options such as "Other" or "Skip"; every quick reply must be a real answer.

---

### Agent 2: Analyst

**Purpose:** Filter the 522-fund universe, score each fund on a weighted multi-criteria model, and return a ranked shortlist.

#### Scoring System

The internal `fundlens_score` is a weighted average on a 1–10 scale computed from the composite scores already present in `fund_features.json`:

| Component | What it measures |
|---|---|
| `performance_score` | Precomputed return / performance strength |
| `consistency_score` | Return stability across time periods |
| `risk_score` | Downside risk measures (max drawdown, std dev) |
| `cost_score` | Expense ratio relative to category peers |
| `capture_score` | Up/down market capture ratio when available |

#### Weight Presets (9)

One preset is selected per investor based on translated `risk_tolerance` × `time_horizon` (`short`, `medium`, `long`):

| Risk | Horizon | Weights |
|---|---|---|
| low | short / medium / long | performance 0.15, risk 0.35, cost 0.20, consistency 0.20, capture 0.10 |
| medium | short | performance 0.20, risk 0.30, cost 0.20, consistency 0.20, capture 0.10 |
| medium | medium / long | performance 0.25, risk 0.20, cost 0.20, consistency 0.20, capture 0.15 |
| high | short | performance 0.25, risk 0.20, cost 0.20, consistency 0.20, capture 0.15 |
| high | medium | performance 0.30, risk 0.15, cost 0.15, consistency 0.15, capture 0.25 |
| high | long | performance 0.35, risk 0.10, cost 0.15, consistency 0.15, capture 0.25 |

#### Null Handling: capture_score

~70% of funds in `fund_features.json` have `null` for `capture_score` (data not available from MUFAP). The scoring engine handles this by:
1. Computing the weighted sum of the 4 non-null components
2. Re-normalizing weights to sum to 1.0 when `capture_score` is null
3. Never penalizing a fund for missing capture data

#### Tools (5)

| Tool | Purpose |
|---|---|
| `filter_funds` | Apply hard filters on category, Shariah flag, fund type, data availability, and optional score floor |
| `rank_funds` | Rank filtered funds by a single metric |
| `get_fund` | Fetch a complete fund record plus computed `fundlens_score` |
| `compare_funds` | Side-by-side comparison of 2–5 shortlisted funds |
| `get_category_stats` | Median/mean stats for a fund category (for context) |

#### Time Horizon → Category Mapping

| Horizon | Recommended categories |
|---|---|
| short (`<24` months) | Conventional: Money Market, Income, Fixed Rate / Return. Shariah: Shariah Compliant Money Market, Income, Fixed Rate / Return |
| medium (`24–59` months) | Conventional: Asset Allocation, Balanced, Income, Aggressive Fixed Income, Fund of Funds. Shariah equivalents for each |
| long (`60+` months) | Conventional: Equity, Asset Allocation, Fund of Funds, Balanced, Dedicated Equity, Exchange Traded Fund, Index Tracker. Shariah equivalents for each |

Additional analyst rules implemented in code:

1. Only investable fund types are considered by default: `Open-End Funds`, `Dedicated Equity Funds`, and `Exchange Traded Fund (ETF)`.
2. `return_1y` is excluded by default, but the filter auto-relaxes if fewer than 3 funds survive.
3. Shariah preference is a hard filter.
4. Goal-based scenarios use `target_amount_pkr` and `time_horizon_months` to reason about SIP feasibility and aim for exactly 5 shortlist funds.
5. The hardcoded Pakistan T-bill baseline is `0.104` (10.4%) and is included in analyst output as `risk_free_rate`.

#### FundShortlistItem Data Model (30+ fields)

```python
class FundShortlistItem(BaseModel):
    rank: int
    fund_id: str
    fund_name: str
    amc_name: str
    category: str
    shariah_flag: bool

    # Composite scores (1–10)
    fundlens_score: float | None
    performance_score: float | None
    consistency_score: float | None
    risk_score: float | None
    cost_score: float | None
    capture_score: float | None
    scores_used: list[str]
    scores_missing: list[str]

    # Returns (decimals)
    return_ytd: float | None
    return_1y: float | None
    return_3y_ann: float | None

    # Risk metrics
    max_drawdown: float | None
    max_drawdown_recovery_days: int | None
    volatility_monthly: float | None
    sharpe_ratio: float | None
    sortino_ratio: float | None
    beta: float | None
    alpha: float | None

    # Benchmark-relative / capture
    excess_return_1y: float | None
    upside_capture_ratio: float | None
    downside_capture_ratio: float | None

    # Cost
    expense_ratio: float | None      # already stored as percentage points
    expense_vs_category: float | None
    front_end_load: float | None

    # Rolling consistency
    rolling_return_12m_avg: float | None
    rolling_return_12m_stddev: float | None

    selection_reason: str
```

---

### Agent 3: Explainer

**Purpose:** Translate the Analyst's shortlist into conversational narrative, metric education, and confirmed reanalysis requests.

#### 3 Operating Modes

| Mode | Trigger | Output |
|---|---|---|
| **Opening explanation** | First CONVERSING call after ANALYZING | `NarrationItem[]` (max 4 cards) + opening text |
| **Follow-up Q&A** | User asks a question in the follow-up chat or taps a narration/fund card | Conversational answer anchored to shortlist data |
| **Field education** | Request contains `field_context` | `EducationBlock` (3-section structured response) |

#### NarrationItem

```python
class NarrationItem(BaseModel):
    anchor: str    # one of: top_pick, comparison, capture, expense_ratio, goal, risk, expanded_fund
    text: str      # 2–4 sentence plain-language explanation
```

Max 4 items per opening response. Each is rendered as a tappable card; tapping auto-sends an elaboration question.

#### EducationBlock

Returned when `field_context` is present in the request (user tapped a metric label):

```python
class EducationBlock(BaseModel):
    field: str
    definition: str
    in_context: str
    why_it_matters: str
```

#### request_reanalysis Tool

The Explainer has two backend tools available in code:

- `request_reanalysis(updated_fields, acknowledgement)` to trigger a rerun after the user confirms a profile change.
- `get_fund_detail(fund_id)` to pull a shortlisted fund's full record when the user asks about a specific card.

The reanalysis tool is intentionally gated behind a strict confirmation flow:

```python
request_reanalysis(
    updated_fields: dict,
    acknowledgement: str,
)
```

#### Bi-directional Reanalysis Loop

```
User: "What if I had higher risk tolerance?"
        │
        ▼
Explainer: detects profile change and asks for confirmation
    │
    ▼
Explainer output: reanalysis_pending={"risk_tolerance": "High"}
    │
    ▼
User: "Yes, go ahead"
    │
    ▼
Orchestrator injects [PENDING REANALYSIS: ...] into the next Explainer call
    │
    ▼
Explainer: calls request_reanalysis(updated_fields={"risk_tolerance": "High"})
        │
        ▼
Orchestrator: re-runs Analyst with merged profile
        │
        ▼
Explainer: generates new opening narration for updated shortlist
        │
        ▼
Frontend: replaces shortlist cards, shows "Shortlist updated" badge
```

Important implementation notes:

1. Reanalysis is capped at 3 reruns per session.
2. The orchestrator normalizes field names coming back from Agent 3, including casing for `risk_tolerance` and reverse-mapping of `shariah_preference`.
3. Initial analysis emits live progress events; the current reanalysis path reruns synchronously without progress callbacks.

---

## 7. Orchestrator

The orchestrator is the main Lambda entry point. It owns HTTP routing, WebSocket progress routing, DynamoDB session persistence, phase transitions, and all cross-agent handoffs.

### Implemented Request Routing

```python
if route_key and connection_id:
    return handle_websocket_event(event)

if '/transcribe' in path:
    return handle_transcribe(event, context)

if method == 'GET' and '/progress' in path:
    return progress_snapshot(session_id)

if session.phase in ('PROFILING', 'ANALYZING'):
    return handle_profiling(session, message)

if session.phase in ('CONVERSING', 'REANALYZING'):
    return handle_conversing(session, message, card_context, field_context)
```

### translate_profile()

Schema bridge between the Profiler's stored profile and the Analyst's internal schema:

```python
def translate_profile(agent1_profile: dict) -> dict:
    return {
        'monthly_amount': ...,
        'time_horizon': 'short' | 'medium' | 'long',
        'time_horizon_months': ...,
        'risk_tolerance': 'low' | 'medium' | 'high',
        'shariah_preference': 'shariah_only' | 'conventional_only' | 'no_preference',
        'target_amount_pkr': ...,
        'language': 'en' | 'ur',
        'liquidity_needs': ...,
        'goal_summary': ...,
    }
```

### _normalise_updated_fields()

Reverse translation for reanalysis requests. Converts Agent 3 updates back into the stored Agent 1 schema before rerunning analysis:

```python
def _normalise_updated_fields(fields: dict) -> dict:
    # shariah_preference -> shariah_compliant_only
    # drop string time_horizon if Agent 3 sends it
    # capitalise risk_tolerance for stored profile consistency
```

### Progress Tracking

During the initial ANALYZING flow, the orchestrator:

1. Resets `analysis_progress`
2. Appends timestamped events with `id`, `agent`, `message`, `status`, `stage`, `tool`, and `detail`
3. Persists every event to DynamoDB
4. Broadcasts fresh snapshots to subscribed WebSocket clients
5. Caps retained progress history at 40 events per session

### MAX_REANALYSES Guard

```python
MAX_REANALYSES = 3
```

The orchestrator tracks `session.reanalysis_count`. If the limit is reached, it returns a final conversational response instructing the user to start a new session for a fresh analysis.

### WebSocket Routes

Implemented API Gateway WebSocket routes:

- `$connect` → accept connection
- `$disconnect` → clean up stored subscriber mapping
- `subscribeProgress` → attach a connection to a `session_id` and immediately push a snapshot
- `ping` → reply with `{ "type": "pong" }`

### DynamoDB Schema

| Attribute | Type | Description |
|---|---|---|
| `session_id` | String (PK) | Session UUID; also reused as `ws#<connectionId>` for connection mapping items |
| `phase` | String | `PROFILING` \| `ANALYZING` \| `CONVERSING` \| `REANALYZING` |
| `investor_profile` | String | JSON-serialized Agent 1 profile |
| `current_shortlist` | String | JSON-serialized analyst shortlist payload |
| `agent1_messages_json` | String | Serialized Profiler message history |
| `agent3_messages_json` | String | Serialized Explainer message history |
| `reanalysis_count` | Number | 0–3 |
| `pending_reanalysis_fields` | String | JSON blob of the next confirmed profile change request |
| `analysis_progress` | String | JSON array of the most recent progress events |
| `progress_subscribers` | String | JSON array of subscribed WebSocket connection IDs |
| `progress_socket_endpoint` | String | WebSocket management endpoint URL |
| `subscribed_session_id` | String | Present only on `ws#<connectionId>` mapping items |
| `item_type` | String | Present only on connection mapping items (`ws_connection`) |

The current code does not persist explicit `created_at`, `updated_at`, or TTL fields.

---

## 8. API Reference

### HTTP Endpoints

```
POST /           # profiling, initial analysis handoff, and follow-up chat
GET /progress    # polling fallback for analysis progress
POST /transcribe # PCM speech-to-text
```

The main POST endpoint is phase-aware based on stored session state. The request body does not need to send a `phase` field.

---

### PROFILING — Request

```json
{
    "session_id": "uuid-v4",
    "message": "I want to invest Rs 10,000 per month"
}
```

### PROFILING — Response

```json
{
    "session_id": "uuid-v4",
    "phase": "PROFILING",
    "state": "HORIZON",
    "reply": "Great. How long can you leave this money invested?",
    "options": {
        "state": "HORIZON",
        "options": [
            { "label": "Less than 1 year", "value": "less than 1 year" },
            { "label": "2 to 5 years", "value": "2 to 5 years" },
            { "label": "5+ years", "value": "5 years or more" }
        ]
    },
    "is_complete": false
}
```

When profiling is complete, `handle_profiling()` immediately runs Analyst + Explainer, so the next response is already the post-analysis `CONVERSING` payload.

---

### Initial Analysis — Response Shape

```json
{
    "session_id": "uuid-v4",
    "phase": "CONVERSING",
    "reply": "Based on your goal, here are the funds I’d start with...",
    "narration": [
        { "anchor": "top_pick", "text": "..." },
        { "anchor": "comparison", "text": "..." }
    ],
    "education": null,
    "shortlist": [ /* FundShortlistItem[] — see §10 */ ],
    "investor_profile": {
        "monthly_amount": 10000,
        "time_horizon": "long",
        "time_horizon_months": 60,
        "risk_tolerance": "medium",
        "shariah_preference": "no_preference",
        "language": "en",
        "goal_summary": "Saving for a long-term family goal."
    },
    "options": null,
    "is_complete": true,
    "reanalyzed": false
}
```

---

### CONVERSING — Standard Follow-up Request

```json
{
    "session_id": "uuid-v4",
    "message": "Why is the expense ratio important?"
}
```

Optional fields:

```json
{
    "card_context": {
        "fund_id": "MCB-STF-001",
        "fund_name": "MCB Pakistan Stock Market Fund"
    },
    "field_context": {
        "field": "expense_ratio",
        "value": 2.89,
        "fund_id": "MCB-STF-001"
    }
}
```

- `card_context`: Set when the user's question originates from a fund card tap. Gives the Explainer scope to answer specifically about that fund.
- `field_context`: Set when the user tapped a metric label. Triggers `EducationBlock` response mode.

### CONVERSING — Standard Follow-up Response

```json
{
    "session_id": "uuid-v4",
    "phase": "CONVERSING",
    "reply": "The expense ratio is the annual fee charged by the AMC...",
    "narration": [],
    "education": null,
    "reanalysis_pending": null,
    "reanalyzed": false
}
```

### CONVERSING — Reanalysis Response

When `request_reanalysis` was triggered:

```json
{
    "session_id": "uuid-v4",
    "phase": "CONVERSING",
    "acknowledgement": "Perfect — updating to higher risk and rerunning the analysis now.",
    "reply": "I've updated your shortlist with higher-risk options...",
    "narration": [ /* new NarrationItem[] */ ],
    "education": null,
    "shortlist": [ /* updated FundShortlistItem[] */ ],
    "investor_profile": { /* translated profile */ },
    "reanalysis_pending": null,
    "reanalyzed": true
}
```

If the Explainer has only detected a change but the user has not confirmed yet, the response remains in `CONVERSING` with `reanalysis_pending` populated and no shortlist update.

### CONVERSING — Education Block Response

When `field_context` was provided:

```json
{
    "session_id": "uuid-v4",
    "phase": "CONVERSING",
    "reply": "Here's what expense ratio means for you:",
    "education": {
        "field": "expense_ratio",
        "definition": "The annual cost of running the fund, expressed as a % of AUM.",
        "in_context": "Your top pick has an expense ratio of 1.95%, which is below the equity category median of 2.3%.",
        "why_it_matters": "A 1% difference in expense ratio compounds significantly over 5 years — it directly reduces your net return."
    },
    "reanalysis_pending": null,
    "reanalyzed": false
}
```

### GET /progress

Polling fallback for clients that cannot keep a WebSocket subscription alive.

Request:

```http
GET /progress?session_id=uuid-v4
```

Response:

```json
{
    "session_id": "uuid-v4",
    "phase": "ANALYZING",
    "progress": [
        {
            "id": "uuid-v4",
            "agent": "Analyst",
            "message": "I'm filtering the live fund universe now.",
            "status": "running",
            "stage": "filtering",
            "tool": "filter_funds",
            "detail": "I'm narrowing the eligible categories before ranking.",
            "timestamp": "2026-03-13T12:34:56.000000+00:00"
        }
    ],
    "is_complete": false
}
```

### POST /transcribe

Speech-to-text endpoint for base64-encoded 16 kHz PCM audio.

Request:

```json
{
    "audio": "<base64-pcm>",
    "language": "en"
}
```

Response:

```json
{
    "transcript": "I want to invest ten thousand rupees every month"
}
```

Supported language inputs are `en`, `ur`, `en-US`, and `ur-PK`.

### WebSocket Events

Clients can subscribe to live progress updates via API Gateway WebSocket:

1. Send route `subscribeProgress` with `{ "session_id": "uuid-v4" }`
2. Receive `analysis_progress` payloads shaped like the `GET /progress` response
3. Send `ping` to receive `{ "type": "pong" }`

---

## 9. Frontend

Built with **React + Vite**. No UI component library; all components are custom. Markdown rendered via `ReactMarkdown`.

### Screens

#### Screen 1: Landing / Home

The default view. Contains:
- Gullak branding (logo, tagline)
- `GullakChat` widget (chat interface for profiling)
- `Sidebar` (progress tracker, 3 steps, initially all incomplete)

The page does not navigate away during profiling — the chat widget handles all profiling turns in place.

#### Screen 2: Analyzing

Triggered when GullakChat detects that profiling has completed and the app transitions into the analysis flow.

- Animated progress indicator (CSS keyframes)
- Text: "Analyzing 522 funds for your profile..."
- Sub-text: "This may take 60–90 seconds"
- Subscribes to live progress, then navigates to Dashboard when the `CONVERSING` payload is returned

#### Screen 3: Dashboard

The main post-analysis view:
- `Sidebar` with all 3 steps completed
- `RecommendationHero` (opening narration, `FollowUpChat`)
- `TopPickCard` × up to 3 (top-ranked funds)
- `FundCard` list (remaining shortlisted funds)
- `InvestmentCalculator` (SIP projector, pre-filled)

---

### Key Components

#### GullakChat

Manages the profiling conversation.

- Renders chat bubbles for user and assistant messages
- Renders quick-reply chips from the `options.options` array; chips auto-submit on tap and disappear after selection
- Detects terminal state from the profiling response and transitions the parent to the Analyzing screen
- Preserves the `session_id` so the backend can resume the correct phase on the next POST

#### Sidebar

Persistent left-side progress tracker. Three steps:

1. "Tell us about yourself" (profiling)
2. "Analyzing your profile" (analyzing)
3. "Your recommendations" (conversing)

Each step has an icon, label, and completion state. The sidebar is always visible on desktop; collapsed on mobile.

#### TopPickCard

Renders the top 1–3 funds with visual emphasis (larger card, score badge, highlighted metrics). Receives a flat `FundShortlistItem` object.

- Decimal-to-percentage conversion: fields like `return_1y` (0.142) are multiplied by 100 and displayed as "14.2%"
- Tappable metric labels: clicking a metric label auto-sends a field education question with `field_context` populated
- Tappable fund header: clicking the fund name auto-sends a "tell me more" question with `card_context` populated

#### FundCard

Same data model as TopPickCard but compact layout. Used for funds ranked 4th and below.

#### RecommendationHero

The primary narrative area at the top of the Dashboard.

- Displays the opening `reply` (Markdown-rendered)
- Renders `NarrationItem[]` as tappable cards in a horizontal scroll row
- Tapping a narration card auto-sends an elaboration question
- Contains `FollowUpChat` (collapsible)

#### FollowUpChat

The follow-up Q&A interface embedded inside RecommendationHero.

- Auto-sends the opening elaboration message on Dashboard mount (to prompt user engagement)
- Collapsible: click the toggle button to expand/collapse
- Click-outside dismiss: clicking anywhere outside the panel collapses it
- Renders all follow-up turns as chat bubbles with Markdown support
- Handles reanalysis responses: updates shortlist cards in place and shows "Shortlist updated" badge
- Handles education block responses: opens `EducationPanel` overlay

#### EducationPanel

Slides in as an overlay when a metric education response is received.

Three sections rendered sequentially:
1. **Definition** — plain-language explanation of the metric
2. **In your context** — how this metric looks for the user's specific shortlist
3. **Why it matters** — actionable implication for the investor

Dismissible via close button or click-outside.

#### InvestmentCalculator

SIP (Systematic Investment Plan) projected returns calculator.

- **Inputs:** monthly investment amount, expected annual return %, time horizon (years)
- **Pre-filled from:** the translated `investor_profile` returned by the backend; expected return defaults to the weighted average return of the top pick
- **Formula:** Standard SIP future value: `FV = P × [((1 + r)^n - 1) / r] × (1 + r)` where `P` = monthly investment, `r` = monthly rate, `n` = number of months
- **Outputs:** Total invested, estimated corpus, total gain, CAGR

#### Markdown

Thin wrapper around `ReactMarkdown` with custom renderers for consistent typography. Used in all agent text output fields: opening `reply`, follow-up `reply`, narration card `text`, and education block sections.

---

### UX Interactions Summary

| User action | What happens |
|---|---|
| Tap quick-reply chip | Chip disappears; value auto-submitted as user message |
| Tap metric label (e.g. "Expense Ratio") | Field education question auto-sent; `field_context` set; EducationPanel opens on response |
| Tap fund name / header | "Tell me more about [fund name]" auto-sent; `card_context` set |
| Tap narration card | Elaboration question auto-sent |
| Type in follow-up chat | Standard follow-up sent |
| Reanalysis triggered by agent | Shortlist cards update; "Shortlist updated" badge flashes |
| Analysis in progress | Frontend prefers WebSocket progress updates and falls back to `GET /progress` |

---

## 10. Data Model

### fund_features.json

- **Location:** Bundled with Lambda deployment package
- **Loaded:** Once at module import (cold-start); held in Lambda execution environment memory
- **Size:** ~2 MB; 522 fund records

### Key Fields and Conventions

All return and rate fields in `fund_features.json` are stored as **decimals** (e.g., `0.142` = 14.2%). The frontend multiplies by 100 before display. The scoring engine uses raw decimal values throughout.

| Field | Type | Convention | Notes |
|---|---|---|---|
| `fund_id` | string | — | Unique identifier |
| `fund_name` | string | — | Full AMC-registered name |
| `amc_name` | string | — | Asset management company |
| `category` | string | — | MUFAP category |
| `shariah_flag` | bool | — | Hard filter field |
| `return_1y` | float \| null | decimal | Null if fund < 1 year old |
| `return_3y_ann` | float \| null | decimal | Annualized 3Y return |
| `return_ytd` | float \| null | decimal | Year-to-date return |
| `expense_ratio` | float \| null | percentage points | Already display-ready, unlike return fields |
| `expense_vs_category` | float \| null | percentage points | Negative means cheaper than category average |
| `max_drawdown` | float \| null | decimal | Negative value (e.g. -0.18 = -18%) |
| `upside_capture_ratio` | float \| null | percentage | 115 means 115% upside capture |
| `downside_capture_ratio` | float \| null | percentage | 78 means 78% downside capture |
| `performance_score` | float \| null | 1–10 | Precomputed composite score |
| `risk_score` | float \| null | 1–10 | Precomputed composite score |
| `cost_score` | float \| null | 1–10 | Precomputed composite score |
| `consistency_score` | float \| null | 1–10 | Precomputed composite score |
| `capture_score` | float \| null | 1–10 | Null for many funds |

---

## 11. Implemented Features Checklist

### Core AI Features
- [x] Conversational investor profiling with stateful multi-turn persistence
- [x] Quick-reply button generation and rendering
- [x] English / Urdu language detection and response switching
- [x] Goal-summary synthesis from conversation history
- [x] Optional target corpus extraction for goal-based analysis
- [x] Shariah / conventional hard filter
- [x] Weighted multi-criteria scoring engine (5 components, 9 presets)
- [x] Fund shortlist (top N from 522 funds)
- [x] Opening narrative with anchored narration cards
- [x] Two-step reanalysis confirmation flow (up to 3 reruns)
- [x] Field education on metric tap (3-section EducationBlock)
- [x] Fund-specific follow-up Q&A
- [x] Dynamic live progress narration generated from backend events

### Frontend Features
- [x] Profiling chat with quick-reply chips
- [x] Analyzing screen with animation and timing message
- [x] Dashboard with top picks + fund list
- [x] Persistent sidebar progress tracker (3 steps)
- [x] Tappable metrics → education panel
- [x] Tappable fund headers → follow-up Q&A
- [x] Tappable narration cards → elaboration
- [x] Collapsible follow-up chat
- [x] Click-outside dismiss for follow-up panel
- [x] "Shortlist updated" reanalysis badge
- [x] SIP Investment Calculator (pre-filled from profile)
- [x] Decimal-to-percentage conversion on all rate fields

### Infrastructure
- [x] Single Lambda function deployment
- [x] Lambda Function URL for main HTTP flow
- [x] API Gateway WebSocket progress subscriptions
- [x] `GET /progress` polling fallback
- [x] DynamoDB session storage
- [x] Amazon Transcribe streaming endpoint
- [x] fund_features.json cold-start loading
- [x] Progress event persistence and broadcast
- [x] MAX_REANALYSES = 3 guard

---

## 12. Known Limitations / Out of Scope

### Not Yet Built

| Feature | Notes |
|---|---|
| Agent 4: Portfolio Monitor | Would track existing holdings and send rebalancing alerts. Not in MVP scope. |
| User authentication | No accounts, no login. Session is anonymous, identified by UUID in localStorage. |
| Live MUFAP data sync | `fund_features.json` is static. Updated manually. No automated pipeline from MUFAP. |

### Technical Limitations

| Limitation | Impact | Notes |
|---|---|---|
| No token streaming of main agent replies | Users still wait for complete Analyst/Explainer responses | The backend streams progress snapshots, not partial LLM text |
| Reanalysis path has no live progress callbacks | Users see a refresh only after the rerun completes | Initial analysis emits progress events; confirmed reanalysis currently does not |
| Top 10 holdings not shown | Dashboard cannot show portfolio composition per fund | Holdings data not available in current MUFAP-derived dataset |
| ~70% null capture scores | Capture score excluded for most funds | Handled by weight re-normalization; not a blocking issue but reduces scoring completeness |
| No fund comparison UI | Backend `compare_funds` tool exists but no dedicated comparison view in frontend | Users can ask the Explainer to compare funds via text |
| No benchmark charting | Performance vs benchmark is a text field, not a chart | Historical NAV time series not in dataset |
| Single region | Lambda deployed in one AWS region | No latency optimization for users outside that region |
| No TTL / lifecycle cleanup in current session schema | Session records can accumulate unless managed externally | The code does not write TTL attributes to DynamoDB today |

### Design Decisions (Intentional Constraints)

- **No portfolio allocation advice.** Gullak recommends funds, not allocation percentages. This avoids regulated advisory territory.
- **Small shortlist.** Analyst returns 3–5 funds, and goal-based scenarios aim for exactly 5. Showing 522 unranked funds would defeat the purpose.
- **Static scoring weights.** Weights are preset by risk/horizon combination, not user-tunable. Keeps the UX simple for retail investors.
