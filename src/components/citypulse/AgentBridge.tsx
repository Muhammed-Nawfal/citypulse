"use client"
import { useCoAgent } from "@copilotkit/react-core"
import { useEffect } from "react"
import { useCityStore, type ZoneRisk } from "@/lib/cityStore"

interface CityAgentState {
  city?: string
  scenario?: string
  status?: string
  research_log?: string[]
  zone_risks?: ZoneRisk[]
}

export function AgentBridge() {
  const { state } = useCoAgent<CityAgentState>({ name: "citypulse_agent" })
  const syncFromAgent = useCityStore(s => s.syncFromAgent)

  useEffect(() => {
    if (!state) return
    syncFromAgent({
      city: state.city,
      scenario: state.scenario,
      status: state.status,
      research_log: state.research_log,
      zone_risks: state.zone_risks,
    })
  }, [state, syncFromAgent])

  return null
}
