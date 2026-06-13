"use client"
import { useCityStore } from "@/lib/cityStore"

export default function ResearchProgress() {
  const city = useCityStore(s => s.city)
  const scenario = useCityStore(s => s.scenario)
  const status = useCityStore(s => s.status)
  const research_log = useCityStore(s => s.research_log)
  const zones = useCityStore(s => s.zones)

  const scored = Object.values(zones).filter(z => z.visible).length
  const isResearching = status === "researching" || status === "scoring"
  const lastLog = research_log[research_log.length - 1]

  if (!city) return null

  return (
    <div
      className="px-3 py-2 border-b flex-shrink-0"
      style={{ borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center gap-2">
        {isResearching && (
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
        )}
        <span className="text-xs truncate flex-1" style={{ color: "rgba(255,255,255,0.55)" }}>
          {isResearching ? `Researching ${city}` : `${city} — ${scenario}`}
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
          {scored}/9
        </span>
      </div>

      <div className="w-full rounded-full h-0.5 mt-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-0.5 rounded-full transition-all duration-500"
          style={{ width: `${(scored / 9) * 100}%`, background: "#60a5fa" }}
        />
      </div>

      {isResearching && lastLog && (
        <p
          className="truncate mt-1"
          style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.65rem" }}
        >
          {lastLog}
        </p>
      )}
    </div>
  )
}
