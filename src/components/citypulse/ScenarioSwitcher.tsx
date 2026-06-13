"use client"
import { useCityStore } from "@/lib/cityStore"

const SCENARIOS = [
  "flooding",
  "power grid failure",
  "transport disruption",
  "air quality",
]

interface Props {
  inline?: boolean
}

export default function ScenarioSwitcher({ inline = false }: Props) {
  const scenario = useCityStore(s => s.scenario)

  const chips = SCENARIOS.map(s => (
    <span
      key={s}
      className="rounded-full whitespace-nowrap flex-shrink-0"
      style={{
        background: scenario === s ? "rgba(59,130,246,0.75)" : "rgba(255,255,255,0.06)",
        color: scenario === s ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)",
        fontSize: inline ? "0.68rem" : "0.75rem",
        padding: inline ? "2px 8px" : "4px 12px",
      }}
    >
      {s}
    </span>
  ))

  if (inline) {
    return (
      <div
        className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 items-center"
        style={{ scrollbarWidth: "none" }}
      >
        {chips}
      </div>
    )
  }

  return (
    <div
      className="flex gap-2 p-3 border-b overflow-x-auto"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      {chips}
    </div>
  )
}
