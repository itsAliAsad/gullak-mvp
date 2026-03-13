<div align="center">
  <h1>💰 Gullak (گُلَّک)</h1>
  <p><b>An AI mutual fund advisor that explains every recommendation like a human analyst would.</b></p>
  <p><i>Built for the AWS AI Hackathon — March 2026 — Team MarketByte</i></p>
</div>

<br />

Pakistan’s mutual fund industry presents compounding barriers for retail investors: 312+ funds, jargon-heavy metrics (expense ratios, drawdowns, alpha), and a lack of personalized recommendations. 

**Gullak** (Urdu for *piggy bank*) takes the guesswork out of investing. It guides users through a conversational profiling flow, scores and shortlists from a pre-computed universe of 522 funds, and delivers plain-language explanations through an interactive dashboard.

---

## ✨ Features

- **Conversational Profiling** 💬: Stops showing forms. The **Profiler Agent** natively speaks English and Urdu, intelligently extracting investment amounts, time horizons, risk tolerances, and liquidity needs over a natural conversation. 
- **Deterministic AI Scoring** 📊: The **Analyst Agent** filters and ranks funds dynamically based on user constraints (like strict Shariah compliance) using a weighted 1–10 scale across performance, consistency, risk, cost, and capture score.
- **Explainable by Design** 🧠: The **Explainer Agent** turns the shortlist into plain-language narratives. Tap on "expense ratio" or "Sharpe ratio" to see what it means and why it matters specifically for your goal.
- **Dynamic Reanalysis Loop** 🔄: "What if I took more risk?" Gullak recalculates the shortlist and reruns the analysis pipeline instantly.
- **Live Progress Narration** ⚡: Subscribes to real-time LLM reasoning over WebSockets so you never stare at a blank spinner while agents think.
- **Voice-to-Text Support** 🎙️: Integrated Amazon Transcribe Streaming for a frictionless mobile-first experience.

---

## 🏗️ Multi-Agent Architecture

Gullak relies on a **3+1 Agent Architecture** powered by **Amazon Bedrock**, orchestrated by a single AWS Lambda function:

1. **Agent 1: Profiler (Claude Haiku 4.5)** — Drives conversational intake to build the `InvestorProfile` state machine.
2. **Agent 2: Analyst (Claude Sonnet 4.5)** — Takes the profile, applies hard filters (e.g., Shariah flags, fund categories), and scores the 522-fund dataset to produce a ranked shortlist.
3. **Agent 3: Explainer (Claude Sonnet 4.5)** — Generates narrative explanations, metric education blocks, and manages confirmation-gated reanalysis requests.
4. **Agent 4: Progress Narrator (Claude Sonnet 4.5)** — A helper agent that produces live trace copy of what the Analyst and Explainer are doing to stream to the frontend via WebSockets.

---

## ☁️ The AWS Tech Stack

- **AWS Lambda**: A single Function URL entry point routes the main POST chat flow, `GET /progress` polling, `POST /transcribe`, and API Gateway WebSocket events.
- **Amazon Bedrock**: Powers the intelligence layer with Claude 3.5 Haiku (speed/profiling) and Claude 3.5 Sonnet (reasoning/analysis).
- **Amazon DynamoDB**: Stores transient session states, investor profiles, chat histories, Reanalysis counters, and WebSocket subscriber connections in a single unified table.
- **API Gateway WebSockets**: Streams real-time progress traces safely to connected clients.
- **Amazon Transcribe Streaming**: PCM speech-to-text processing for voice queries.
- **Frontend**: React + Vite, hosted statically.

---

## 🗄️ The Data Backbone: FundLens Pipeline

The LLMs are only as good as their data. Instead of letting agents hallucinate facts, Gullak computes its recommendations against `fund_features.json`—a deterministic, 2 MB intelligence layer loaded entirely into Lambda memory at cold-start.

The offline **FundLens** data ingestion pipeline runs scheduled Python scrapers to consolidate:
1. MUFAP **Master Fund Registry** (Categories, AMCs, Shariah flags)
2. Daily **NAV History** & **Expense Ratios**
3. Official **Trailing Returns**
4. PSX **Benchmark History** (KSE100, KMI30)
5. SBP **Risk-Free Rates**

The pipeline standardizes missing data, maps benchmarks predictably, computes rolling volatility, excess returns, maximum drawdowns, and Sharpe/Sortino ratios. Everything presented by the LLM is fully auditable back to these normalized sources.

---

## 🚀 Running the Project

*(Instructions assume deployment via AWS SAM / CDK and a local Node.js environment).*

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend (Lambda locally)
Ensure you have the AWS CLI configured with sufficient Bedrock, DynamoDB, and Transcribe permissions.
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
# Run your local serverless emulator or deploy
```

### Data Pipeline (Scraping)
To regenerate the `fund_features.json` base:
```bash
cd gullak_scraping
pip install -r requirements.txt

# Run the ingestion stages in sequence
python scrape_fund_directory.py
python scrape_nav_daily.py
python scrape_expense_ratios.py
python scrape_fund_returns.py --resume
python scrape_benchmark_daily.py
python resolve_benchmark_names.py
python compute_fund_features.py
```

---

## 🔮 What's Next?

The MVP proves the core loop: profile -> analyze -> explain. Moving forward, the roadmap includes:
- **Persistent Users**: Authenticated profiles to remember portfolios over multple sessions.
- **Portfolio Watch Agent**: Transitioning from a one-off recommendation tool to an active monitor that watches your holdings, explains drawdowns, and flags benchmark drifts.
- **EventBridge Orchestration**: Automating the entire FundLens data scraping pipeline with robust scheduling infrastructure.

---
<div align="center">
  <p><i>Built for Pakistani Retail Investors. Designed to show its work.</i></p>
</div>
