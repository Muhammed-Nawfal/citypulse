"""Shared Gemini client + JSON parsing — used by parse / scoring / impact nodes.

Gemini Flash via langchain-google-genai. Key from GEMINI_API_KEY (.env).
"""
import asyncio
import json
import os
import re
from functools import lru_cache
from typing import Optional

from langchain_core.messages import BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI

# "gemini-2.0-flash" is quota-frozen (limit: 0) for keys created after Google's
# free-tier cutover; "gemini-flash-latest" now resolves to "gemini-3.5-flash",
# which has only a 20-requests/day free-tier cap — exhausted almost
# immediately by this app's multi-call-per-turn flow. "gemini-flash-lite-latest"
# is the current alias with a workable free-tier quota.
_MODEL = "gemini-flash-lite-latest"

# Every direct Gemini call in the nodes goes through ainvoke_timed so a slow/
# hanging API (no response, not even an error — seen in practice) can't stall
# a whole run; callers already have fallback paths for a failed/timed-out call.
LLM_CALL_TIMEOUT = 20.0


@lru_cache(maxsize=4)
def get_llm(temperature: float = 0.2) -> ChatGoogleGenerativeAI:
    """Cached Gemini client. temp 0.2 default for scoring determinism."""
    return ChatGoogleGenerativeAI(
        model=_MODEL,
        temperature=temperature,
        google_api_key=os.getenv("GEMINI_API_KEY"),
    )


async def ainvoke_timed(llm: ChatGoogleGenerativeAI, prompt: str) -> BaseMessage:
    """llm.ainvoke with a bounded timeout — raises asyncio.TimeoutError on a
    hung/slow call instead of blocking the node indefinitely."""
    return await asyncio.wait_for(llm.ainvoke(prompt), timeout=LLM_CALL_TIMEOUT)


_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


def _as_text(content) -> str:
    """Normalise a LangChain message .content to plain text.

    Newer Gemini models (via the native SDK's multi-part / thought-signature
    format) return content as a list of blocks (e.g. [{"type": "text",
    "text": "...", "extras": {...}}]) instead of a plain string — join just
    the text blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text") or ""))
        return "".join(parts)
    return str(content or "")


def strip_json_fences(text: str) -> str:
    """Remove ```json ... ``` fences Gemini sometimes wraps around JSON."""
    return _FENCE_RE.sub("", text.strip()).strip()


def parse_json(content) -> Optional[object]:
    """Normalise content, strip fences, and json.loads. Returns None on
    failure (caller retries/falls back)."""
    try:
        return json.loads(strip_json_fences(_as_text(content)))
    except (json.JSONDecodeError, ValueError):
        return None
