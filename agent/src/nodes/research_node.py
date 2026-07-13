"""research node — run Linkup query templates concurrently, collect raw results.

Redis cache check first. Queries run in parallel with a per-query timeout so the node
completes in ~max(single_query_time) instead of sum. One failed query never kills the run.
"""
import asyncio

from copilotkit.langgraph import copilotkit_emit_state

from src.state import AgentState
from src.services.linkup_service import LinkupService
from src.services.redis_service import RedisService

linkup = LinkupService()
redis = RedisService()

QUERY_TIMEOUT = 30.0  # seconds per Linkup call (3 run concurrently so total ≈ 30s)


def _query_templates(city: str, scenario: str) -> list[str]:
    return [
        f"{city} infrastructure vulnerability to {scenario}",
        f"historical {scenario} incidents in {city} and affected areas",
        f"which districts of {city} are most exposed to {scenario}",
    ]


async def _safe_search(query: str) -> dict | None:
    """Single Linkup search with timeout — never raises."""
    try:
        return await asyncio.wait_for(linkup.search(query), timeout=QUERY_TIMEOUT)
    except asyncio.TimeoutError:
        return None
    except Exception:
        return None


async def research_node(state: AgentState, config) -> AgentState:
    city     = state.get("city") or "the city"
    scenario = state.get("scenario") or "infrastructure risk"
    session_id = state.get("session_id", "")

    state.setdefault("research_log", [])
    state.setdefault("research_results", [])

    # Cache hit → skip Linkup entirely
    try:
        cached = await redis.get_research(session_id, scenario)
    except Exception:
        cached = None
    if cached:
        state["research_results"] = cached
        state["research_log"].append(f"Loaded cached research for {city} · {scenario}.")
        await copilotkit_emit_state(config, state)
        return state

    queries = _query_templates(city, scenario)
    state["research_log"].append(f"Researching {city} · {scenario} ({len(queries)} sources in parallel)…")
    await copilotkit_emit_state(config, state)

    # Run all queries concurrently — total time ≈ slowest single query
    results = await asyncio.gather(*[_safe_search(q) for q in queries])
    state["research_results"] = [r for r in results if r]

    state["research_log"].append(f"Research complete — {len(state['research_results'])}/{len(queries)} sources retrieved.")
    await copilotkit_emit_state(config, state)

    try:
        await redis.set_research(session_id, scenario, state["research_results"])
    except Exception:
        pass

    return state
