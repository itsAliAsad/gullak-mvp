# Gullak: Your Clay Pot Grew Up. Your Investments Should Too.

**Team Name:** MarketByte  
**Team Members:** Muhammad Ali Asad and Arsalan Ashaar Hashmi

## 1. The Problem

Pakistan's mutual fund industry is large, regulated, and growing fast. As of January 2026, it stood at **Rs 4.48 trillion in Assets Under Management**, after roughly **7x growth in six years**.[^1] The market spans **522 mutual funds** across **24 Asset Management Companies**.[^2] Yet only **768,769 individual investors** are participating in that market.[^3]

That gap is the problem.

If you are an ordinary investor, there is almost nowhere to go from “I have Rs 20,000 a month to invest” to a personalized, mathematically scored answer you can trust.

1. **Scale without accessibility.** The products exist, but the market is difficult to navigate.
2. **Jargon without translation.** Terms like expense ratio, drawdown, beta, and capture ratio are not self-explanatory.
3. **No personalized recommendation engine.** Most available information is descriptive, not advisory.

1. **The savings account.** Money sits idle and under-deployed.
2. **The friend's tip.** Decisions get outsourced to hearsay.
3. **The bank RM.** Advice comes from an incentive structure that does not necessarily align with the investor.

We built Gullak to fix this.

## 2. What Is Gullak?

**Gullak** (گُلَّک) is the clay piggy bank found in Pakistani households. It is simple, familiar, and usually the first financial object you interact with as a child.

> آپ کا گُلَّک بڑا ہو گیا۔ آپ کی سرمایہ کاری بھی بڑی ہونی چاہیے۔  
> Your gullak grew up. Your investments should too.

Gullak is an AI-powered mutual fund advisor for Pakistani retail investors. It takes you through a conversational profiling flow, scores a universe of **522 Pakistani mutual funds**, shortlists the most suitable options for your risk and time horizon, and explains the results in plain language through an interactive dashboard.

The flow is direct. You answer a handful of questions. Gullak turns that into a structured investor profile. A deterministic scoring engine ranks the fund universe. An explainer layer then tells you what the shortlist means, why the top picks surfaced, and what each metric says about your options.

## 3. Where This Started

A gullak is where saving begins. It is not where investing becomes understandable.

That gap became clear to us through a specific moment. Ali Asad, an Economics and Mathematics major at LUMS, was studying how mutual funds are evaluated through Zero1 by Zerodha's video "How to select the BEST Mutual Fund."[^4] The framework was solid: rolling returns, Sharpe ratio, standard deviation, beta, capture ratios, AUM, and expense ratio. The problem was not the existence of the framework. The problem was that, in Pakistan, there was no product that applied this logic to the local fund universe and turned it into an actual decision.

Education existed. Execution did not.

Ali brought that gap to me, Arsalan. My background is in software and engineering, which meant I saw the second half of the problem immediately. Even if the product idea was clear, the underlying data did not exist in a usable form. There was no single public dataset for Pakistani mutual funds that could support ranking, explanation, and comparison.

We did not approach this as a throwaway hackathon prototype. We approached it as the first version of a real product. We interviewed twenty peers without formal finance backgrounds. The pattern repeated: people had heard of mutual funds, but did not know where to start, how to compare options, or what the standard metrics meant in practice.

That is the bridge we decided to build.

## 4. The Dataset That Did Not Exist

Before there could be AI, there had to be data.

No clean, structured, public dataset existed for Pakistani mutual funds in a form that could support ranking logic. The information was fragmented across MUFAP pages, a fund-detail API, PSX benchmark feeds, and a separately maintained risk-free-rate input. So we built a deterministic pipeline to assemble it ourselves.

1. MUFAP fund directory for the master registry of funds.
2. MUFAP NAV history for daily price data.
3. MUFAP expense-ratio tables for cost data.
4. MUFAP fund-detail API for official trailing returns.
5. PSX benchmark feeds for KSE-100, KSE-30, and KMI-30 index history.
6. SBP T-bill rate input for the local risk-free-rate baseline.
7. Feature computation into a single canonical output: `fund_features.json`.

The result is a dataset covering **522 funds**, **301,749 daily NAV rows**, and **3,711 benchmark rows**, with more than **30 fund-level features** available for downstream ranking and explanation.[^2]

1. **Identity.** Fund name, AMC, category, Shariah status, and benchmark mapping.
2. **Returns.** MUFAP official return periods, including YTD and trailing windows.
3. **Risk.** Volatility, downside deviation, drawdown, and recovery characteristics derived from NAV history.
4. **Risk-adjusted metrics.** Sharpe, Sortino, alpha, beta, and capture measures.
5. **Cost.** Expense ratio, load structure, and category-relative cost context.
6. **Composite scores.** Performance, risk, cost, consistency, and capture scores that feed the final shortlist logic.

Fund identities are checked against the master directory. Exact duplicates are deduplicated only when they match perfectly. Conflicting duplicates raise errors instead of being merged silently. The returns stage supports resume mode because it makes **522 fund-by-fund API calls** and has to tolerate partial failure without corrupting the output.

The hardest part of the project was not calling a model. It was building the dataset that the model could speak truthfully about.

## 5. How Gullak Works

Gullak runs as a three-agent system behind a single AWS Lambda function.

The frontend is built in **React + Vite** with custom components. The backend is a single **AWS Lambda** exposed through a **Lambda Function URL**. Session state lives in **DynamoDB**. The fund dataset is bundled as `fund_features.json` and loaded once at cold start.

1. **Profiler.** Collects investor inputs through a structured conversational flow.
2. **Analyst.** Filters and ranks funds using deterministic scoring logic.
3. **Explainer.** Turns the shortlist into narration, follow-up answers, and metric education.

