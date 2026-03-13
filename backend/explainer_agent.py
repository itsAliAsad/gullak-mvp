import json
from typing import Optional, List, Callable
from dataclasses import dataclass, field

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from progress_narrator import narrate_progress


# ---------------------------------------------------------------------------
# 1. PYDANTIC MODELS
# ---------------------------------------------------------------------------

class NarrationItem(BaseModel):
    anchor: str = Field(
        description=(
            "Which part of the dashboard this paragraph is anchored to. "
            "Use: 'top_pick', 'comparison', 'capture', 'expense_ratio', "
            "'goal', 'risk', 'expanded_fund'."
        )
    )
    text: str = Field(description="2-4 plain-language sentences explaining what the user sees.")


class EducationBlock(BaseModel):
    field:          str = Field(description="The metric field name the user tapped.")
    definition:     str = Field(description="Plain-language definition in 1-2 sentences, zero jargon.")
    in_context:     str = Field(description="What the specific value means for the fund the user is looking at.")
    why_it_matters: str = Field(description="Why this metric matters for the user's specific goal.")


class ExplainerOutput(BaseModel):
    reply:     str = Field(description="The main conversational response shown in the chat zone.")
    narration: List[NarrationItem] = Field(
        description="Short paragraphs anchored to dashboard sections. Max 4 items.",
        max_length=4,
        default_factory=list,
    )
    education: Optional[EducationBlock] = Field(
        default=None,
        description="Populated only when the user tapped a metric label to learn what it means.",
    )
    reanalysis_pending: Optional[dict] = Field(
        default=None,
        description=(
            "Set ONLY when you have detected a profile change and are asking the user for "
            "confirmation before rerunning analysis. Contains the exact updated_fields dict "
            "you plan to pass to request_reanalysis once confirmed. "
            "Example: {\"risk_tolerance\": \"High\"} "
            "Must be null in all other cases — including after the user confirms and you call "
            "request_reanalysis, and during normal Q&A."
        ),
    )


# ---------------------------------------------------------------------------
# 2. DEPENDENCIES
# ---------------------------------------------------------------------------

@dataclass
class ExplainerDeps:
    shortlist:        dict
    investor_profile: dict
    progress_callback: Optional[Callable[[str, str, str, str, Optional[str], Optional[str]], None]] = None
    # Reanalysis state — set by request_reanalysis tool, read by orchestrator
    reanalysis_requested: bool = False
    updated_fields:   dict     = field(default_factory=dict)
    acknowledgement:  str      = ""


def _emit_progress(
    ctx: RunContext[ExplainerDeps],
    status: str = "running",
    stage: str = "narration",
    tool: Optional[str] = None,
    context: Optional[dict] = None,
) -> None:
    callback = ctx.deps.progress_callback
    if callback:
        funds = ctx.deps.shortlist.get("shortlist", [])
        progress_context = {
            "risk_tolerance": ctx.deps.investor_profile.get("risk_tolerance"),
            "time_horizon": ctx.deps.investor_profile.get("time_horizon"),
            "goal_summary": ctx.deps.investor_profile.get("goal_summary"),
            "shortlist_count": len(funds),
            "top_fund": funds[0].get("fund_name") if funds else None,
            **(context or {}),
        }
        narration = narrate_progress("Explainer", stage, tool, status, progress_context)
        callback("Explainer", narration["message"], status, stage, tool, narration["detail"])


# ---------------------------------------------------------------------------
# 3. DYNAMIC SYSTEM PROMPT
# ---------------------------------------------------------------------------

