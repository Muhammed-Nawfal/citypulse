"use client"
import CityCanvas from "@/components/citypulse/CityCanvas"
import AgentSidebar from "@/components/citypulse/AgentSidebar"

export default function CityPulsePage() {
  return (
    <main className="flex h-screen overflow-hidden" style={{ background: "#0a0a1a" }}>
      <div className="flex-1 relative">
        <CityCanvas />
      </div>
      <div className="w-[380px] border-l" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <AgentSidebar />
      </div>
    </main>
  )
}