The key design decision sits in the middle:

> The LLM explains. It does not decide.

The Analyst is not a free-form model deciding what sounds right. It uses a weighted scoring engine with **five scoring components** and **nine weight presets** derived from risk tolerance and time horizon. Those components are return score, consistency score, risk score, cost score, and capture score. The result is reproducible. The same profile and the same dataset produce the same shortlist.

The Profiler turns natural-language interaction into a structured `InvestorProfile`. It walks through amount, time horizon, risk tolerance, Shariah preference, category preference, and liquidity needs. Quick-reply buttons keep the interaction moving and reduce drop-off.

The Explainer produces the opening explanation, answers follow-up questions, and supports field-level education. If you tap a metric like expense ratio or Sharpe ratio, Gullak returns a structured explanation with three parts: what the metric means, what it looks like in your shortlist, and why it matters for the decision in front of you.

The system also supports reanalysis. If your preferences change mid-conversation, the Explainer can request a rerun with updated profile fields. The shortlist updates in place. That loop is capped at three reanalyses to keep the session bounded.

## 6. Pakistan-Specific by Design

Gullak is not a generic mutual fund app with PKR labels.

First, **Shariah compliance is a hard filter**. If a user wants Shariah-compliant funds only, conventional funds are excluded outright. That is not treated as a soft preference slider.

Second, **the benchmark logic is local**. Conventional equity-bearing categories map to **KSE-100**. Shariah equity-bearing categories map to **KMI-30**. Non-equity categories do not get benchmark-relative metrics forced onto them when no benchmark applies.

Third, **the risk-free rate is local**. Sharpe ratio, Sortino ratio, and alpha are anchored to the SBP T-bill baseline used in the pipeline, not to a US Treasury assumption imported from another market.

Fourth, **the product explains metrics in context**. The education layer does not define Sharpe ratio in isolation and stop there. It tells you what it means for the specific fund you are looking at, in the category you are actually considering.

Those choices matter because Pakistani investors are not dealing with an abstract market. They are dealing with this market, its categories, its benchmarks, its constraints, and its priorities.

## 7. Why the Scoring Engine Matters

Many AI finance products collapse into one of two mistakes. They either return a generic list with no reasoning, or they let the model improvise judgments it should not be making.

We took the opposite route.

The scoring engine is explicit. It combines return, risk, cost, consistency, and capture into a final `fundlens_score`. The weight preset changes with the investor's profile. A conservative investor and an aggressive investor should not get the same ranking logic, and Gullak does not pretend otherwise.

There is also a practical reality in the Pakistani dataset: around **70% of funds have null capture scores** because the source data does not support full capture computation across the board. We do not punish those funds for a missing field. When capture is unavailable, the engine re-normalizes the remaining component weights instead of subtracting points for missing data.

That is a small implementation detail, but it reflects the broader design principle behind the product: missing data should be handled deliberately, not buried.

## 8. The User Experience

The product flow has three phases.

1. **Profiling.** The user answers a short conversational intake.
2. **Analyzing.** Gullak processes the profile and ranks the fund universe.
3. **Conversing.** The user receives recommendations, explanations, and the ability to ask follow-up questions.

On the dashboard, the shortlist is split into top picks and supporting options. The top-ranked funds surface with score badges and key metrics. The explanation layer adds narrative cards so the shortlist is not just a wall of numbers. The follow-up chat stays live so the product can answer why one fund outranks another, what a metric means, or what changes if the user's risk tolerance changes.

The design choice here is practical. Financial literacy does not improve because a user saw a metric. It improves when the metric is tied to a concrete decision.

## 9. Why This Matters

The gap in Pakistan is not that financial products do not exist. The gap is that most people do not have a usable interface to them.

It takes a sentence like, “I can invest Rs 15,000 a month,” and turns it into a ranked shortlist with reasons. It does not ask the user to understand fund categories first, build a spreadsheet first, or learn every metric first. It lets them move from intent to action without pretending that finance has to remain obscure in order to be serious.

That is the difference between financial information and financial access.

## 10. What Next

The MVP is complete, but the roadmap is clear.

1. **Automated refresh.** Move the data pipeline to scheduled refreshes instead of manual regeneration.
2. **Response streaming.** Reduce the waiting time during the analyzing phase.
3. **Portfolio monitoring.** Add a fourth agent for proactive alerts and fund-change monitoring.
4. **Persistent user state.** Move beyond anonymous sessions into durable profiles.

## 11. Team

We are MarketByte, building from Lahore, Pakistan.

Gullak started with a straightforward observation: the clay pot grew up, but the tools around it did not. We built the product we wanted to exist for this market.

## Footnotes

[^1]: Securities and Exchange Commission of Pakistan. "Pakistan's Non-Bank Financial Sector Records Strong Growth in H2 2025." SECP, 25 Feb. 2026, https://www.secp.gov.pk/wp-content/uploads/2026/02/Press-Release-Feb-25-Pakistans-Non-Bank-Financial-Sector-Records-Strong-Growth-in-H2-2025.pdf.

[^2]: Mutual Funds Association of Pakistan. "Industry Statistics: Month-end AUMs January 2026." MUFAP, Jan. 2026, https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=1.

[^3]: Central Depository Company of Pakistan. "Information Facts: Operational Statistics as of February 2026." CDC Pakistan, 2026, https://www.cdcpakistan.com/about-us/statistics/.

[^4]: Zero1 by Zerodha. "How to select the BEST Mutual Fund." YouTube, 4 June 2024, https://www.youtube.com/watch?v=7c4ZJ-ljRMw.
