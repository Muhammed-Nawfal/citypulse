# Widget catalog + fixtures

Each widget here is a pair of files:

| File | Role |
|---|---|
| `<name>.json` | Catalog entry. The v0.9 component array (the schema). Includes the `pythonTool` pointer back to the tool that emits it. |
| `<name>.fixture.json` | Named test scenario. A complete envelope sequence (`createSurface` → `updateComponents` → `updateDataModel`) the renderer can hydrate without an LLM. |

Fixtures are what `pnpm test:widgets` and `OFFLINE=1` mode consume.

## Add a new widget

1. Copy the closest existing pair (`flight_card.*` for branded catalog, `product_card.*` for base v0.9 catalog).
2. Edit the `schema` array — that's the A2UI component tree.
3. Build a matching fixture by replacing only the `updateDataModel.value`.
4. Wire a Python tool that returns the same envelopes (template: `agent/src/a2ui_fixed_schema.py:search_flights`).
5. Run `pnpm validate-widget agent/src/widgets/<name>.json`.

## Canonical pairs

- **`flight_card.*`** — branded `FlightCard` from `copilotkit://app-dashboard-catalog`. Fixed-schema canonical example. Backed by `search_flights`.
- **`product_card.*`** — composed from the base v0.9 catalog (`Card`, `Column`, `Row`, `Image`, `Text`, `Button`). Shopping domain. Backed by `search_products`.
