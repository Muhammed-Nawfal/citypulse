"use client"
import { useRef } from "react"
import { useCityStore } from "@/lib/cityStore"
import { AgentBridge } from "./AgentBridge"
import ZoneDetailCard from "./ZoneDetailCard"
import ScenarioSwitcher from "./ScenarioSwitcher"
import ResearchProgress from "./ResearchProgress"
import ChatPanel, { ChatPanelHandle } from "./ChatPanel"

function SidebarInner() {
  const selectedZone = useCityStore(s => s.selectedZone)
  const zones  = useCityStore(s => s.zones)
  const status = useCityStore(s => s.status)
  const chatPanelRef = useRef<ChatPanelHandle>(null)

  const isActive = status === "researching" || status === "scoring"

  // Route through ChatPanel's own send() so the query also appears as a user
  // bubble there — a separate appendMessage() call here would send the query
  // to the agent but leave no user-message bubble in the chat.
  const handleScenario = (query: string) => {
    chatPanelRef.current?.send(query)
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden" style={{ background: "#0d0d1a", color: "white" }}>
      <AgentBridge />

      {/* ── Header ── */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 16, margin: 0, letterSpacing: "-0.01em" }}>CityPulse</h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: 0, marginTop: 1 }}>
            Infrastructure risk intelligence
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Live / status badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: isActive ? "rgba(59,130,246,0.12)" : "rgba(74,222,128,0.1)",
            border: `1px solid ${isActive ? "rgba(59,130,246,0.25)" : "rgba(74,222,128,0.2)"}`,
            borderRadius: 20, padding: "3px 10px",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isActive ? "#60a5fa" : "#4ade80",
              boxShadow: isActive ? "0 0 6px #60a5fa" : "0 0 6px #4ade80",
              animation: isActive ? "pulse 1.5s infinite" : "none",
            }} />
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: isActive ? "#60a5fa" : "#4ade80",
            }}>
              {isActive ? (status === "researching" ? "Researching" : "Scoring") : "Live"}
            </span>
          </div>

          {/* Settings icon */}
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, cursor: "pointer", color: "rgba(255,255,255,0.4)",
          }}>⊞</div>
        </div>
      </div>

      {/* ── Scenario pills ── */}
      <ScenarioSwitcher onScenario={handleScenario} />

      {/* ── Live research/scoring progress ── */}
      <ResearchProgress />

      {/* ── Zone detail (shown when zone clicked on map) ── */}
      {selectedZone && zones[selectedZone]?.visible && (
        <ZoneDetailCard zoneId={selectedZone} zone={zones[selectedZone]} />
      )}

      {/* ── Chat ── */}
      <ChatPanel ref={chatPanelRef} />
    </div>
  )
}

export default function AgentSidebar() {
  return <SidebarInner />
}