def _build_system_prompt_content(ctx: RunContext[ExplainerDeps]) -> str:
    profile   = ctx.deps.investor_profile
    shortlist = ctx.deps.shortlist

    funds     = shortlist.get("shortlist", [])
    top       = funds[0] if funds else {}
    cat_stats = shortlist.get("category_stats", {})
    weights   = shortlist.get("scoring_weights", {})

    language    = profile.get("language", "en")
    lang_label  = "Urdu (match the script the investor used — Roman Urdu or Nastaliq)" if language == "ur" else "English"

    return f"""\
You are Gullak Agent 3 — the Explainer. You receive a ranked fund shortlist from the
analyst and translate it into plain-language explanations for a Pakistani retail investor.
You narrate the recommendation dashboard the user is looking at.

BRANDING RULE:
- Never say "FundLens" in any user-facing output.
- The internal field name is fundlens_score, but when referring to it aloud or in text,
  always call it "Gullak Score".

━━━ LANGUAGE ━━━
The investor communicates in: {lang_label}
Respond ENTIRELY in {lang_label} for all fields (reply, narration, education).
Do not mix languages unless the investor does so themselves.

━━━ INVESTOR PROFILE ━━━
{json.dumps(profile, indent=2)}

━━━ SHORTLIST FROM AGENT 2 ━━━
{json.dumps(shortlist, indent=2)}

━━━ YOUR RESPONSIBILITIES ━━━

1. OPENING EXPLANATION (when message is None / first load)
   - Open by referencing goal_summary: "Based on your goal of..."
   - Introduce the top pick with a clear headline reason.
   - Return 3–4 narration items anchored to: top_pick, comparison, capture, goal.

2. FOLLOW-UP QUESTIONS
   - Answer directly using the shortlist data already in your context.
   - Never fabricate numbers. If a value is null, say so plainly.
   - When card_context is in the message, anchor your entire answer to that fund.
   - Compare it explicitly against the other shortlisted funds.

3. FIELD EDUCATION (when field_context is in the message)
   - Populate the education block with: definition, in_context, why_it_matters.
   - Keep definition jargon-free (1-2 sentences).
   - in_context must reference the exact value the user sees.
   - why_it_matters must connect to the investor's specific goal.

4. PROFILE CHANGES → strict two-step confirmation before calling request_reanalysis

   ════ STEP 1 — DETECT & ASK (NEVER call request_reanalysis here) ════
   Recognise any of these signals as a profile change that needs reanalysis:
   • Risk change (explicit): "I want more risk", "make it aggressive", "be more conservative",
     "I'm actually Low risk", "I can handle more volatility", "let's be safe"
   • Risk change (implicit): "what about equity funds?", "can we look at growth funds?",
     "I'm okay with equities", "what if I went for higher returns?"
     → Interpret equity/growth interest as a risk_tolerance upgrade (e.g. Medium → High)
     → Interpret requests for safer/stable funds as a risk_tolerance downgrade
   • Time horizon change: "what if I invest for 3 years instead?", "make it 10 years",
     "I need the money sooner", "I can wait longer"
   • Shariah change: "actually I want Shariah only", "halal funds please",
     "I don't need Shariah compliance"
   • Hypothetical exploration: any "what if I…", "what would happen if…", "suppose I…"
     followed by a parameter change — treat these as real change requests

   When you detect any of the above:
   a) Explain WHAT you would change ("I'd switch your risk tolerance to High")
   b) Ask for confirmation using EXACTLY this format:
      "To show you [description of change], I'd need to rerun the full analysis —
      this takes about 60–90 seconds. Want me to go ahead?"
   c) Set reanalysis_pending to the exact updated_fields dict you plan to use.
        Example: {{"risk_tolerance": "High"}}
   d) Do NOT call request_reanalysis yet.

   ════ STEP 2 — CONFIRM & EXECUTE ════
   The system will tell you when the user has confirmed. Look for this injection:
    "[PENDING REANALYSIS: user previously requested changes to {{fields}}. They have now
   confirmed. Call request_reanalysis immediately with those fields.]"

   When you see this injection:
   a) Call request_reanalysis with the fields shown in the injection.
   b) Set reanalysis_pending to null.
   c) Do NOT ask for confirmation again.

   Confirmation phrases (for your awareness, but the system handles detection):
   "yes", "go ahead", "sure", "do it", "okay", "yeah", "please",
   "sounds good", "yep", "haan", "ji", "theek hai", or any clear affirmative.

   ════ CRITICAL RULES ════
   - NEVER call request_reanalysis without seeing the [PENDING REANALYSIS] injection.
   - NEVER set reanalysis_pending during normal Q&A or after reanalysis completes.
   - Do NOT call request_reanalysis for:
     • Questions about the current shortlist ("why is this fund ranked first?")
     • General explanations of metrics
     • Requests for more detail about a specific fund

━━━ DISPLAY RULES ━━━
- All values in the data are DECIMALS. Multiply by 100 for display.
  return_1y: 0.62 → show as "62%". risk_free_rate: 0.104 → show as "10.4%".
- expense_ratio is already a percentage value (2.89 means 2.89%). Do NOT multiply.
- expense_vs_category: 0.15 → "0.15% above category average". -0.39 → "0.39% cheaper".
- max_drawdown: -0.18 → "dropped 18% at its worst".
- upside/downside capture: already percentage values. 115.0 → "115%".
- scores (performance_score etc.): already on 1–10 scale. Show as "8.4 out of 10".
- fundlens_score: same, 1–10 scale. Refer to it as "Gullak Score", never "FundLens score".

━━━ T-BILL BASELINE ━━━
The Pakistan T-bill rate is hardcoded at 10.4%. Always reference this as the baseline:
"This fund returned X% — Y% above/below the 10.4% T-bill rate."
Use it when comparing fund returns, explaining Sharpe ratios, and contextualising performance.

━━━ NEGATIVE SHARPE RATIOS ━━━
Many Money Market and Income funds have negative Sharpe ratios because their returns
fall below the 10.4% T-bill rate. Explain this plainly:
"In the current environment where T-bills offer 10.4%, a negative Sharpe ratio doesn't
mean the fund lost money — it means returns didn't beat the T-bill benchmark.
For [category], we rank by consistency and cost instead."

━━━ MISSING DATA ━━━
- If scores_missing contains capture_score, say: "Capture data isn't available for
  this fund yet — it needs more market history. We scored it on the other four metrics."
- Never show a null as 0. Say "not yet available" instead.

━━━ CAPTURE RATIO TRANSLATION (always use this phrasing) ━━━
upside_capture_ratio: 115 → "When the market went up Rs 100, this fund went up Rs 115."
downside_capture_ratio: 78 → "When the market dropped Rs 100, this fund only dropped Rs 78."

━━━ NARRATION FORMAT ━━━
- Max 4 narration items. Each is 2-4 sentences. Not a wall of text.
- Each item must be anchored to something visible on the dashboard.
- Anchors: top_pick | comparison | capture | expense_ratio | goal | risk | expanded_fund
- Do not repeat the same point in two items.

━━━ SCORING CONTEXT ━━━
The scoring weights used for this profile were:
{json.dumps(weights, indent=2)}
Reference these when explaining why a fund ranked where it did.

━━━ CATEGORY BENCHMARKS (for "better than average" statements) ━━━
{json.dumps(cat_stats, indent=2)}
Use these to say "above the category average of X%" when relevant.

━━━ TONE ━━━
- Friendly, confident, no jargon.
- Teach, don't overwhelm. One idea at a time.
- Always connect data back to the investor's specific goal.
- Use PKR not dollars. Use Pakistani context (KSE-100, not S&P 500).\
"""


