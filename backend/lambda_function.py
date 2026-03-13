import json
import uuid
import os
import boto3
from typing import Optional, Any, List
from dataclasses import dataclass, field
from botocore.exceptions import ClientError

from pydantic import BaseModel, Field, field_validator
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessagesTypeAdapter

# --- 1. CONFIGURATION & AWS CLIENTS ---
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
TABLE_NAME = os.environ.get('SESSIONS_TABLE', 'gullak-sessions')
table = dynamodb.Table(TABLE_NAME)


# --- 2. PYDANTIC MODELS ---

class QuickReplyOption(BaseModel):
    label: str = Field(description="Short display text shown on the button. Max 30 characters.")
    value: str = Field(description="The full message sent to the agent when the user taps this button.")

    @field_validator('label')
    @classmethod
    def label_max_length(cls, v: str) -> str:
        if len(v) > 30:
            raise ValueError('Label must be 30 characters or less for button display')
        return v


class QuickReplySet(BaseModel):
    state: str = Field(description="The profiling state these options belong to, e.g. AMOUNT, HORIZON, RISK")
    options: List[QuickReplyOption] = Field(
        description="Between 2 and 4 quick reply options for the user to tap",
        min_length=2,
        max_length=4
    )


class InvestorProfile(BaseModel):
    investment_amount_pkr: float = Field(description="Monthly investment amount in PKR")
    time_horizon_months: int = Field(description="Investment time horizon in months")
    risk_tolerance: str = Field(description="Low, Medium, or High")
    shariah_compliant_only: Optional[bool] = Field(
        description="True = Shariah only. False = conventional only. None = no preference."
    )
    liquidity_needs: str = Field(description="Short description of the user's liquidity needs")
    target_amount_pkr: Optional[float] = Field(
        default=None,
        description="Specific financial target the user wants to reach, in PKR. Only set if user explicitly mentions a goal amount."
    )
    language: str = Field(
        default="en",
        description="Language the investor is using. 'en' = English, 'ur' = Urdu. Detected from conversation."
    )
    goal_summary: Optional[str] = Field(
        default=None,
        description="1-2 sentence plain-language summary of the user's financial goal in their own words. "
                    "E.g. 'Saving for daughter's university. She is 5 years old.' "
                    "Extract this from what the user has shared throughout the conversation."
    )


# --- 3. AGENT DEPENDENCIES ---

@dataclass
class ProfilerDeps:
    session_id: str
    profile: dict = field(default_factory=lambda: {
        "investment_amount_pkr":  None,
        "time_horizon_months":    None,
        "risk_tolerance":         None,
        "shariah_compliant_only": None,
        "liquidity_needs":        None,
        "target_amount_pkr":      None,
        "language":               "en",
        "goal_summary":           None,
    })
    current_options: Optional[QuickReplySet] = None


# --- 4. AGENT ---

