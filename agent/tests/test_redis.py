"""Redis round-trip tests — no frontend needed, pure infrastructure.

Run: uv run pytest tests/test_redis.py -v
"""
import pytest
import pytest_asyncio
from dotenv import load_dotenv

load_dotenv()

from src.services.redis_service import RedisService


@pytest.fixture
def redis():
    return RedisService()


@pytest.mark.asyncio
async def test_health_check(redis):
    ok = await redis.health_check()
    assert ok, "Redis ping failed — check REDIS_URL in agent/.env"


@pytest.mark.asyncio
async def test_city_state_round_trip(redis):
    state = {
        "city": "London",
        "scenario": "flooding",
        "zones": {"z_0_0": {"zone_id": "z_0_0", "score": 0.85, "label": "CRITICAL", "evidence": [], "sources": []}},
        "last_updated": "2026-06-13T11:00:00Z",
    }
    await redis.set_city_state("test_session", state, ttl=60)
    result = await redis.get_city_state("test_session")

    assert result is not None, "Redis returned None — set_city_state failed"
    assert result["city"] == "London"
    assert result["scenario"] == "flooding"
    assert result["zones"]["z_0_0"]["score"] == 0.85


@pytest.mark.asyncio
async def test_research_cache_round_trip(redis):
    research = [
        {"query": "London flooding risk 2024", "answer": "High flood risk in east London.", "sources": []},
        {"query": "Thames barrier capacity", "answer": "Raised 200 times since 1982.", "sources": []},
    ]
    await redis.set_research("test_session", "flooding", research, ttl=60)
    result = await redis.get_research("test_session", "flooding")

    assert result is not None, "Redis returned None — set_research failed"
    assert len(result) == 2
    assert result[0]["query"] == "London flooding risk 2024"


@pytest.mark.asyncio
async def test_cache_miss_returns_none(redis):
    result = await redis.get_city_state("nonexistent_session_xyz")
    assert result is None, "Expected None for missing key"


@pytest.mark.asyncio
async def test_message_thread(redis):
    await redis.append_message("test_session", {"role": "user", "content": "London flooding"})
    await redis.append_message("test_session", {"role": "assistant", "content": "Researching..."})
    messages = await redis.get_messages("test_session")

    assert len(messages) >= 2
    assert messages[0]["role"] == "user"
