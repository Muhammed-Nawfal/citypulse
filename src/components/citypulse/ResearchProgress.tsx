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

  if (!city) return null

  return (
    <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2 mb-2">
        {isResearching && (
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
        )}
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
          {isResearching
            ? `Researching ${city} — ${scenario}`
            : `${city} — ${scenario}`}
        </span>
      </div>

      <div className="w-full rounded-full h-1 mb-1" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${(scored / 9) * 100}%`, background: "#60a5fa" }}
        />
      </div>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
        {scored}/9 zones analysed
      </p>

      {research_log.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {research_log.slice(-3).map((line, i) => (
            <p key={i} className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
