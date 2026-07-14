"use client"
import { useCityStore } from "@/lib/cityStore"

const SCENARIOS = [
  { label: "Flooding",     match: "flooding",            query: "Analyse London flooding risk" },
  { label: "Power grid",   match: "power grid failure",  query: "Analyse London power grid failure risk" },
  { label: "Transport",    match: "transport disruption",query: "Analyse London transport disruption risk" },
  { label: "Air quality",  match: "air quality",         query: "Analyse London air quality risk" },
  { label: "Extreme heat", match: "extreme heat",        query: "Analyse London extreme heat risk" },
  { label: "Storm surge",  match: "storm surge",         query: "Analyse London storm surge risk" },
]

export default function ScenarioSwitcher({ onScenario }: { onScenario: (query: string) => void }) {
  const scenario = useCityStore(s => s.scenario)

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 8,
      padding: "10px 14px 10px",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      flexShrink: 0,
    }}>
      {SCENARIOS.map(s => {
        const active = scenario === s.match
        return (
          <button
            key={s.label}
            onClick={() => onScenario(s.query)}
            style={{
              fontSize: 12, padding: "5px 14px", borderRadius: 20,
              cursor: "pointer", whiteSpace: "nowrap",
              fontWeight: active ? 600 : 400,
              background: active ? "#2563eb" : "rgba(255,255,255,0.05)",
              color:      active ? "white"    : "rgba(255,255,255,0.45)",
              border:     active ? "1px solid #2563eb" : "1px solid rgba(255,255,255,0.08)",
              transition: "all 0.15s",
            }}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
