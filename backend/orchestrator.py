import json
import uuid
import os
import boto3
from datetime import datetime, timezone
from typing import Optional
from botocore.exceptions import ClientError

from pydantic_ai.messages import ModelMessagesTypeAdapter
from progress_narrator import narrate_progress

# Agent runner imports — same Lambda package
from lambda_function import run_profiler_turn, EMPTY_PROFILE
from analyst_agent import run_analyst
from explainer_agent import run_explainer
from transcribe_handler import handle_transcribe

# --- 1. CONFIGURATION ---

dynamodb  = boto3.resource('dynamodb', region_name='us-east-1')
TABLE_NAME = os.environ.get('SESSIONS_TABLE', 'gullak-sessions')
table     = dynamodb.Table(TABLE_NAME)

MAX_REANALYSES = 3
MAX_PROGRESS_EVENTS = 40
WS_CONNECTION_KEY_PREFIX = "ws#"


# --- 2. PROFILE TRANSLATION ---
# Converts Agent 1's output schema into Agent 2's input schema.

def translate_profile(agent1_profile: dict) -> dict:
    months  = agent1_profile["time_horizon_months"]
    horizon = "short" if months < 24 else "medium" if months < 60 else "long"
    return {
        "monthly_amount":      agent1_profile["investment_amount_pkr"],
        "time_horizon":        horizon,
        "time_horizon_months": months,
        "risk_tolerance":      agent1_profile["risk_tolerance"].lower(),
        "shariah_preference":  "shariah_only" if agent1_profile["shariah_compliant_only"] is True else "conventional_only" if agent1_profile["shariah_compliant_only"] is False else "no_preference",
        "target_amount_pkr":   agent1_profile.get("target_amount_pkr"),
        "language":            agent1_profile.get("language", "en"),
        "liquidity_needs":     agent1_profile.get("liquidity_needs"),
        "goal_summary":        agent1_profile.get("goal_summary"),
    }


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_progress_event(
    session: dict,
    agent: str,
    message: str,
    status: str = "running",
    stage: Optional[str] = None,
    tool: Optional[str] = None,
    detail: Optional[str] = None,
) -> None:
    events = session.setdefault("analysis_progress", [])
    events.append({
        "id": str(uuid.uuid4()),
        "agent": agent,
        "message": message,
        "status": status,
        "stage": stage,
        "tool": tool,
        "detail": detail,
        "timestamp": _timestamp(),
    })
    if len(events) > MAX_PROGRESS_EVENTS:
        session["analysis_progress"] = events[-MAX_PROGRESS_EVENTS:]


def _reset_progress(session: dict) -> None:
    session["analysis_progress"] = []


def _progress_callback(session: dict):
    def emit(
        agent: str,
        message: str,
        status: str = "running",
        stage: Optional[str] = None,
        tool: Optional[str] = None,
        detail: Optional[str] = None,
    ) -> None:
        _append_progress_event(session, agent, message, status=status, stage=stage, tool=tool, detail=detail)
        save_session(session)
        _broadcast_progress_snapshot(session["session_id"])

    return emit


def _progress_response(session: dict) -> dict:
    return {
        "phase": session.get("phase", "PROFILING"),
        "progress": session.get("analysis_progress", []),
        "is_complete": session.get("phase") == "CONVERSING" and bool(session.get("current_shortlist")),
    }


def _websocket_endpoint_from_event(event: dict) -> Optional[str]:
    configured = os.environ.get("WEBSOCKET_CALLBACK_URL")
    if configured:
        return configured.rstrip("/")

    request_context = event.get("requestContext", {})
    domain_name = request_context.get("domainName")
    stage = request_context.get("stage")
    if domain_name and stage:
        return f"https://{domain_name}/{stage}"
    return None


def _build_management_client(endpoint_url: str):
    return boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)


def _send_ws_message(endpoint_url: str, connection_id: str, payload: dict) -> bool:
    client = _build_management_client(endpoint_url)
    try:
        client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(payload).encode("utf-8"),
        )
        return True
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code")
        if code in {"GoneException", "ForbiddenException"}:
            return False
        raise


def _connection_lookup_key(connection_id: str) -> str:
    return f"{WS_CONNECTION_KEY_PREFIX}{connection_id}"


def _store_connection_mapping(connection_id: str, subscribed_session_id: str) -> None:
    try:
        table.put_item(Item={
            "session_id": _connection_lookup_key(connection_id),
            "subscribed_session_id": subscribed_session_id,
            "item_type": "ws_connection",
        })
    except ClientError as error:
        print(f"WebSocket mapping save error: {error}")


