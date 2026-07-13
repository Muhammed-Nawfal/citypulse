"use client"
import { useCityStore } from "@/lib/cityStore"

export default function ResearchProgress() {
  const city = useCityStore(s => s.city)
  const scenario = useCityStore(s => s.scenario)
  const status = useCityStore(s => s.status)
  const research_log = useCityStore(s => s.research_log)
  const zones = useCityStore(s => s.zones)

  const scored = Object.values(zones).filter(z => z.visible).length
  const isActive = status === "researching" || status === "scoring"

  if (!city || (!isActive && scored === 0)) return null

  return (
    <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", flexShrink: 0 }}>
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 rounded-full h-1" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-1 rounded-full transition-all duration-700"
            style={{ width: `${(scored / 9) * 100}%`, background: scored === 9 ? "#4ade80" : "#60a5fa" }}
          />
        </div>
        <span className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.35)" }}>
          {scored}/9
        </span>
      </div>

      {/* Last research log line */}
      {research_log.length > 0 && isActive && (
        <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
          {research_log[research_log.length - 1]}
        </p>
      )}
    </div>
  )
}
