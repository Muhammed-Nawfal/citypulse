"""impact node — "what if" query: re-score affected zones only, merge, set impact_summary.

Linkup-search the intervention → Gemini re-scores ONLY affected zones → merge back into
the full zone_risks (unaffected unchanged) → set impact_summary, clear impact_query.
When Gemini is unavailable, falls back to a Linkup-based plain-English summary.
"""
from copilotkit.langgraph import copilotkit_emit_state

from src.llm import ainvoke_timed, get_llm, parse_json
from src.nodes.scoring_node import _normalize_zone, score_zones
from src.state import AgentState, ZONE_IDS
from src.services.linkup_service import LinkupService

linkup = LinkupService()


def _zones_by_id(state: AgentState) -> dict:
    return {z["zone_id"]: z for z in state.get("zone_risks", []) if isinstance(z, dict)}


def _digest_to_summary(query: str, digest: str) -> str:
    """Turn raw Linkup answer into a concise impact summary (no LLM needed)."""
    if not digest or digest.startswith("[fallback]"):
        return f"Researched: {query}. Insufficient data to quantify impact on specific zones."

    # Take first 3 sentences from the Linkup answer as the summary
    sentences = []
    for raw in digest.replace(".\n", ". ").split(". "):
        s = raw.strip()
        if len(s) > 30:
            sentences.append(s.rstrip(".") + ".")
        if len(sentences) >= 3:
            break

    summary = " ".join(sentences)
    return summary or digest[:400]


async def impact_assessment_node(state: AgentState, config) -> AgentState:
    query = state.get("impact_query") or ""
    city = state.get("city") or "the city"
    scenario = state.get("scenario") or "infrastructure risk"

    state.setdefault("research_log", [])
    state["status"] = "researching"
    state["research_log"].append(f"Assessing intervention: {query}")
    await copilotkit_emit_state(config, state)

    # Research the intervention via Linkup
    digest = ""
    linkup_sources: list[dict] = []
    try:
        result = await linkup.search(query)
        if result:
            digest = str(result.get("answer") or "")
            linkup_sources = result.get("sources") or []
    except Exception:
        pass

    existing = _zones_by_id(state)

    if not existing:
        # No prior scores — run a full scoring pass
        scored = await score_zones(city, scenario, digest, ZONE_IDS)
        if scored:
            state["zone_risks"] = scored
            state["scoring_source"] = "ai"
            state["impact_summary"] = _digest_to_summary(query, digest)
        else:
            state["impact_summary"] = (
                "Sorry, I couldn't process that request right now "
                "(the scoring service is unavailable). Please try again in a moment."
            )
        state["impact_sources"] = linkup_sources
        state["impact_query"] = None
        return state

    state["status"] = "scoring"
    await copilotkit_emit_state(config, state)

    updated, summary = await _rescore_affected(query, city, scenario, digest, existing)

    if not summary:
        # Gemini genuinely failed (timeout/error/malformed JSON after 3 retries) —
        # say so plainly rather than papering over it with a Linkup-only summary
        # that implies the intervention was assessed when scores never changed.
        summary = (
            "Sorry, I couldn't process that request right now "
            "(the scoring service is unavailable). Please try again in a moment."
        )

    # Merge updated zones (may be empty if Gemini failed — existing scores kept)
    existing.update({z["zone_id"]: z for z in updated})
    state["zone_risks"] = [existing[z] for z in ZONE_IDS if z in existing]
    state["impact_summary"] = summary
    state["impact_sources"] = linkup_sources
    state["impact_query"] = None
    return state


async def _rescore_affected(
    query: str, city: str, scenario: str, digest: str, existing: dict
) -> tuple[list, str]:
    """Ask Gemini which zones the intervention changes + their new scores."""
    current = {z: existing[z]["score"] for z in existing}
    prompt = (
        f"Current {scenario} risk scores by zone for {city}: {current}.\n"
        f"Proposed intervention: {query}\n"
        f"Research notes: {digest or 'none'}\n\n"
        "Return ONLY JSON, no fences:\n"
        '{"summary": "1-2 sentence plain-English effect", '
        '"zones": [{"zone_id": "z_r_c", "score": 0.0-1.0, '
        '"evidence": ["why this zone changed"], "sources": []}]}\n'
        "Include in 'zones' ONLY the zones whose risk the intervention actually changes."
    )
    try:
        llm = get_llm(temperature=0.2)
    except Exception:
        return [], ""

    # Retry ×3 — a single malformed/truncated JSON response shouldn't fall all
    # the way back to the generic Linkup summary.
    for _ in range(3):
        try:
            resp = await ainvoke_timed(llm, prompt)
            data = parse_json(resp.content)
            if isinstance(data, dict) and isinstance(data.get("zones"), list):
                updated = [
                    _normalize_zone(z, z["zone_id"])
                    for z in data["zones"]
                    if isinstance(z, dict) and z.get("zone_id") in existing
                ]
                return updated, str(data.get("summary") or "")
        except Exception:
            continue

    return [], ""
