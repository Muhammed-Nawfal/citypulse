"""
Tool bundle for the default domain (flights + dashboards + todos).

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CUSTOMIZATION SEAM #5 — Switch domain (default branch)
# Pattern to copy: agent/src/domains/shopping/tools.py
# These re-export the inherited base tools so main.py can switch
# the entire tool bundle by changing one env var (DOMAIN=...).
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from src.query import query_data
from src.todos import todo_tools
from src.a2ui_dynamic_schema import generate_a2ui
from src.a2ui_fixed_schema import search_flights

default_tools = [query_data, *todo_tools, generate_a2ui, search_flights]