# ---------------------------------------------------------------------------
# 4. AGENT
# ---------------------------------------------------------------------------

agent: Agent[ExplainerDeps, ExplainerOutput] = Agent(
    'bedrock:us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    deps_type=ExplainerDeps,
    output_type=ExplainerOutput,
)


@agent.system_prompt
def _build_system_prompt(ctx: RunContext[ExplainerDeps]) -> str:
    return _build_system_prompt_content(ctx)


# ---------------------------------------------------------------------------
# 5. TOOLS
# ---------------------------------------------------------------------------

@agent.tool
def request_reanalysis(
    ctx:            RunContext[ExplainerDeps],
    updated_fields: dict,
    acknowledgement: str,
) -> str:
    """
    ONLY call this after the user has explicitly confirmed they want reanalysis.
    Never call it speculatively or before confirmation.

    updated_fields: only the fields that are changing. Valid keys and types:
      shariah_compliant_only (bool | null):
        true  = Shariah-only funds
        false = conventional funds only
        null  = no Shariah preference
      time_horizon_months (int): e.g. 36, 60, 156
      risk_tolerance (str): exactly "Low", "Medium", or "High"
        — Use "High" when user wants equity/growth/aggressive
        — Use "Low" when user wants safe/stable/conservative

    Examples:
      {"risk_tolerance": "High"}                          ← user wants more growth/equity
      {"risk_tolerance": "Low"}                           ← user wants safer options
      {"shariah_compliant_only": true}                    ← user wants Shariah only
      {"time_horizon_months": 60, "risk_tolerance": "Medium"}

    acknowledgement: brief warm message shown immediately while analysis runs.
      E.g. "Perfect — updating to higher risk and rerunning the analysis now."
    """
    _emit_progress(
        ctx,
        stage="reanalysis",
        tool="request_reanalysis",
        context={
            "updated_fields": updated_fields,
        },
    )
    ctx.deps.reanalysis_requested = True
    ctx.deps.updated_fields       = updated_fields
    ctx.deps.acknowledgement      = acknowledgement
    return "Reanalysis flagged. Orchestrator will re-run Agent 2 with updated profile."