agent: Agent[ProfilerDeps, str] = Agent(
    'bedrock:us.anthropic.claude-haiku-4-5-20251001-v1:0',
    deps_type=ProfilerDeps,
    output_type=str,
    system_prompt=(
        "You are the Gullak Profiler Agent. Your goal is to chat with a Pakistani retail investor "
        "and collect their investment profile through friendly, simple conversation.\n\n"

        "LANGUAGE:\n"
        "- Detect the language the user is writing in. If they write in Urdu (in any script), "
        "immediately call save_language('ur') and switch all your responses to Urdu for the rest "
        "of the conversation. If they write in English, call save_language('en'). Do this on the "
        "very first message the user sends.\n\n"

        "ADVISORY BEHAVIOR — when the user is unsure:\n"
        "- If the user is unsure how much to invest (e.g. 'I don't know', 'you tell me', 'not sure'), "
        "ask conversationally about their monthly income and essential monthly expenses. "
        "Based on their answer, recommend a specific monthly investment amount — a reasonable "
        "savings rate is 10–20%% of take-home income after expenses. "
        "State your recommendation clearly and ask them to confirm before calling save_investment_amount.\n"
        "- If the user is unsure about their risk tolerance, ask 2–3 simple questions: "
        "Do they have an emergency fund? How would they feel if their investment dropped 15%% for a few months? "
        "Are they investing for a short goal or long term? Based on their answers, recommend Low, Medium, or High "
        "with a brief reason, and confirm before calling save_risk_tolerance.\n"
        "- Be warm and reassuring — many users have never invested before and need guidance, not just questions.\n\n"

        "COLLECTION RULES:\n"
        "- Collect ONE field at a time in this exact order: investment amount → time horizon → "
        "risk tolerance → Shariah preference → liquidity needs.\n"
        "- NEVER ask about fund types or fund categories — our system determines this automatically.\n"
        "- NEVER ask about a field that is already saved (non-null in the profile).\n"
        "- Before EVERY question you ask, call generate_clarifying_options with 2-4 relevant, "
        "contextual options. Make the options feel natural given what the user has already told you.\n"
        "- QUICK REPLY RULES — generate_clarifying_options must ONLY contain specific, "
        "real answers the user can select (e.g. 'Rs 10,000/month', '5 years', 'Yes, Shariah only'). "
        "NEVER include meta-options like 'Let me type', 'I'll type instead', 'Other', 'Skip', "
        "'Something else', 'None of these', or any option that is not itself a real answer. "
        "Users who want a custom answer will type it directly in the chat.\n"
        "- After the user confirms a value, call the correct save_ tool to store it.\n"
        "- Acknowledge what the user said before moving on.\n"
        "- On every non-final turn, your visible reply must include the actual next question in the same message. "
        "Never send only an acknowledgement like 'Got it' or 'Let me adjust that' without the question.\n"
        "- If the user mentions a specific financial target amount at any point "
        "(e.g. 'I want Rs 5 million', 'I need 50 lakhs'), call save_target_amount with the amount in PKR. "
        "Do NOT ask the user for a target if they haven't mentioned one.\n"
        "- After saving liquidity_needs, call save_goal_summary with a 1-2 sentence plain-language "
        "summary of the user's goal based on everything they have shared. Do not ask the user for this — "
        "compose it yourself from the conversation.\n"
        "- When all fields including goal_summary are saved, reply with a brief warm confirmation and nothing else."
    )
)


# --- 5. TOOLS ---

@agent.tool
def generate_clarifying_options(ctx: RunContext[ProfilerDeps], options: QuickReplySet) -> str:
    """
    Generate and validate quick-reply button options to display on the frontend.
    Call this BEFORE asking the user any question so the frontend can render tappable buttons.
    Options must be contextual — tailor them to what the user has already shared.
    Pydantic validates label length (max 30 chars) and option count (2-4) automatically.
    """
    ctx.deps.current_options = options
    return f"Options set for state {options.state}: {[o.label for o in options.options]}"


@agent.tool
def save_investment_amount(ctx: RunContext[ProfilerDeps], amount_pkr: float) -> str:
    """
    Save the user's monthly investment amount in PKR.
    Convert any shorthand (e.g. '10K' → 10000, '1 lakh' → 100000) before calling.
    """
    if amount_pkr <= 0:
        return "Error: amount must be greater than zero"
    ctx.deps.profile["investment_amount_pkr"] = amount_pkr
    return f"Saved investment amount: Rs {amount_pkr:,.0f}/month"


@agent.tool
def save_time_horizon(ctx: RunContext[ProfilerDeps], months: int) -> str:
    """
    Save the user's investment time horizon in months.
    Convert years to months before calling (e.g. '2 years' → 24, '13 years' → 156).
    """
    if months <= 0:
        return "Error: time horizon must be greater than zero"
    ctx.deps.profile["time_horizon_months"] = months
    return f"Saved time horizon: {months} months ({months // 12} years)"