def _load_connection_mapping(connection_id: str) -> Optional[str]:
    try:
        response = table.get_item(Key={"session_id": _connection_lookup_key(connection_id)})
        item = response.get("Item")
        if item:
            return item.get("subscribed_session_id")
    except ClientError as error:
        print(f"WebSocket mapping load error: {error}")
    return None


def _delete_connection_mapping(connection_id: str) -> None:
    try:
        table.delete_item(Key={"session_id": _connection_lookup_key(connection_id)})
    except ClientError as error:
        print(f"WebSocket mapping delete error: {error}")


def _remove_progress_subscriber(session_id: str, connection_id: str) -> None:
    session = load_session(session_id)
    subscribers = session.get("progress_subscribers", [])
    updated = [subscriber for subscriber in subscribers if subscriber != connection_id]
    if updated == subscribers:
        return
    session["progress_subscribers"] = updated
    save_session(session)


def _broadcast_progress_snapshot(session_id: str) -> None:
    session = load_session(session_id)
    endpoint_url = session.get("progress_socket_endpoint") or os.environ.get("WEBSOCKET_CALLBACK_URL")
    subscribers = session.get("progress_subscribers", [])
    if not endpoint_url or not subscribers:
        return

    payload = {
        "type": "analysis_progress",
        "session_id": session_id,
        **_progress_response(session),
    }

    stale_connections = []
    for connection_id in subscribers:
        ok = _send_ws_message(endpoint_url, connection_id, payload)
        if not ok:
            stale_connections.append(connection_id)

    for connection_id in stale_connections:
        _remove_progress_subscriber(session_id, connection_id)
        _delete_connection_mapping(connection_id)



# --- 4. DYNAMODB SESSION HELPERS ---

def load_session(session_id: str) -> dict:
    """Returns the full session item. Creates a fresh session if not found."""
    try:
        response = table.get_item(Key={'session_id': session_id})
        if 'Item' in response:
            item = response['Item']
            session = {
                "session_id":                item['session_id'],
                "phase":                     item.get('phase', 'PROFILING'),
                "investor_profile":          json.loads(item.get('investor_profile', 'null')),
                "current_shortlist":         json.loads(item.get('current_shortlist', 'null')),
                "agent1_messages":           _deserialise_messages(item.get('agent1_messages_json', '[]')),
                "agent3_messages":           _deserialise_messages(item.get('agent3_messages_json', '[]')),
                "reanalysis_count":          int(item.get('reanalysis_count', 0)),
                "pending_reanalysis_fields": json.loads(item.get('pending_reanalysis_fields', 'null')),
                "analysis_progress":         json.loads(item.get('analysis_progress', '[]')),
            }
            if 'progress_subscribers' in item:
                session['progress_subscribers'] = json.loads(item.get('progress_subscribers', '[]'))
            if 'progress_socket_endpoint' in item:
                session['progress_socket_endpoint'] = item.get('progress_socket_endpoint')
            return session
    except ClientError as e:
        print(f"DynamoDB load error: {e}")

    return _new_session(session_id)


def save_session(session: dict):
    try:
        existing = table.get_item(Key={'session_id': session['session_id']}).get('Item', {})
    except ClientError as e:
        print(f"DynamoDB pre-save read error: {e}")
        existing = {}

    progress_subscribers = session.get('progress_subscribers')
    progress_socket_endpoint = session.get('progress_socket_endpoint')
    if 'progress_subscribers' not in session and 'progress_subscribers' in existing:
        progress_subscribers = json.loads(existing.get('progress_subscribers', '[]'))
    if 'progress_socket_endpoint' not in session and 'progress_socket_endpoint' in existing:
        progress_socket_endpoint = existing.get('progress_socket_endpoint')

    try:
        item = {
            'session_id':                session['session_id'],
            'phase':                     session['phase'],
            'investor_profile':          json.dumps(session['investor_profile']),
            'current_shortlist':         json.dumps(session['current_shortlist']),
            'agent1_messages_json':      _serialise_messages(session['agent1_messages']),
            'agent3_messages_json':      _serialise_messages(session['agent3_messages']),
            'reanalysis_count':          session['reanalysis_count'],
            'pending_reanalysis_fields': json.dumps(session.get('pending_reanalysis_fields')),
            'analysis_progress':         json.dumps(session.get('analysis_progress', [])),
        }
        if progress_subscribers is not None:
            item['progress_subscribers'] = json.dumps(progress_subscribers)
            session['progress_subscribers'] = progress_subscribers
        if progress_socket_endpoint:
            item['progress_socket_endpoint'] = progress_socket_endpoint
            session['progress_socket_endpoint'] = progress_socket_endpoint
        table.put_item(Item=item)
    except ClientError as e:
        print(f"DynamoDB save error: {e}")


