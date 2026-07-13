"""risk_scoring node — Gemini scores 9 zones (JSON-only), label derived from score.

Strip ```json fences, retry ×3, clamp score, derive label per SCHEMA §2 (score wins),
geographic-London fallback on total failure. Phase 3. `score_zones` is reused by impact_node.
"""
import logging

from copilotkit.langgraph import copilotkit_emit_state

from src.llm import ainvoke_timed, get_llm, parse_json
from src.state import AgentState, ZONE_IDS, ZoneRisk, label_for_score
from src.zones import ZONE_CONTEXT

logger = logging.getLogger(__name__)

_GRID_LEGEND = (
    "Zones form a 3×3 grid over the city:\n"
    "z_0_0 NW  z_0_1 N  z_0_2 NE\n"
    "z_1_0 W   z_1_1 C  z_1_2 E\n"
    "z_2_0 SW  z_2_1 S  z_2_2 SE"
)

# London-specific geographic fallback scores by scenario.
_LONDON_FALLBACKS: dict[str, dict[str, float]] = {
    "flooding": {
        "z_0_0": 0.18, "z_0_1": 0.22, "z_0_2": 0.38,
        "z_1_0": 0.28, "z_1_1": 0.65, "z_1_2": 0.52,
        "z_2_0": 0.72, "z_2_1": 0.88, "z_2_2": 0.76,
    },
    "power grid failure": {
        "z_0_0": 0.32, "z_0_1": 0.28, "z_0_2": 0.40,
        "z_1_0": 0.42, "z_1_1": 0.82, "z_1_2": 0.58,
        "z_2_0": 0.50, "z_2_1": 0.62, "z_2_2": 0.55,
    },
    "transport disruption": {
        "z_0_0": 0.38, "z_0_1": 0.52, "z_0_2": 0.35,
        "z_1_0": 0.48, "z_1_1": 0.85, "z_1_2": 0.62,
        "z_2_0": 0.42, "z_2_1": 0.75, "z_2_2": 0.60,
    },
    "extreme heat": {
        "z_0_0": 0.38, "z_0_1": 0.35, "z_0_2": 0.42,
        "z_1_0": 0.52, "z_1_1": 0.78, "z_1_2": 0.62,
        "z_2_0": 0.55, "z_2_1": 0.70, "z_2_2": 0.65,
    },
    "air quality": {
        "z_0_0": 0.28, "z_0_1": 0.32, "z_0_2": 0.45,
        "z_1_0": 0.48, "z_1_1": 0.72, "z_1_2": 0.65,
        "z_2_0": 0.52, "z_2_1": 0.68, "z_2_2": 0.58,
    },
    "cyberattack": {
        "z_0_0": 0.22, "z_0_1": 0.18, "z_0_2": 0.28,
        "z_1_0": 0.35, "z_1_1": 0.92, "z_1_2": 0.48,
        "z_2_0": 0.30, "z_2_1": 0.45, "z_2_2": 0.42,
    },
    "storm surge": {
        "z_0_0": 0.20, "z_0_1": 0.25, "z_0_2": 0.32,
        "z_1_0": 0.30, "z_1_1": 0.58, "z_1_2": 0.48,
        "z_2_0": 0.68, "z_2_1": 0.82, "z_2_2": 0.72,
    },
}


def _extract_evidence_from_research(
    research_results: list | None, limit: int = 3
) -> list[str]:
    """Pull real sentences from Linkup research answers to use as evidence bullets."""
    bullets: list[str] = []
    seen: set[str] = set()
    for r in (research_results or []):
        if not isinstance(r, dict):
            continue
        answer = (r.get("answer") or "").strip()
        if not answer or answer.startswith("[fallback]"):
            continue
        for raw in answer.replace(".\n", ". ").replace("\n", " ").split(". "):
            s = raw.strip().rstrip(".")
            if len(s) < 20:
                continue
            key = s[:60].lower()
            if key in seen:
                continue
            seen.add(key)
            bullets.append(s[:220] + ".")
            if len(bullets) >= limit:
                return bullets
    return bullets


def _research_digest(state: AgentState, limit: int = 4000) -> str:
    parts = []
    for r in state.get("research_results", []):
        if isinstance(r, dict):
            ans = r.get("answer")
            if ans:
                parts.append(str(ans))
    return ("\n\n".join(parts))[:limit] or "No external research available."


def _normalize_zone(raw: dict, zone_id: str) -> ZoneRisk:
    try:
        score = float(raw.get("score", 0.1))
    except (TypeError, ValueError):
        score = 0.1
    score = max(0.0, min(1.0, score))

    evidence = [str(e) for e in (raw.get("evidence") or []) if str(e).strip()][:3]
    if not evidence:
        evidence = ["No specific evidence returned."]

    sources = []
    for s in (raw.get("sources") or [])[:3]:
        if isinstance(s, dict) and s.get("url"):
            sources.append({"title": str(s.get("title") or s["url"]), "url": str(s["url"])})

    return ZoneRisk(
        zone_id=zone_id,
        score=score,
        label=label_for_score(score),
        evidence=evidence,
        sources=sources,
    )


