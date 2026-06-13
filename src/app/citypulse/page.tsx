"use client"

import { useState } from "react"
import CityCesiumCanvas from "@/components/citypulse/CityCesiumCanvas"
import AgentSidebar from "@/components/citypulse/AgentSidebar"
import LandingOverlay from "@/components/citypulse/LandingOverlay"

export default function CityPulsePage() {
  const [hasStarted, setHasStarted] = useState(false)

  return (
    <main className="flex h-screen overflow-hidden relative" style={{ background: "#0a0a1a" }}>
      {/* Always mounted — visibility:hidden preserves dimensions so Cesium can init */}
      <div
        className="flex-1 relative"
        style={{ visibility: hasStarted ? "visible" : "hidden" }}
      >
        <CityCesiumCanvas />
      </div>
      <div
        className="w-[380px] border-l"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          visibility: hasStarted ? "visible" : "hidden",
        }}
      >
        <AgentSidebar />
      </div>

      {/* Landing overlay sits above; unmounts once the user sends their first query */}
      {!hasStarted && (
        <LandingOverlay onStart={() => setHasStarted(true)} />
      )}
    </main>
  )
}