def _new_session(session_id: str) -> dict:
    return {
        "session_id":                session_id,
        "phase":                     "PROFILING",
        "investor_profile":          None,
        "current_shortlist":         None,
        "agent1_messages":           [],
        "agent3_messages":           [],
        "reanalysis_count":          0,
        "pending_reanalysis_fields": None,
        "analysis_progress":         [],
    }


def _serialise_messages(messages: list) -> str:
    if not messages:
        return '[]'
    return ModelMessagesTypeAdapter.dump_json(messages).decode('utf-8')


def _deserialise_messages(raw: str) -> list:
    if not raw or raw == '[]':
        return []
    return ModelMessagesTypeAdapter.validate_json(raw)


# --- 5. PHASE HANDLERS ---

def handle_profiling(session: dict, message: str) -> tuple[dict, dict]:
    """Runs one Agent 1 turn. If profiling completes, transitions to ANALYZING."""
    profile = session["investor_profile"] or dict(EMPTY_PROFILE)

    agent1_result = run_profiler_turn(
        message=message,
        history=session["agent1_messages"],
        profile=profile,
    )

    session["agent1_messages"]  = agent1_result["updated_history"]
    session["investor_profile"] = agent1_result["profile"]

    if not agent1_result["is_complete"]:
        save_session(session)
        return session, {
            "phase":       "PROFILING",
            "state":       agent1_result["state"],
            "reply":       agent1_result["reply"],
            "options":     agent1_result["options"],
            "is_complete": False,
        }

    # Profile complete — run Agent 2 then Agent 3
    session["phase"] = "ANALYZING"
    _reset_progress(session)
    translated = translate_profile(session["investor_profile"])
    profiler_narration = narrate_progress("Profiler", "handoff", None, "completed", {
        "risk_tolerance": translated.get("risk_tolerance"),
        "time_horizon": translated.get("time_horizon"),
        "goal_summary": translated.get("goal_summary"),
    })
    _append_progress_event(
        session,
        "Profiler",
        profiler_narration["message"],
        status="completed",
        stage="handoff",
        detail=profiler_narration["detail"],
    )
    save_session(session)

    progress_callback = _progress_callback(session)
    shortlist  = run_analyst(translated, progress_callback=progress_callback)
    session["current_shortlist"] = shortlist
    session["phase"] = "CONVERSING"

    orchestrator_narration = narrate_progress("Orchestrator", "handoff", None, "completed", {
        "shortlist_count": len(shortlist.get("shortlist", [])),
        "top_fund": (shortlist.get("shortlist") or [{}])[0].get("fund_name"),
    })
    _append_progress_event(
        session,
        "Orchestrator",
        orchestrator_narration["message"],
        status="completed",
        stage="handoff",
        detail=orchestrator_narration["detail"],
    )
    save_session(session)

    explainer_result = run_explainer(
        shortlist=shortlist,
        investor_profile=translated,
        message=None,           # None = generate opening explanation
        history=[],
        card_context=None,
        field_context=None,
        progress_callback=progress_callback,
    )
    session["agent3_messages"] = explainer_result["updated_history"]
    explainer_done_narration = narrate_progress("Explainer", "done", None, "completed", {
        "shortlist_count": len(shortlist.get("shortlist", [])),
        "top_fund": (shortlist.get("shortlist") or [{}])[0].get("fund_name"),
    })
    _append_progress_event(
        session,
        "Explainer",
        explainer_done_narration["message"],
        status="completed",
        stage="done",
        detail=explainer_done_narration["detail"],
    )
    save_session(session)

    return session, {
        "phase":            "CONVERSING",
        "reply":            explainer_result["reply"],
        "narration":        explainer_result["narration"],
        "education":        explainer_result["education"],
        "shortlist":        shortlist,
        "investor_profile": translated,
        "options":          None,
        "is_complete":      True,
        "reanalyzed":       False,
    }


_SHARIAH_PREF_MAP = {
    "shariah_only":      True,
    "conventional_only": False,
    "no_preference":     None,
}

