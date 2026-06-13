"use client"
import { useCityStore } from "@/lib/cityStore"

const SCENARIOS = [
  "flooding",
  "power grid failure",
  "transport disruption",
  "air quality",
]

export default function ScenarioSwitcher() {
  const scenario = useCityStore(s => s.scenario)

  return (
    <div className="flex gap-2 p-3 border-b overflow-x-auto"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      {SCENARIOS.map(s => (
        <span
          key={s}
          className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap"
          style={{
            background: scenario === s ? "#3b82f6" : "rgba(255,255,255,0.06)",
            color: scenario === s ? "white" : "rgba(255,255,255,0.45)",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  )
}
