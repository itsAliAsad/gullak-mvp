import asyncio
import base64
import json


# ---------------------------------------------------------------------------
# Language code mapping
# ---------------------------------------------------------------------------

_LANG_MAP = {
    "en": "en-US",
    "ur": "ur-PK",
    "en-US": "en-US",
    "ur-PK": "ur-PK",
}


# ---------------------------------------------------------------------------
# Transcription runner (async — uses amazon-transcribe streaming SDK)
# ---------------------------------------------------------------------------

async def _transcribe_pcm(audio_bytes: bytes, language_code: str) -> str:
    from amazon_transcribe.client import TranscribeStreamingClient
    from amazon_transcribe.model import TranscriptEvent

    client = TranscribeStreamingClient(region="us-east-1")

    stream = await client.start_stream_transcription(
        language_code=language_code,
        media_sample_rate_hz=16000,
        media_encoding="pcm",
    )

    transcript_parts: list[str] = []

    async def _write_audio():
        # Keep well below the service frame limit after event-stream overhead.
        chunk_size = 8 * 1024
        for i in range(0, len(audio_bytes), chunk_size):
            await stream.input_stream.send_audio_event(
                audio_chunk=audio_bytes[i : i + chunk_size]
            )
        await stream.input_stream.end_stream()

    async def _read_transcript():
        async for event in stream.output_stream:
            if isinstance(event, TranscriptEvent):
                for result in event.transcript.results:
                    if not result.is_partial:
                        for alt in result.alternatives:
                            transcript_parts.append(alt.transcript)

    await asyncio.gather(_write_audio(), _read_transcript())
    return " ".join(transcript_parts).strip()


# ---------------------------------------------------------------------------
# Lambda handler — called by orchestrator when path contains /transcribe
# ---------------------------------------------------------------------------

def handle_transcribe(event, _context):
    body = event.get("body", event)
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            body = {}

    audio_b64 = body.get("audio", "")
    language  = body.get("language", "en")

    language_code = _LANG_MAP.get(language, "en-US")

    if not audio_b64:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "No audio data provided"}),
        }

    try:
        audio_bytes = base64.b64decode(audio_b64)
        transcript  = asyncio.run(_transcribe_pcm(audio_bytes, language_code))
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"transcript": transcript}),
        }

    except Exception as e:
        print(f"Transcription error: {e}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Transcription failed", "details": str(e)}),
        }
