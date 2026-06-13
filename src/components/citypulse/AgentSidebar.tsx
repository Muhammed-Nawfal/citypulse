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
      {/* AgentBridge is invisible — syncs CoAgent state → Zustand */}
      <AgentBridge />

      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <h1 className="text-lg font-bold">CityPulse</h1>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          Infrastructure Risk Intelligence
        </p>
      </div>

      {/* Scenario switcher */}
      <ScenarioSwitcher />

      {/* Research progress feed */}
      <ResearchProgress />

      {/* Zone detail card (shown when a zone is clicked) */}
      {selectedZone && zones[selectedZone]?.visible && (
        <ZoneDetailCard zoneId={selectedZone} zone={zones[selectedZone]} />
      )}

      {/* CopilotKit chat */}
      <div className="flex-1 overflow-hidden">
        <CopilotChat
          instructions="You are CityPulse, an infrastructure risk intelligence agent. When given a city and risk scenario, research it and score all 9 city zones. When asked a follow-up 'what if' question, re-evaluate affected zones."
          labels={{ title: "CityPulse Agent", initial: "Type a city and risk scenario — e.g. 'London flooding risk'" }}
          className="h-full"
        />
      </div>
    </div>
  )
}
