"""emit_zones node — staged build: append one zone, emit, sleep 0.8s.

SCHEMA §4 canonical pattern: reset zone_risks, re-append one-by-one in ZONE_IDS order
with an 800ms gap + emit each, then status=complete + final emit. Persist city_state.
"""
import asyncio
import uuid
from datetime import datetime, timezone

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from copilotkit.langgraph import copilotkit_emit_state

from src.state import AgentState, ZONE_IDS
from src.services.redis_service import RedisService
from src.zones import ZONE_NAMES as _ZONE_NAMES

redis = RedisService()

_LABEL_EMOJI = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}


async def _stream_reply(summary: str) -> None:
    """Stream a pre-built reply string as if it were live LLM output.

    copilotkit_emit_message (the documented API for this) doesn't actually
    reach the frontend with the pinned copilotkit/ag_ui_langgraph versions
    here — its TEXT_MESSAGE_* dispatch return values are discarded internally
    (verified empirically: zero TEXT_MESSAGE events for it across a full run).
    A real on_chat_model_stream event IS reliably converted into TEXT_MESSAGE_*
    events by ag_ui_langgraph — GenericFakeChatModel replays our already-computed
    text through that exact callback path with no extra LLM call/cost.
    """
    fake = GenericFakeChatModel(messages=iter([summary]))
    async for _ in fake.astream([]):
        pass


def _ordered(zones: list) -> list:
    by_id = {z.get("zone_id"): z for z in zones if isinstance(z, dict)}
    return [by_id[z] for z in ZONE_IDS if z in by_id]


def _research_highlights(research_results: list, limit: int = 2) -> list[str]:
    """Extract the most informative sentence from each Linkup result."""
    highlights = []
    for r in (research_results or []):
        if not isinstance(r, dict):
            continue
        answer = (r.get("answer") or "").strip()
        if not answer or answer.startswith("[fallback]"):
            continue
        for raw in answer.replace(".\n", ". ").split(". "):
            s = raw.strip()
            if len(s) > 50:
                highlights.append(s.rstrip(".") + ".")
                break
        if len(highlights) >= limit:
            break
    return highlights


def _build_scenario_summary(city: str, scenario: str, zones: list, state: AgentState) -> str:
    """Chat reply for a fresh scenario analysis."""
    lines = [f"**{city} — {scenario.title()} Risk Analysis**\n"]

    # Research highlights from Linkup (real data, not hardcoded)
    highlights = _research_highlights(state.get("research_results", []))
    if highlights:
        lines.append("**Key findings from research:**")
        for h in highlights:
            lines.append(f"• {h}")
        lines.append("")

    # Risk breakdown by label
    by_label: dict[str, list[str]] = {"CRITICAL": [], "HIGH": [], "MEDIUM": [], "LOW": []}
    for z in zones:
        label = z.get("label", "LOW")
        name = _ZONE_NAMES.get(z.get("zone_id", ""), z.get("zone_id", ""))
        by_label.setdefault(label, []).append(name)

    for label in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        names = by_label.get(label, [])
        if names:
            emoji = _LABEL_EMOJI.get(label, "")
            lines.append(f"{emoji} **{label}**: {', '.join(names)}")

    # Top-zone evidence — from Linkup if available
    top = max(zones, key=lambda z: z.get("score", 0), default=None)
    if top and top.get("evidence"):
        top_name = _ZONE_NAMES.get(top.get("zone_id", ""), top.get("zone_id", ""))
        lines.append(f"\n**Highest risk — {top_name}** (score {top.get('score', 0):.2f}):")
        for ev in top["evidence"][:2]:
            lines.append(f"• {ev}")

    # Real sources
    sources: list[dict] = []
    for z in zones:
        for s in (z.get("sources") or []):
            if isinstance(s, dict) and s.get("url"):
                sources.append(s)
    if sources:
        lines.append("\n**Sources:**")
        for s in sources[:3]:
            lines.append(f"• [{s.get('title', s['url'])}]({s['url']})")

    lines.append("\n_Click any zone on the map for details. Ask a follow-up like 'what if the Thames barrier holds?'_")
    return "\n".join(lines)


def _build_impact_summary(city: str, scenario: str, zones: list, state: AgentState) -> str:
    """Chat reply for a 'what if' impact assessment."""
    impact = state.get("impact_summary") or ""
    impact_sources = state.get("impact_sources") or []

    lines = [f"**Impact Assessment — {city}**\n"]

    if impact:
        lines.append(impact)
        lines.append("")

    # Show which zones changed (if Gemini succeeded) or just re-show current risk
    by_label: dict[str, list[str]] = {"CRITICAL": [], "HIGH": [], "MEDIUM": [], "LOW": []}
    for z in zones:
        label = z.get("label", "LOW")
        name = _ZONE_NAMES.get(z.get("zone_id", ""), z.get("zone_id", ""))
        by_label.setdefault(label, []).append(name)

    for label in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        names = by_label.get(label, [])
        if names:
            emoji = _LABEL_EMOJI.get(label, "")
            lines.append(f"{emoji} **{label}**: {', '.join(names)}")

    if impact_sources:
        lines.append("\n**Sources:**")
        for s in impact_sources[:3]:
            if isinstance(s, dict) and s.get("url"):
                lines.append(f"• [{s.get('title', s['url'])}]({s['url']})")

    lines.append("\n_Ask another 'what if' question or try a different scenario._")
    return "\n".join(lines)


async def emit_zones_node(state: AgentState, config) -> AgentState:
    scored = _ordered(state.get("zone_risks", []))
    city = state.get("city", "London")
    scenario = state.get("scenario", "infrastructure risk")

    scene_type = (state.get("blueprint") or {}).get("scene_type", "city_grid")
    delay = 0.8 if scene_type == "city_grid" else 0.5

    # Staged build — zones materialise one by one
    state["zone_risks"] = []
    state["status"] = "scoring"
    for zone in scored:
        state["zone_risks"].append(zone)
        await copilotkit_emit_state(config, state)
        await asyncio.sleep(delay)

    # Build the right chat reply based on whether this was a what-if or fresh scenario
    is_impact = bool(state.get("impact_summary"))
    if is_impact:
        summary = _build_impact_summary(city, scenario, scored, state)
    else:
        summary = _build_scenario_summary(city, scenario, scored, state)

    # _stream_reply gets this converted into real TEXT_MESSAGE_* wire events —
    # the actual events useCopilotMessagesContext() listens for. Setting
    # state["messages"] alone (below) updates LangGraph state (fine for
    # useCoAgent-based state sync) but never reaches the chat thread on its
    # own, since this node builds the reply via plain string formatting, not
    # a live LLM streaming call.
    await _stream_reply(summary)
    # Explicit id — LangChain leaves AIMessage.id as None by default, and the
    # frontend dedupes/pairs chat replies by message id.
    state["messages"] = [AIMessage(content=summary, id=str(uuid.uuid4()))]
    state["status"] = "complete"
    await copilotkit_emit_state(config, state)

    # Persist
    city_state = {
        "city": city,
        "scenario": scenario,
        "blueprint": state.get("blueprint"),
        "zones": {z["zone_id"]: z for z in state["zone_risks"]},
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await redis.set_city_state(state.get("session_id", ""), city_state)
    except Exception:
        pass

    return state
