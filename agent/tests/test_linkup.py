"""Linkup API tests — verifies your key works and returns usable data.

Run: uv run pytest tests/test_linkup.py -v

Note: These tests hit the live Linkup API and consume credits (~0.006 per query).
If your account has no credits, all tests will skip automatically.
Top up at https://app.linkup.so/billing
"""
import pytest
from dotenv import load_dotenv

load_dotenv()

from src.services.linkup_service import LinkupService

try:
    from linkup._errors import LinkupInsufficientCreditError
except ImportError:
    LinkupInsufficientCreditError = Exception


def _skip_if_no_credits(exc: Exception) -> None:
    if "insufficient" in str(exc).lower() or "funds" in str(exc).lower():
        pytest.skip(f"Linkup out of credits — top up at https://app.linkup.so/billing: {exc}")
    raise exc


@pytest.fixture
def linkup():
    return LinkupService()


@pytest.mark.asyncio
async def test_search_returns_answer(linkup):
    try:
        result = await linkup.search("London flooding infrastructure risk 2024")
    except Exception as e:
        _skip_if_no_credits(e)

    assert result is not None, "Linkup returned None"
    assert "answer" in result, "No 'answer' field in Linkup response"
    assert len(result["answer"]) > 20, "Answer is suspiciously short"


@pytest.mark.asyncio
async def test_search_returns_sources(linkup):
    try:
        result = await linkup.search("Thames flood barrier capacity UK")
    except Exception as e:
        _skip_if_no_credits(e)

    assert result is not None
    assert "sources" in result, "No 'sources' field in Linkup response"
    assert isinstance(result["sources"], list)


@pytest.mark.asyncio
async def test_search_known_good_query(linkup):
    """The demo query — must always return good data."""
    try:
        result = await linkup.search("London flooding risk zones east west")
    except Exception as e:
        _skip_if_no_credits(e)

    assert result is not None
    assert len(result.get("answer", "")) > 50, "Demo query returned thin data — try a different query"


@pytest.mark.asyncio
async def test_search_fallback_on_bad_query(linkup):
    """Even a weird query should not crash — even with weird input."""
    try:
        result = await linkup.search("xyzzy nonsense query 12345")
    except Exception as e:
        _skip_if_no_credits(e)

    assert result is not None, "Linkup crashed on unusual query — check error handling"
