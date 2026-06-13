"""Demo seed script — run this before the demo.

Pre-loads Redis with known-good London flooding research so the demo
never depends on live Linkup latency on stage. If Linkup is slow or
rate-limited, the agent reads from this cache instead.

Usage:
    cd agent/
    uv run python scripts/seed_demo.py

Run once before the demo. TTL is 24 hours.
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from src.services.redis_service import RedisService

DEMO_SESSION = "demo_session_citypulse"

DEMO_RESEARCH = [
    {
        "query": "London flooding infrastructure risk 2024",
        "answer": (
            "London faces significant flooding risk particularly in eastern zones. "
            "The Thames Barrier has been raised over 200 times since 1982, with increasing "
            "frequency in recent years. The Environment Agency classifies zones in east London "
            "as highest tidal flood risk category. Underground infrastructure including the "
            "Jubilee Line is vulnerable to sustained flooding above 2.1m surge."
        ),
        "sources": [
            {"title": "Environment Agency", "url": "https://www.gov.uk/government/organisations/environment-agency"},
            {"title": "Thames Barrier Operations", "url": "https://www.gov.uk/guidance/the-thames-barrier"},
        ],
    },
    {
        "query": "London flooding vulnerability report emergency planning",
        "answer": (
            "The City of London and Tower Hamlets are identified as high-risk zones in the "
            "London Climate Resilience Review 2023. Canary Wharf underground infrastructure "
            "is at risk below 2.1m surge. The GLA has invested £300m in flood defences "
            "since 2020, with focus on eastern and southern boroughs."
        ),
        "sources": [
            {"title": "GLA Climate Resilience", "url": "https://www.london.gov.uk/climate-resilience"},
            {"title": "BBC News London Flooding", "url": "https://www.bbc.co.uk/news/uk-england-london"},
        ],
    },
    {
        "query": "London flooding historical incidents damage",
        "answer": (
            "Major flooding events in London include the 1953 North Sea flood, "
            "the 2000 and 2007 summer floods affecting south and west London, and "
            "the 2021 tube station flooding. North-west zones have seen increased "
            "surface water flooding due to urban heat island effects."
        ),
        "sources": [
            {"title": "London Assembly Flood Report", "url": "https://www.london.gov.uk/flood-report"},
            {"title": "Reuters UK Infrastructure", "url": "https://reuters.com/uk-infrastructure"},
        ],
    },
    {
        "query": "London infrastructure flooding zone analysis",
        "answer": (
            "East London (zones z_1_2, z_2_2, z_0_2) carry the highest flood risk due to "
            "proximity to the Thames estuary and low elevation. Central London (z_1_1) has "
            "moderate risk with robust Victorian-era drainage. West and north-west zones "
            "(z_0_0, z_1_0) face surface water flooding from impermeable urban surfaces."
        ),
        "sources": [
            {"title": "Transport for London Resilience", "url": "https://tfl.gov.uk/resilience"},
        ],
    },
    {
        "query": "London emergency planning flooding government report recommendations",
        "answer": (
            "The UK National Flood Risk Assessment 2023 recommends prioritising flood "
            "defences in east London. Current Thames Barrier expected to protect until 2070 "
            "without upgrades. Government has committed to reviewing barrier capacity by 2030. "
            "Local authorities required to maintain surface water management plans."
        ),
        "sources": [
            {"title": "DEFRA Flood Risk", "url": "https://www.gov.uk/government/collections/flood-risk-management"},
            {"title": "Environment Agency 2023", "url": "https://www.gov.uk/ea-flood-report-2023"},
        ],
    },
]

DEMO_CITY_STATE = {
    "city": "London",
    "scenario": "flooding",
    "blueprint": {
        "scene_type": "city_grid",
        "title": "London — Flooding Risk",
        "camera_preset": "isometric",
        "nodes": [],
        "connections": [],
    },
    "zones": {
        "z_0_0": {"zone_id": "z_0_0", "score": 0.45, "label": "MEDIUM", "evidence": ["Surface water flooding risk from impermeable urban surfaces", "North-west elevation provides some protection"], "sources": []},
        "z_0_1": {"zone_id": "z_0_1", "score": 0.35, "label": "MEDIUM", "evidence": ["Moderate flood risk", "Victorian drainage partially adequate"], "sources": []},
        "z_0_2": {"zone_id": "z_0_2", "score": 0.72, "label": "HIGH",   "evidence": ["Proximity to Thames estuary", "Low elevation north-east zone"], "sources": []},
        "z_1_0": {"zone_id": "z_1_0", "score": 0.40, "label": "MEDIUM", "evidence": ["West London surface water issues", "Urban heat island effect worsening"], "sources": []},
        "z_1_1": {"zone_id": "z_1_1", "score": 0.30, "label": "LOW",    "evidence": ["Central London robust Victorian drainage", "Higher elevation than eastern zones"], "sources": []},
        "z_1_2": {"zone_id": "z_1_2", "score": 0.83, "label": "CRITICAL","evidence": ["Canary Wharf underground at risk below 2.1m surge", "Environment Agency: highest tidal flood category", "Thames Barrier warnings issued Q4 2023"], "sources": [{"title": "Environment Agency", "url": "https://www.gov.uk/ea"}]},
        "z_2_0": {"zone_id": "z_2_0", "score": 0.38, "label": "MEDIUM", "evidence": ["South-west moderate risk", "Improved drainage since 2020"], "sources": []},
        "z_2_1": {"zone_id": "z_2_1", "score": 0.55, "label": "MEDIUM", "evidence": ["South London river tributaries", "Increased risk from climate change projections"], "sources": []},
        "z_2_2": {"zone_id": "z_2_2", "score": 0.78, "label": "HIGH",   "evidence": ["South-east proximity to Thames", "Low-lying areas below tidal surge line"], "sources": []},
    },
    "last_updated": "2026-06-13T10:00:00Z",
}


async def seed():
    r = RedisService()

    if not await r.health_check():
        print("FAIL: Redis not connected — check REDIS_URL in agent/.env")
        return

    # Seed research cache
    await r.set_research(DEMO_SESSION, "flooding", DEMO_RESEARCH, ttl=86400)
    print(f"✓ Seeded research cache ({len(DEMO_RESEARCH)} queries)")

    # Seed city state
    await r.set_city_state(DEMO_SESSION, DEMO_CITY_STATE, ttl=86400)
    print(f"✓ Seeded city state (9 zones scored)")

    # Verify round-trip
    check = await r.get_city_state(DEMO_SESSION)
    assert check["city"] == "London", "Seed verification failed"
    print(f"✓ Verified: {check['city']} — {check['scenario']}")
    print(f"\nDemo session ID: {DEMO_SESSION}")
    print("TTL: 24 hours. Re-run this script if the demo is more than 24h away.")


if __name__ == "__main__":
    asyncio.run(seed())
