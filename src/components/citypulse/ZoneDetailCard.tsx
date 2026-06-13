"use client"
import { ZoneState } from "@/lib/cityStore"

const LABEL_STYLES: Record<string, string> = {
  LOW: "text-green-400",
  MEDIUM: "text-orange-400",
  HIGH: "text-red-400",
  CRITICAL: "text-red-300 animate-pulse",
}

const SCORE_COLOURS: Record<string, string> = {
  LOW: "#4ade80",
  MEDIUM: "#fb923c",
  HIGH: "#f87171",
  CRITICAL: "#dc2626",
}

interface Props {
  zoneId: string
  zone: ZoneState
}

export default function ZoneDetailCard({ zoneId, zone }: Props) {
  const row = zoneId.split("_")[1]
  const col = zoneId.split("_")[2]
  const zoneName = `Zone ${row}-${col}`

  return (
    <div className="m-3 p-4 rounded-lg border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
            {zoneName}
          </p>
          <p className="text-white font-semibold mt-0.5">Risk Assessment</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded ${LABEL_STYLES[zone.label]}`}
          style={{ background: "rgba(255,255,255,0.06)" }}>
          {zone.label}
        </span>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          <span>Risk Score</span>
          <span>{(zone.score * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div className="h-2 rounded-full transition-all duration-700"
            style={{ width: `${zone.score * 100}%`, backgroundColor: SCORE_COLOURS[zone.label] }} />
        </div>
      </div>

      {/* Evidence */}
      {zone.evidence.length > 0 && (
        <div className="space-y-1 mb-3">
          {zone.evidence.map((e, i) => (
            <div key={i} className="flex gap-2 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
              <span style={{ color: "rgba(255,255,255,0.25)", marginTop: 2 }}>•</span>
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sources */}
      {zone.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {zone.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline">
              {s.title}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