@agent.tool
def save_risk_tolerance(ctx: RunContext[ProfilerDeps], tolerance: str) -> str:
    """
    Save the user's risk tolerance. Must be exactly 'Low', 'Medium', or 'High'.
    Infer from natural language: 'I don't want to lose money' → Low,
    'some ups and downs are okay' → Medium, 'I want maximum growth' → High.
    """
    valid = ("Low", "Medium", "High")
    if tolerance not in valid:
        return f"Error: tolerance must be one of {valid}"
    ctx.deps.profile["risk_tolerance"] = tolerance
    return f"Saved risk tolerance: {tolerance}"


@agent.tool
def save_shariah_preference(ctx: RunContext[ProfilerDeps], shariah_only: bool) -> str:
    """
    Save whether the user wants Shariah-compliant funds only.
    Pass True if they explicitly want Shariah/Islamic funds, False otherwise.
    """
    ctx.deps.profile["shariah_compliant_only"] = shariah_only
    return f"Saved Shariah preference: {'Shariah only' if shariah_only else 'No Shariah restriction'}"


@agent.tool
def save_language(ctx: RunContext[ProfilerDeps], language_code: str) -> str:
    """
    Save the detected language the investor is communicating in.
    Call this on the very first message the user sends.
    language_code: 'en' for English, 'ur' for Urdu.
    """
    valid = ("en", "ur")
    if language_code not in valid:
        language_code = "en"
    ctx.deps.profile["language"] = language_code
    return f"Saved language: {language_code}"


@agent.tool
def save_target_amount(ctx: RunContext[ProfilerDeps], amount_pkr: float) -> str:
    """
    Save the user's specific financial target amount in PKR.
    Only call this if the user explicitly mentions a target they want to reach
    (e.g. 'I want Rs 5 million', 'my goal is 50 lakhs').
    Convert shorthand: '5 million' → 5000000, '50 lakh' → 5000000.
    """
    if amount_pkr <= 0:
        return "Error: target amount must be greater than zero"
    ctx.deps.profile["target_amount_pkr"] = amount_pkr
    return f"Saved target amount: Rs {amount_pkr:,.0f}"


@agent.tool
def save_liquidity_needs(ctx: RunContext[ProfilerDeps], liquidity_needs: str) -> str:
    """
    Save the user's liquidity needs as a short plain-language description.
    Examples: 'Needs access within 3 months', 'Can lock funds for 2+ years', 'No liquidity needs'.
    """
    ctx.deps.profile["liquidity_needs"] = liquidity_needs
    return f"Saved liquidity needs: {liquidity_needs}"


@agent.tool
def save_goal_summary(ctx: RunContext[ProfilerDeps], summary: str) -> str:
    """
    Save a 1-2 sentence plain-language summary of the user's financial goal.
    Compose this yourself from the full conversation — do not ask the user.
    Call this immediately after saving liquidity_needs.
    Example: 'Saving for daughter's university education. She is 5 years old.'
    Example: 'Building a retirement fund with a 20-year horizon.'
    """
    ctx.deps.profile["goal_summary"] = summary
    return f"Saved goal summary: {summary}"


# --- 6. STATE MACHINE ---

def get_current_state(profile: dict) -> str:
    if profile["investment_amount_pkr"] is None:  return "AMOUNT"
    if profile["time_horizon_months"] is None:     return "HORIZON"
    if profile["risk_tolerance"] is None:          return "RISK"
    if profile["shariah_compliant_only"] is None:  return "SHARIAH"
    if profile["liquidity_needs"] is None:         return "LIQUIDITY"
    if profile["goal_summary"] is None:            return "SUMMARY"
    return "COMPLETE"


def _format_horizon_label(months: Optional[int]) -> str:
    if not months:
        return "this investment period"
    if months % 12 == 0:
        years = months // 12
        return f"the next {years} year{'s' if years != 1 else ''}"
    return f"the next {months} month{'s' if months != 1 else ''}"