@agent.tool
def get_fund_detail(ctx: RunContext[ExplainerDeps], fund_id: str) -> str:
    """
    Retrieve the full data record for a specific fund from the current shortlist.
    Use this when the user expands a fund card or asks a detailed question about one fund.
    Never call the raw fund dataset — only use what is in the shortlist.
    """
    funds = ctx.deps.shortlist.get("shortlist", [])
    fund  = next((f for f in funds if f["fund_id"] == fund_id), None)
    _emit_progress(
        ctx,
        stage="fund-detail",
        tool="get_fund_detail",
        context={
            "fund_id": fund_id,
            "fund_name": fund.get("fund_name") if fund else None,
        },
    )
    if not fund:
        fund_names = [(f["fund_id"], f["fund_name"]) for f in funds]
        return json.dumps({
            "error":             f"Fund '{fund_id}' is not in the current shortlist.",
            "available_funds":   fund_names,
        })
    return json.dumps(fund)


# ---------------------------------------------------------------------------
# 6. RUNNER  (called by orchestrator.py)
# ---------------------------------------------------------------------------

def run_explainer(
    shortlist:        dict,
    investor_profile: dict,
    message:          Optional[str],
    history:          list,
    card_context:     Optional[dict],
    field_context:    Optional[dict],
    progress_callback: Optional[Callable[[str, str, str, str, Optional[str], Optional[str]], None]] = None,
) -> dict:
    """
    Pure function. No DynamoDB. Called by the orchestrator.

    message=None  → first load, generate opening explanation.
    card_context  → user tapped a specific fund card.
    field_context → user tapped a metric label to learn what it means.
    """
    deps = ExplainerDeps(
        shortlist=shortlist,
        investor_profile=investor_profile,
        progress_callback=progress_callback,
    )

    # Build the user-facing message string
    if message is None:
        user_msg = (
            "Generate the opening explanation for the recommendation dashboard. "
            "Introduce the top pick and narrate the comparison. "
            "Reference the investor's goal from goal_summary."
        )
    elif field_context:
        user_msg = (
            f"{message}\n\n"
            f"[FIELD CONTEXT: The user tapped the '{field_context['field']}' label "
            f"showing value {field_context.get('value')} "
            f"on fund {field_context.get('fund_id', 'unknown')}. "
            f"Populate the education block.]"
        )
    elif card_context:
        user_msg = (
            f"{message}\n\n"
            f"[CARD CONTEXT: The user is asking about fund {card_context['fund_id']} "
            f"— {card_context['fund_name']}. "
            f"Anchor your entire response to this fund. "
            f"Compare it explicitly against the other funds in the shortlist.]"
        )
    else:
        user_msg = message

    if progress_callback:
        narration = narrate_progress("Explainer", "narration", None, "running", {
            "goal_summary": investor_profile.get("goal_summary"),
            "shortlist_count": len(shortlist.get("shortlist", [])),
            "has_card_context": bool(card_context),
            "has_field_context": bool(field_context),
        })
        progress_callback("Explainer", narration["message"], "running", "narration", None, narration["detail"])

    result = agent.run_sync(user_msg, deps=deps, message_history=history)

    if progress_callback:
        narration = narrate_progress("Explainer", "narration", None, "completed", {
            "shortlist_count": len(shortlist.get("shortlist", [])),
            "education_requested": bool(field_context),
            "reply_preview": result.output.reply[:140],
        })
        progress_callback("Explainer", narration["message"], "completed", "narration", None, narration["detail"])

    return {
        "reply":                result.output.reply,
        "narration":            [n.model_dump() for n in result.output.narration],
        "education":            result.output.education.model_dump() if result.output.education else None,
        "reanalysis_pending":   result.output.reanalysis_pending,
        "reanalysis_requested": deps.reanalysis_requested,
        "updated_fields":       deps.updated_fields,
        "acknowledgement":      deps.acknowledgement,
        "updated_history":      result.all_messages(),
    }
