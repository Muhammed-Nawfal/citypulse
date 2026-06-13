"use client"
import { CopilotChat } from "@copilotkit/react-ui"
import { useCityStore } from "@/lib/cityStore"
import { AgentBridge } from "./AgentBridge"
import ResearchProgress from "./ResearchProgress"
import ZoneDetailCard from "./ZoneDetailCard"
import ScenarioSwitcher from "./ScenarioSwitcher"

export default function AgentSidebar() {
  const selectedZone = useCityStore(s => s.selectedZone)
  const zones = useCityStore(s => s.zones)

  return (
    <div className="flex flex-col h-full" style={{ background: "#0a0a1a", color: "white" }}>
      <AgentBridge />

      {/* Compact header bar — 48px, title + inline scenario chips */}
      <div
        className="flex items-center gap-3 px-3 border-b flex-shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.08)", height: 48 }}
      >
        <div className="flex-shrink-0">
          <span className="text-sm font-bold tracking-tight">CityPulse</span>
          <span className="ml-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Risk Intel
          </span>
        </div>
        <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />
        <ScenarioSwitcher inline />
      </div>

      {/* Compact research progress bar (hidden when no city) */}
      <ResearchProgress />

      {/* Chat fills all remaining height; ZoneDetailCard overlays the bottom */}
      <div className="flex-1 overflow-hidden relative">
        <CopilotChat
          instructions="You are CityPulse, an infrastructure risk intelligence agent. When given a city and risk scenario, research it and score all 9 city zones. When asked a follow-up 'what if' question, re-evaluate affected zones."
          labels={{ title: "CityPulse Agent", initial: "Type a city and risk scenario — e.g. 'London flooding risk'" }}
          className="h-full"
        />

        {/* Zone detail slides in over the chat without consuming flex space */}
        {selectedZone && zones[selectedZone]?.visible && (
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              background: "linear-gradient(to bottom, transparent 0%, #0a0a1a 20%)",
              paddingTop: 40,
            }}
          >
            <ZoneDetailCard zoneId={selectedZone} zone={zones[selectedZone]} />
          </div>
        )}
      </div>
    </div>
  )
}
