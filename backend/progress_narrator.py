import json
from typing import Optional

from pydantic import BaseModel, Field
from pydantic_ai import Agent


class ProgressNarration(BaseModel):
    message: str = Field(description="Short live trace message, 8-20 words, written in first person.")
    detail: str = Field(description="One or two short sentences explaining the actual next step in first person.")


_SYSTEM_PROMPT = """\
You generate live progress narration for an AI fund analysis workflow.

Rules:
- Write in first person from the acting agent's perspective: "I'm", "I need to", "I'm calling".
- Be concrete about the current step and tool.
- Never invent data beyond the provided context.
- Keep message short and scannable.
- Keep detail to one or two sentences.
- Do not mention hidden chain-of-thought or internal policy.
- If a tool name is provided, mention it naturally in the detail.
- For completed events, explain what was achieved and what that unlocks next.
- For running events, explain why the current step is necessary.
"""


_narrator: Agent[None, ProgressNarration] = Agent(
    'bedrock:us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    deps_type=None,
    output_type=ProgressNarration,
    system_prompt=_SYSTEM_PROMPT,
)


def _fallback_message(agent: str, stage: Optional[str], tool: Optional[str], status: str) -> str:
    actor = agent.lower()
    if status == "completed":
        if tool:
            return f"I finished {tool} and I'm moving to the next step."
        if stage:
            return f"I wrapped up the {stage} step and I'm continuing."
        return f"I finished my current step and I'm continuing the analysis."

    if tool:
        return f"I'm using {tool} to move the analysis forward."
    if stage:
        return f"I'm working through the {stage} step now."
    return f"I'm advancing the {actor} workflow now."


def _fallback_detail(agent: str, stage: Optional[str], tool: Optional[str], status: str, context: dict) -> str:
    fragments = []
    if tool:
        fragments.append(f"I'm using {tool} on the live dataset")
    elif stage:
        fragments.append(f"I'm handling the {stage} stage")
    else:
        fragments.append("I'm working on the current analysis step")

    if context:
        visible_keys = []
        for key in ("risk_tolerance", "time_horizon", "category", "category_count", "fund_count", "fund_id", "fund_name"):
            value = context.get(key)
            if value is None:
                continue
            visible_keys.append(f"{key}={value}")
        if visible_keys:
            fragments.append("with context " + ", ".join(visible_keys[:3]))

    suffix = "so the next agent step has grounded inputs." if status != "completed" else "so the workflow can move to the next checkpoint."
    return " ".join(fragments) + " " + suffix


def narrate_progress(
    agent: str,
    stage: Optional[str],
    tool: Optional[str],
    status: str,
    context: Optional[dict] = None,
) -> dict:
    payload = {
        "agent": agent,
        "stage": stage,
        "tool": tool,
        "status": status,
        "context": context or {},
    }

    prompt = (
        "Create live progress narration for this real backend event.\n\n"
        f"EVENT:\n{json.dumps(payload, indent=2, default=str)}\n\n"
        "Return a short message and a short detail explanation."
    )

    try:
        result = _narrator.run_sync(prompt)
        return {
            "message": result.output.message.strip(),
            "detail": result.output.detail.strip(),
        }
    except Exception:
        fallback_context = context or {}
        return {
            "message": _fallback_message(agent, stage, tool, status),
            "detail": _fallback_detail(agent, stage, tool, status, fallback_context),
        }