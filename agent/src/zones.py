"""Canonical zone metadata — single source of truth for zone names/descriptions.

Both scoring_node.py and emit_node.py need zone display names; keeping one
copy here means renaming/adding a zone is a one-line change instead of a
multi-file, multi-language edit. ZONE_IDS/order stays in state.py (frozen
schema); this module only adds the human-readable metadata layer.
"""

# zone_id -> (display name, short geographic/infrastructure description)
ZONE_CONTEXT: dict[str, tuple[str, str]] = {
    "z_0_0": ("Notting Hill", "northwest residential, Victorian-era water and gas infrastructure"),
    "z_0_1": ("Camden", "north hub, canal network and major rail interchange"),
    "z_0_2": ("Hackney", "northeast, high-density mixed-use with legacy industrial drainage"),
    "z_1_0": ("Kensington", "west affluent zone, aging utility mains beneath protected streets"),
    "z_1_1": ("City of London", "central financial core, most critical infrastructure concentration"),
    "z_1_2": ("Whitechapel", "east, rapid densification over historic Thames tributary channels"),
    "z_2_0": ("Battersea", "southwest riverside, major regeneration on former industrial land"),
    "z_2_1": ("Lambeth", "south, low-lying Thames floodplain with high population exposure"),
    "z_2_2": ("Southwark", "southeast riverside borough, historic flood plain, dense housing"),
}

ZONE_NAMES: dict[str, str] = {zid: name for zid, (name, _desc) in ZONE_CONTEXT.items()}
