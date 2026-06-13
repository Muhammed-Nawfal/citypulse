"""Pydantic models for CityPulse — validates agent output before it hits Redis or frontend.

Byte-exact to SCHEMA.md. Score bands: LOW 0–0.3, MEDIUM 0.3–0.6, HIGH 0.6–0.8,
CRITICAL 0.8–1.0. Label is always derived from score — if they conflict, score wins.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Risk label ───────────────────────────────────────────────────────────────

class RiskLabel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


def _label_from_score(score: float) -> RiskLabel:
    if score >= 0.8:
        return RiskLabel.CRITICAL
    if score >= 0.6:
        return RiskLabel.HIGH
    if score >= 0.3:
        return RiskLabel.MEDIUM
    return RiskLabel.LOW


# ── Shared primitives ────────────────────────────────────────────────────────

class Source(BaseModel):
    title: str
    url: str


# ── Zone risk ────────────────────────────────────────────────────────────────

class ZoneRiskModel(BaseModel):
    zone_id: str
    score: float = Field(ge=0.0, le=1.0)
    label: RiskLabel
    evidence: list[str] = Field(default_factory=list, max_length=4)
    sources: list[Source] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def sync_label(self) -> ZoneRiskModel:
        """Label is always derived from score — score wins on conflict."""
        self.label = _label_from_score(self.score)
        return self


# ── Blueprint ────────────────────────────────────────────────────────────────

class SceneNode(BaseModel):
    id: str
    label: str
    type: str
    risk_score: float = Field(ge=0.0, le=1.0, default=0.0)
    position: dict = Field(default_factory=lambda: {"x": 0, "y": 0, "z": 0})
    size: float = 1.0


class SceneConnection(BaseModel):
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    risk_score: float = Field(ge=0.0, le=1.0, default=0.0)

    model_config = {"populate_by_name": True}


class SceneBlueprint(BaseModel):
    scene_type: str
    title: str
    camera_preset: str = "isometric"
    nodes: list[SceneNode] = Field(default_factory=list)
    connections: list[SceneConnection] = Field(default_factory=list)


# ── City state (what gets stored in Redis) ───────────────────────────────────

class CityStateModel(BaseModel):
    city: str
    scenario: str
    blueprint: Optional[SceneBlueprint] = None
    zones: dict[str, ZoneRiskModel] = Field(default_factory=dict)
    last_updated: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @field_validator("zones")
    @classmethod
    def validate_zone_ids(cls, v: dict) -> dict:
        valid = {f"z_{r}_{c}" for r in range(3) for c in range(3)}
        bad = set(v.keys()) - valid
        if bad:
            raise ValueError(f"Invalid zone IDs: {bad}")
        return v


# ── AG-UI event payload (zone score streamed from agent to frontend) ─────────

class ZoneScoreEvent(BaseModel):
    type: str = "zone_score_update"
    zone_id: str
    score: float = Field(ge=0.0, le=1.0)
    label: str
    evidence: list[str]
    sources: list[dict]