def _normalise_updated_fields(fields: dict) -> dict:
    """
    Agent 3 sometimes uses translated field names (shariah_preference, time_horizon)
    instead of Agent 1 names (shariah_compliant_only, time_horizon_months).
    Reverse-translate any known mismatches so the merge is always correct.
    """
    out = dict(fields)
    if "shariah_preference" in out:
        out["shariah_compliant_only"] = _SHARIAH_PREF_MAP.get(out.pop("shariah_preference"), None)
    if "time_horizon" in out:
        # Agent 3 shouldn't pass string horizons; drop it to avoid corruption
        out.pop("time_horizon")
    if "risk_tolerance" in out:
        # Ensure correct casing (Agent 2 uses lowercase, Agent 1 uses Title case)
        rt = out["risk_tolerance"]
        out["risk_tolerance"] = rt.capitalize() if rt else rt
    return out


def handle_conversing(session: dict, message: str, card_context: Optional[dict], field_context: Optional[dict]) -> tuple[dict, dict]:
    """Routes a user message to Agent 3. Handles reanalysis if profile changes detected."""
    translated = translate_profile(session["investor_profile"])

    # If Agent 3 previously signalled a pending reanalysis, check whether this message
    # is a confirmation. If so, inject an explicit instruction so Agent 3 calls the tool.
    pending = session.get("pending_reanalysis_fields")
    effective_message = message
    if pending:
        affirmatives = {"yes", "yeah", "yep", "sure", "ok", "okay", "do it", "go ahead",
                        "please", "sounds good", "haan", "ji", "theek hai", "haan ji"}
        lower = (message or "").lower().strip().rstrip("!.")
        if lower in affirmatives or any(a in lower for a in affirmatives):
            effective_message = (
                f"{message}\n\n"
                f"[PENDING REANALYSIS: user previously requested changes to {json.dumps(pending)}. "
                f"They have now confirmed. Call request_reanalysis immediately with those fields.]"
            )

    explainer_result = run_explainer(
        shortlist=session["current_shortlist"],
        investor_profile=translated,
        message=effective_message,
        history=session["agent3_messages"],
        card_context=card_context,
        field_context=field_context,
    )

    if not explainer_result["reanalysis_requested"]:
        session["agent3_messages"]           = explainer_result["updated_history"]
        session["pending_reanalysis_fields"] = explainer_result.get("reanalysis_pending")
        save_session(session)
        return session, {
            "phase":              "CONVERSING",
            "reply":              explainer_result["reply"],
            "narration":          explainer_result["narration"],
            "education":          explainer_result["education"],
            "reanalysis_pending": explainer_result.get("reanalysis_pending"),
            "reanalyzed":         False,
        }

    # --- Reanalysis path ---

    if session["reanalysis_count"] >= MAX_REANALYSES:
        save_session(session)
        return session, {
            "phase":      "CONVERSING",
            "reply":      "You've updated your preferences a few times. For a completely fresh start with new inputs, I'd recommend beginning a new session.",
            "narration":  [],
            "education":  None,
            "reanalyzed": False,
        }

    # Merge updated fields into stored profile (normalise Agent 3 field names → Agent 1 names)
    session["investor_profile"].update(_normalise_updated_fields(explainer_result["updated_fields"]))
    session["reanalysis_count"]          += 1
    session["phase"]                      = "REANALYZING"
    session["pending_reanalysis_fields"]  = None   # clear — reanalysis is now executing
    save_session(session)

    # Re-run Agent 2 with updated profile
    new_translated = translate_profile(session["investor_profile"])
    new_shortlist  = run_analyst(new_translated)
    session["current_shortlist"] = new_shortlist
    session["phase"] = "CONVERSING"

    # Re-run Agent 3 with fresh context
    new_explainer_result = run_explainer(
        shortlist=new_shortlist,
        investor_profile=new_translated,
        message=None,   # None = generate fresh explanation of new shortlist
        history=[],     # clear history — new shortlist, new context
        card_context=None,
        field_context=None,
    )
    session["agent3_messages"] = new_explainer_result["updated_history"]
    save_session(session)

    return session, {
        "phase":              "CONVERSING",
        "acknowledgement":    explainer_result["acknowledgement"],
        "reply":              new_explainer_result["reply"],
        "narration":          new_explainer_result["narration"],
        "education":          None,
        "shortlist":          new_shortlist,
        "investor_profile":   new_translated,
        "reanalysis_pending": None,
        "reanalyzed":         True,
    }


