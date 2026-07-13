"use client"
import { useCoAgent } from "@copilotkit/react-core"
import { useEffect } from "react"
import { useCityStore, type ZoneRisk } from "@/lib/cityStore"

interface AgentMessage {
  type: string   // LangChain message type: "human" | "ai" | ...
  content: string
  id: string | null
}

interface CityAgentState {
  city?: string
  scenario?: string
  status?: string
  research_log?: string[]
  zone_risks?: ZoneRisk[]
  scoring_source?: string
  messages?: AgentMessage[]
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
      scoring_source: state.scoring_source,
      agent_messages: state.messages,
    })
  }, [state, syncFromAgent])

  return null
}
