"""Blueprint persistence tests — verifies blueprint survives Redis round-trip.

Run: uv run pytest tests/test_blueprint.py -v
"""
import pytest
from dotenv import load_dotenv

load_dotenv()

from src.services.redis_service import RedisService
from src.models import CityStateModel, SceneBlueprint, SceneNode, ZoneRiskModel


@pytest.fixture
def redis():
    return RedisService()


@pytest.mark.asyncio
async def test_blueprint_persists_through_redis(redis):
    state = {
        "city": "London",
        "scenario": "power grid",
        "blueprint": {
            "scene_type": "network_graph",
            "title": "UK Power Grid",
            "camera_preset": "isometric",
            "nodes": [
                {"id": "n1", "label": "Drax", "type": "hub",
                 "risk_score": 0.3, "position": {"x": 0, "y": 0, "z": 0}, "size": 1.0}
            ],
            "connections": [],
        },
        "zones": {},
        "last_updated": "2026-06-13T12:00:00Z",
    }
    await redis.set_city_state("test_blueprint", state, ttl=60)
    result = await redis.get_city_state("test_blueprint")

    assert result is not None
    assert result["blueprint"]["scene_type"] == "network_graph"
    assert result["blueprint"]["nodes"][0]["label"] == "Drax"


@pytest.mark.asyncio
async def test_blueprint_validates_with_pydantic(redis):
    """Full round-trip: Pydantic model → Redis → Pydantic model."""
    blueprint = SceneBlueprint(
        scene_type="city_grid",
        title="London — Flooding Risk",
        nodes=[
            SceneNode(id="z_0_0", label="NW London", type="zone",
                      risk_score=0.85, position={"x": -6, "y": 0, "z": -6})
        ],
    )
    state = CityStateModel(
        city="London",
        scenario="flooding",
        blueprint=blueprint,
        zones={},
    )

    await redis.set_city_state("test_pydantic_bp", state.model_dump(), ttl=60)
    result = await redis.get_city_state("test_pydantic_bp")

    assert result is not None
    restored = CityStateModel(**result)
    assert restored.blueprint.scene_type == "city_grid"
    assert restored.blueprint.nodes[0].risk_score == 0.85


@pytest.mark.asyncio
async def test_city_state_without_blueprint(redis):
    """Blueprint is optional — state without it must still work."""
    state = CityStateModel(city="Birmingham", scenario="air quality", zones={})
    await redis.set_city_state("test_no_bp", state.model_dump(), ttl=60)
    result = await redis.get_city_state("test_no_bp")

    assert result is not None
    assert result["blueprint"] is None
    assert result["city"] == "Birmingham"