def handle_ws_connect(_event: dict) -> dict:
    return {"statusCode": 200, "body": "connected"}


def handle_ws_disconnect(event: dict) -> dict:
    request_context = event.get("requestContext", {})
    connection_id = request_context.get("connectionId")
    if not connection_id:
        return {"statusCode": 400, "body": "missing connectionId"}

    subscribed_session_id = _load_connection_mapping(connection_id)
    if subscribed_session_id:
        _remove_progress_subscriber(subscribed_session_id, connection_id)
    _delete_connection_mapping(connection_id)
    return {"statusCode": 200, "body": "disconnected"}


def handle_ws_subscribe(event: dict) -> dict:
    request_context = event.get("requestContext", {})
    connection_id = request_context.get("connectionId")
    if not connection_id:
        return {"statusCode": 400, "body": "missing connectionId"}

    body = event.get("body") or "{}"
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            body = {}

    session_id = body.get("session_id")
    if not session_id:
        return {"statusCode": 400, "body": "session_id is required"}

    session = load_session(session_id)
    session["session_id"] = session_id
    subscribers = session.get("progress_subscribers", [])
    if connection_id not in subscribers:
        subscribers.append(connection_id)
    session["progress_subscribers"] = subscribers

    endpoint_url = _websocket_endpoint_from_event(event)
    if endpoint_url:
        session["progress_socket_endpoint"] = endpoint_url

    save_session(session)
    _store_connection_mapping(connection_id, session_id)

    if endpoint_url:
        _send_ws_message(
            endpoint_url,
            connection_id,
            {
                "type": "analysis_progress",
                "session_id": session_id,
                **_progress_response(session),
            },
        )

    return {"statusCode": 200, "body": "subscribed"}


def handle_ws_ping(event: dict) -> dict:
    request_context = event.get("requestContext", {})
    connection_id = request_context.get("connectionId")
    endpoint_url = _websocket_endpoint_from_event(event)
    if connection_id and endpoint_url:
        _send_ws_message(endpoint_url, connection_id, {"type": "pong"})
    return {"statusCode": 200, "body": "pong"}


def handle_websocket_event(event: dict) -> dict:
    route_key = event.get("requestContext", {}).get("routeKey")
    if route_key == "$connect":
        return handle_ws_connect(event)
    if route_key == "$disconnect":
        return handle_ws_disconnect(event)
    if route_key == "subscribeProgress":
        return handle_ws_subscribe(event)
    if route_key == "ping":
        return handle_ws_ping(event)
    return {"statusCode": 200, "body": "ignored"}


# --- 6. LAMBDA HANDLER ---

def lambda_handler(event, context):
    request_context = event.get('requestContext', {})
    route_key = request_context.get('routeKey')
    connection_id = request_context.get('connectionId')
    if route_key and connection_id:
        return handle_websocket_event(event)

    # Route /transcribe requests to the transcription handler
    path = event.get('path') or event.get('rawPath') or '/'
    if '/transcribe' in path:
        return handle_transcribe(event, context)

    method = event.get('requestContext', {}).get('http', {}).get('method') or event.get('httpMethod') or 'POST'

    if method == 'GET' and '/progress' in path:
        params = event.get('queryStringParameters') or {}
        session_id = params.get('session_id')
        if not session_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'session_id is required'}),
            }

        session = load_session(session_id)
        session['session_id'] = session_id
        response = _progress_response(session)
        response['session_id'] = session_id
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(response),
        }

    body = event.get('body', event)
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            body = {}

    session_id    = body.get('session_id') or str(uuid.uuid4())
    message       = body.get('message', '')
    card_context  = body.get('card_context')   # {"fund_id": "...", "fund_name": "..."}
    field_context = body.get('field_context')  # {"field": "...", "value": ..., "fund_id": "..."}

    session = load_session(session_id)
    session["session_id"] = session_id  # ensure set on new sessions

    try:
        phase = session["phase"]

        if phase in ("PROFILING", "ANALYZING"):
            session, response = handle_profiling(session, message)

        elif phase in ("CONVERSING", "REANALYZING"):
            session, response = handle_conversing(session, message, card_context, field_context)

        else:
            response = {"error": f"Unknown phase: {phase}"}

        response["session_id"] = session_id

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(response),
        }

    except Exception as e:
        print(f"Orchestrator Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Orchestrator Error', 'details': str(e)}),
        }
