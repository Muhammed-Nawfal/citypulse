import { create } from "zustand"

export type RiskLabel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export interface ZoneRisk {
  zone_id: string
  score: number
  label: RiskLabel
  evidence: string[]
  sources: { title: string; url: string }[]
}

export interface ZoneState extends ZoneRisk {
  visible: boolean    // true once agent has emitted this zone
}

interface CityStore {
  city: string
  scenario: string
  status: string
  research_log: string[]
  zones: Record<string, ZoneState>
  selectedZone: string | null
  // actions
  syncFromAgent: (agentState: {
    city?: string
    scenario?: string
    status?: string
    research_log?: string[]
    zone_risks?: ZoneRisk[]
  }) => void
  setSelectedZone: (id: string | null) => void
  reset: () => void
}

const ZONE_IDS = [
  "z_0_0","z_0_1","z_0_2",
  "z_1_0","z_1_1","z_1_2",
  "z_2_0","z_2_1","z_2_2",
]

const emptyZone = (id: string): ZoneState => ({
  zone_id: id, score: 0, label: "LOW", evidence: [], sources: [], visible: false,
})

export const useCityStore = create<CityStore>((set, get) => ({
  city: "",
  scenario: "",
  status: "idle",
  research_log: [],
  zones: Object.fromEntries(ZONE_IDS.map(id => [id, emptyZone(id)])),
  selectedZone: null,

  syncFromAgent: ({ city, scenario, status, research_log, zone_risks }) => {
    set(s => {
      const next: Partial<CityStore> = {}
      if (city !== undefined) next.city = city
      if (scenario !== undefined) next.scenario = scenario
      if (status !== undefined) next.status = status
      if (research_log !== undefined) next.research_log = research_log
      if (zone_risks !== undefined) {
        const zones = { ...s.zones }
        for (const z of zone_risks) {
          zones[z.zone_id] = { ...z, visible: true }
        }
        next.zones = zones
      }
      return next
    })
  },

  setSelectedZone: (selectedZone) => set({ selectedZone }),

  reset: () => set({
    city: "", scenario: "", status: "idle", research_log: [],
    zones: Object.fromEntries(ZONE_IDS.map(id => [id, emptyZone(id)])),
    selectedZone: null,
  }),
}))