def _fallback_question_for_state(state: str, profile: dict) -> str:
    if state == "AMOUNT":
        return "How much are you thinking of investing each month?"
    if state == "HORIZON":
        return "How long can you leave this money invested?"
    if state == "RISK":
        return "What level of ups and downs would you be comfortable with for better returns?"
    if state == "SHARIAH":
        return "Would you like your investments to be Shariah-compliant (Islamic funds only), or are you open to any type of investment fund?"
    if state == "LIQUIDITY":
        horizon_label = _format_horizon_label(profile.get("time_horizon_months"))
        return f"Might you need emergency access to this money during {horizon_label}?"
    return ""


def _ensure_reply_matches_state(reply: str, state: str, profile: dict, options: Optional[QuickReplySet]) -> str:
    text = (reply or "").strip()
    if state in {"SUMMARY", "COMPLETE"}:
        return text
    if not options or options.state != state:
        return text

    fallback_question = _fallback_question_for_state(state, profile)
    if not fallback_question or "?" in text:
        return text
    if not text:
        return fallback_question

    separator = "\n\n" if text.endswith(":") else " "
    return f"{text}{separator}{fallback_question}"


# --- 7. PURE RUNNER (called by orchestrator — no DynamoDB) ---

def run_profiler_turn(message: str, history: list, profile: dict) -> dict:
    """
    Pure function. Receives state, returns updated state.
    The orchestrator owns all DynamoDB reads/writes.
    """
    deps = ProfilerDeps(session_id="", profile=profile)

    result = agent.run_sync(
        message,
        deps=deps,
        message_history=history
    )

    current_state = get_current_state(deps.profile)
    reply = _ensure_reply_matches_state(result.output, current_state, deps.profile, deps.current_options)

    return {
        'reply':           reply,
        'state':           current_state,
        'options':         deps.current_options.model_dump() if deps.current_options else None,
        'is_complete':     current_state == "COMPLETE",
        'profile':         deps.profile,
        'updated_history': result.all_messages(),
    }


# --- 8. DYNAMODB HELPERS (used by lambda_handler for standalone testing) ---

EMPTY_PROFILE = {
    "investment_amount_pkr":  None,
    "time_horizon_months":    None,
    "risk_tolerance":         None,
    "shariah_compliant_only": None,
    "liquidity_needs":        None,
    "target_amount_pkr":      None,
    "language":               "en",
    "goal_summary":           None,
}

def get_session(session_id: str) -> tuple[list, dict]:
    try:
        response = table.get_item(Key={'session_id': session_id})
        if 'Item' in response:
            item = response['Item']
            messages = ModelMessagesTypeAdapter.validate_json(item.get('messages_json', '[]'))
            profile  = json.loads(item.get('profile_json', 'null')) or dict(EMPTY_PROFILE)
            return messages, profile
    except ClientError as e:
        print(f"DynamoDB Error reading session: {e}")
    return [], dict(EMPTY_PROFILE)


def save_session(session_id: str, messages: list, profile: dict):
    messages_json = ModelMessagesTypeAdapter.dump_json(messages).decode('utf-8')
    try:
        table.put_item(Item={
            'session_id':    session_id,
            'messages_json': messages_json,
            'profile_json':  json.dumps(profile),
        })
    except ClientError as e:
        print(f"DynamoDB Error writing session: {e}")


# --- 9. LAMBDA HANDLER (standalone — bypassed when called via orchestrator) ---

def lambda_handler(event, context):
    body = event.get('body', event)
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            body = {}

    session_id   = body.get('session_id') or str(uuid.uuid4())
    user_message = body.get('message', '')

    history, profile = get_session(session_id)

    try:
        result = run_profiler_turn(user_message, history, profile)
        save_session(session_id, result['updated_history'], result['profile'])

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'session_id':  session_id,
                'state':       result['state'],
                'reply':       result['reply'],
                'options':     result['options'],
                'is_complete': result['is_complete'],
                'profile':     result['profile'] if result['is_complete'] else None,
            })
        }

    except Exception as e:
        print(f"Agent Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal Agent Error', 'details': str(e)})
        }