def _geographic_fallback(scenario: str, research_results: list | None = None) -> list[ZoneRisk]:
    """London-specific geographic fallback — realistic scores with zone-specific evidence."""
    scenario_lower = scenario.lower()
    scores = None
    # Prefer an exact phrase match (longest key first) so a scenario like
    # "cyberattack on power grid systems" matches "cyberattack" rather than
    # "power grid failure" just because it shares the word "power".
    for key in sorted(_LONDON_FALLBACKS, key=len, reverse=True):
        if key in scenario_lower:
            scores = _LONDON_FALLBACKS[key]
            break
    if scores is None:
        # No full-phrase hit — fall back to loose word-level matching.
        for key in sorted(_LONDON_FALLBACKS, key=len, reverse=True):
            if any(w in scenario_lower for w in key.split()):
                scores = _LONDON_FALLBACKS[key]
                break
    if scores is None:
        scores = {
            "z_0_0": 0.25, "z_0_1": 0.30, "z_0_2": 0.28,
            "z_1_0": 0.38, "z_1_1": 0.65, "z_1_2": 0.48,
            "z_2_0": 0.42, "z_2_1": 0.55, "z_2_2": 0.45,
        }

    # Real Linkup sentences — used as context bullets for every zone
    research_bullets = _extract_evidence_from_research(research_results, limit=4)

    # Collect real sources from Linkup results
    sources: list[dict] = []
    for r in (research_results or [])[:3]:
        if isinstance(r, dict):
            for s in (r.get("sources") or [])[:2]:
                if isinstance(s, dict) and s.get("url"):
                    sources.append({"title": str(s.get("title") or s["url"]), "url": str(s["url"])})
    sources = sources[:3]

    result = []
    for z in ZONE_IDS:
        score = scores.get(z, 0.2)
        label = label_for_score(score)
        zone_name, zone_desc = ZONE_CONTEXT.get(z, (z, "London zone"))

        # Each zone gets a zone-specific line + up to 2 Linkup research bullets
        zone_line = (
            f"{zone_name}: {zone_desc} — {label.lower()} {scenario} exposure "
            f"(score {score:.2f})."
        )
        if research_bullets:
            ev = [zone_line] + research_bullets[:2]
        else:
            ev = [
                zone_line,
                f"{zone_name} {scenario} risk reflects its geographic position "
                f"and local infrastructure characteristics.",
            ]

        result.append(ZoneRisk(
            zone_id=z,
            score=score,
            label=label,
            evidence=ev[:3],
            sources=sources,
        ))
    return result


def _build_prompt(city: str, scenario: str, digest: str, zone_ids: list[str]) -> str:
    return (
        f"You are an infrastructure risk analyst. Score the {scenario} risk for {city}.\n\n"
        f"{_GRID_LEGEND}\n"
        "Reason from the real geography of each compass sector (rivers/coast, elevation, "
        "density, critical infrastructure) — do NOT give every zone the same score.\n\n"
        f"Research notes:\n{digest}\n\n"
        f"Score EXACTLY these zones: {zone_ids}.\n"
        "Respond with ONLY a JSON array, no prose, no code fences. Each element:\n"
        '{"zone_id": "z_r_c", "score": 0.0-1.0, '
        '"evidence": ["2-3 short grounded bullets, citing the research notes where possible"], '
        '"sources": [{"title": "...", "url": "..."}] (max 3, may be empty)}\n\n'
        "Scoring rules:\n"
        "- Spread scores across the grid: unless the research clearly says otherwise, include at "
        "least one HIGH-or-CRITICAL zone (>=0.6) and at least one LOW zone (<0.3).\n"
        "- Bands: LOW 0.0-0.3, MEDIUM 0.3-0.6, HIGH 0.6-0.8, CRITICAL 0.8-1.0.\n"
        "- Tie each score to that sector's specific exposure for THIS scenario; identical scores "
        "across zones is almost always wrong."
    )


async def score_zones(
    city: str, scenario: str, digest: str, zone_ids: list[str]
) -> list[ZoneRisk] | None:
    """Gemini-score the given zones. Fails fast on init/quota/auth errors; retries
    ×3 on a malformed/empty response, since that's usually a one-off parse hiccup."""
    prompt = _build_prompt(city, scenario, digest, zone_ids)
    try:
        llm = get_llm(temperature=0.2)
    except Exception as exc:
        logger.warning("Failed to initialise LLM: %s", exc)
        return None

    for attempt in range(3):
        try:
            resp = await ainvoke_timed(llm, prompt)
            data = parse_json(resp.content)
            logger.info("Scoring attempt %d: parsed type=%s len=%s", attempt + 1,
                        type(data).__name__,
                        len(data) if isinstance(data, list) else "n/a")
        except Exception as exc:
            logger.warning("Scoring attempt %d failed (%s) for '%s'",
                           attempt + 1, type(exc).__name__, scenario)
            continue

        if not isinstance(data, list):
            logger.warning("Scoring attempt %d returned non-list", attempt + 1)
            continue

        by_id = {}
        for raw in data:
            if isinstance(raw, dict) and raw.get("zone_id") in zone_ids:
                by_id[raw["zone_id"]] = raw

        if not by_id:
            logger.warning("Scoring attempt %d returned no valid zones", attempt + 1)
            continue

        logger.info("Scoring succeeded — %d/%d zones returned by Gemini", len(by_id), len(zone_ids))
        return [_normalize_zone(by_id.get(z, {"score": 0.1}), z) for z in zone_ids]

    logger.warning("Scoring failed after retries — using geographic fallback for '%s'", scenario)
    return None


async def risk_scoring_node(state: AgentState, config) -> AgentState:
    state["status"] = "scoring"
    await copilotkit_emit_state(config, state)

    city = state.get("city") or "the city"
    scenario = state.get("scenario") or "infrastructure risk"
    digest = _research_digest(state)
    research_results = state.get("research_results")

    scored = await score_zones(city, scenario, digest, ZONE_IDS)
    if scored is not None:
        state["zone_risks"] = scored
        state["scoring_source"] = "ai"
    else:
        # Geographic fallback — pass real Linkup results so evidence isn't hardcoded
        state["zone_risks"] = _geographic_fallback(scenario, research_results)
        state["scoring_source"] = "fallback"
        logger.info("Using geographic fallback for scenario='%s'", scenario)

    return state
