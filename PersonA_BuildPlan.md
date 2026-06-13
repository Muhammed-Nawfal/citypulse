# Person A — Frontend & 3D Scene Build Plan
### Branch: `persona` | CityPulse Hackathon 2026-06-13

---

## Context & Orientation

**Your role:** Everything judges see. The 3D city, the animations, the zone cards, the sidebar, the layout. You own the wow moment.

**What Person B has already shipped (backend — do not touch):**
- `citypulse_agent` registered at `http://localhost:8123/citypulse` (LangGraph over FastAPI)
- `AgentState` in `agent/src/state.py` — the shared-state contract (see §Schema Contract below)
- All 5 agent nodes: parse_query → research → risk_scoring → emit_zones → impact
- Backend emits `zone_risks` one at a time with `asyncio.sleep(0.8)` — that 800ms gap IS the staged build effect. You add no client-side stagger.

**What you're building:** A new Next.js route at `/citypulse` inside the existing repo.

**Authority order (read conflicts this way):** `PersonA_BuildPlan.md` > `SCHEMA.md` (if present) > `TeamExecutionPlan.md` (AGUI_PIPE guidance in there is SUPERSEDED — do NOT use `useCopilotAction`/`updateZoneRisk`; use CoAgent shared-state instead).

**Critical transport rule:** Use `useCoAgent<CityAgentState>({ name: "citypulse_agent" })` to sync agent state → Zustand. Do NOT use `useCopilotAction`. The `useCopilotAction`/`updateZoneRisk` code in `TeamExecutionPlan.md` is dead — wrong CopilotKit channel.

---

## Schema Contract (frozen — do not change field names)

```typescript
// Mirror of agent/src/state.py — must be byte-identical

interface ZoneRisk {
  zone_id: string        // "z_0_0" .. "z_2_2"
  score: number          // 0.0 – 1.0
  label: string          // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  evidence: string[]     // 2–3 grounded bullets
  sources: { title: string; url: string }[]  // max 3
}

interface CityAgentState {
  messages: unknown[]
  city: string
  scenario: string
  session_id: string
  status: string           // "idle" | "researching" | "scoring" | "complete"
  research_log: string[]   // live feed for sidebar
  research_results: unknown[]  // internal to backend, will be empty array on frontend
  zone_risks: ZoneRisk[]       // grows 1 zone at a time → drives 3D build
  blueprint: object | null
  impact_query: string | null
  impact_summary: string | null
  is_scenario_switch: boolean
}
```

**Zone IDs (canonical order, frozen):**
```
z_0_0  z_0_1  z_0_2   ← north row (NW, N, NE)
z_1_0  z_1_1  z_1_2   ← centre row (W, centre, E)
z_2_0  z_2_1  z_2_2   ← south row (SW, S, SE)
```

**Risk colour bands:**
```
0.0–0.3 → #4ade80  green    LOW
0.3–0.6 → #fb923c  amber    MEDIUM
0.6–0.8 → #f87171  red      HIGH
0.8–1.0 → #dc2626  deep red CRITICAL (+ pulsing emissive)
```

---

## Files You Will Create

```
src/
├── lib/
│   └── cityStore.ts                   ← Zustand store (single source of truth)
├── app/
│   └── (citypulse)/
│       ├── layout.tsx                 ← CopilotKit provider for citypulse agent
│       ├── page.tsx                   ← main split layout (3D + sidebar)
│       └── citypulse.css              ← dark theme tokens
│   └── api/
│       └── citypulse-copilotkit/
│           └── route.ts               ← runtime route → backend :8123/citypulse
└── components/
    └── citypulse/
        ├── AgentBridge.tsx            ← useCoAgent → Zustand sync
        ├── CityCanvas.tsx             ← react-three-fiber Canvas
        ├── CityGrid.tsx               ← 3×3 zone layout + ground
        ├── RiskZone.tsx               ← individual zone mesh + animation
        ├── AgentSidebar.tsx           ← sidebar shell + CopilotChat
        ├── ResearchProgress.tsx       ← live research feed + progress bar
        ├── ZoneDetailCard.tsx         ← zone click → risk card
        └── ScenarioSwitcher.tsx       ← 4-scenario quick-switch bar
```

---

## Step 1 — Install 3D & State Deps (5 min)

**Run once. Do not bump any @copilotkit/* version.**

```bash
pnpm add @react-three/fiber @react-three/drei three @react-spring/three zustand
pnpm add -D @types/three
```

Verify no `@copilotkit` version changed:
```bash
pnpm verify-pins
```

---

## Step 2 — Zustand Store: `src/lib/cityStore.ts` (10 min)

Single source of truth for the entire frontend. The AgentBridge writes here; all components read from here.

```typescript
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
        // If city or scenario changed, reset zones not in the new list
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
```

---

## Step 3 — API Route: `src/app/api/citypulse-copilotkit/route.ts` (5 min)

Connects the Next.js runtime to Person B's `citypulse_agent` on the backend.

```typescript
import { LangGraphAGUIAdapter } from "@copilotkit/runtime"
import { LangGraphAGUIAgent } from "@copilotkit/runtime"
import { NextRequest } from "next/server"

const CITYPULSE_AGENT_URL =
  process.env.CITYPULSE_AGENT_URL ?? "http://localhost:8123/citypulse"

// Forward to the LangGraph backend over AG-UI
export const POST = async (req: NextRequest) => {
  // Use the same runtime pattern as the existing pdf-analyst route
  // See: src/app/api/copilotkit-pdf/route.ts for the canonical pattern
  const { CopilotRuntime } = await import("@copilotkit/runtime")
  const runtime = new CopilotRuntime({
    remoteEndpoints: [{ url: CITYPULSE_AGENT_URL }],
  })
  const { handleRequest } = runtime
  return handleRequest(req)
}
```

> **Note:** Check `src/app/api/copilotkit-pdf/route.ts` for the exact import shape in this codebase before writing — copy that pattern exactly. The exact import names may differ from CopilotKit docs.

---

## Step 4 — CopilotKit Layout: `src/app/(citypulse)/layout.tsx` (5 min)

```tsx
import { CopilotKit } from "@copilotkit/react-core"
import "@/app/(citypulse)/citypulse.css"

export default function CityPulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/citypulse-copilotkit" agent="citypulse_agent">
      {children}
    </CopilotKit>
  )
}
```

**`src/app/(citypulse)/citypulse.css`** — dark theme:
```css
.citypulse-root {
  --cp-bg: #0a0a1a;
  --cp-surface: #0f0f2a;
  --cp-border: rgba(255,255,255,0.08);
  --cp-text: rgba(255,255,255,0.9);
  --cp-text-muted: rgba(255,255,255,0.4);
}
```

---

## Step 5 — Main Page: `src/app/(citypulse)/page.tsx` (10 min)

Split layout: 65% 3D canvas / 35% agent sidebar.

```tsx
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
```

---

## Step 6 — AgentBridge: `src/components/citypulse/AgentBridge.tsx` (15 min)

**This is the critical integration point.** Syncs CoAgent shared-state → Zustand store.

```tsx
"use client"
import { useCoAgent } from "@copilotkit/react-core"
import { useEffect } from "react"
import { useCityStore } from "@/lib/cityStore"

interface ZoneRisk {
  zone_id: string
  score: number
  label: string
  evidence: string[]
  sources: { title: string; url: string }[]
}

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

  return null  // no UI — just syncs state
}
```

**Key:** `useCoAgent` fires every time the backend emits a new state via `copilotkit_emit_state`. Since Person B appends one zone to `zone_risks` and emits per zone (with 800ms sleep), each emission fires this hook exactly once per zone — that's the staged build effect.

---

## Step 7 — CityCanvas: `src/components/citypulse/CityCanvas.tsx` (15 min)

```tsx
"use client"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import CityGrid from "./CityGrid"
import { useCityStore } from "@/lib/cityStore"

export default function CityCanvas() {
  const city = useCityStore(s => s.city)

  return (
    <Canvas
      camera={{ position: [12, 14, 12], fov: 45 }}
      shadows
      className="w-full h-full"
    >
      <color attach="background" args={["#0a0a1a"]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <fog attach="fog" args={["#0a0a1a", 30, 60]} />

      <CityGrid />

      {/* City name label — floats above the grid */}
      {city && (
        <Html position={[0, 4, 0]} center>
          <div style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textShadow: "0 0 20px rgba(100,140,255,0.5)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            {city}
          </div>
        </Html>
      )}

      {/* Locked camera — no free-roam in demo */}
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
    </Canvas>
  )
}
```

---

## Step 8 — CityGrid: `src/components/citypulse/CityGrid.tsx` (10 min)

```tsx
"use client"
import RiskZone from "./RiskZone"

const ZONE_LAYOUT: { id: string; position: [number, number, number] }[] = [
  { id: "z_0_0", position: [-6, 0, -6] },
  { id: "z_0_1", position: [0,  0, -6] },
  { id: "z_0_2", position: [6,  0, -6] },
  { id: "z_1_0", position: [-6, 0,  0] },
  { id: "z_1_1", position: [0,  0,  0] },
  { id: "z_1_2", position: [6,  0,  0] },
  { id: "z_2_0", position: [-6, 0,  6] },
  { id: "z_2_1", position: [0,  0,  6] },
  { id: "z_2_2", position: [6,  0,  6] },
]

export default function CityGrid() {
  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[22, 22]} />
        <meshStandardMaterial color="#111122" />
      </mesh>
      {/* Road grid */}
      <gridHelper args={[22, 6, "#1a1a3a", "#1a1a3a"]} />
      {ZONE_LAYOUT.map(z => (
        <RiskZone key={z.id} id={z.id} position={z.position} />
      ))}
    </group>
  )
}
```

---

## Step 9 — RiskZone: `src/components/citypulse/RiskZone.tsx` (30 min, most work)

The wow moment. Buildings rise from 0 when the agent emits the zone. CRITICAL zones pulse.

```tsx
"use client"
import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useSpring, animated } from "@react-spring/three"
import { useCityStore } from "@/lib/cityStore"
import * as THREE from "three"

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function getRiskColour(score: number): string {
  if (score >= 0.8) return "#dc2626"  // CRITICAL
  if (score >= 0.6) return "#f87171"  // HIGH
  if (score >= 0.3) return "#fb923c"  // MEDIUM
  return "#4ade80"                     // LOW
}

interface Props {
  id: string
  position: [number, number, number]
}

export default function RiskZone({ id, position }: Props) {
  const zone = useCityStore(s => s.zones[id])
  const setSelectedZone = useCityStore(s => s.setSelectedZone)
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])

  const buildings = useMemo(() => {
    const seed = id.charCodeAt(2) * 100 + id.charCodeAt(4)
    const count = 6 + Math.floor(seededRandom(seed) * 4)
    return Array.from({ length: count }, (_, i) => ({
      x: (seededRandom(seed + i * 7) - 0.5) * 3.5,
      z: (seededRandom(seed + i * 13) - 0.5) * 3.5,
      height: 0.4 + seededRandom(seed + i * 3) * 1.8,
      width: 0.3 + seededRandom(seed + i * 5) * 0.5,
    }))
  }, [id])

  // Materialisation animation — zone rises when agent emits it
  const { scaleY } = useSpring({
    scaleY: zone.visible ? 1 : 0,
    config: { tension: 120, friction: 14 },
  })

  // CRITICAL zone pulsing emissive
  useFrame(({ clock }) => {
    if (zone.label === "CRITICAL") {
      const pulse = 0.2 + Math.sin(clock.elapsedTime * 3) * 0.2
      matRefs.current.forEach(m => { if (m) m.emissiveIntensity = pulse })
    }
  })

  const colour = getRiskColour(zone.score)
  const baseEmissive = zone.score >= 0.8 ? 0.3 : 0.05

  return (
    <group position={position}>
      {buildings.map((b, i) => (
        <animated.mesh
          key={i}
          position={[b.x, b.height / 2, b.z]}
          scale-y={scaleY}
          castShadow
          onClick={() => zone.visible && setSelectedZone(id)}
          onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = "pointer" }}
          onPointerOut={() => { document.body.style.cursor = "auto" }}
        >
          <boxGeometry args={[b.width, b.height, b.width]} />
          <meshStandardMaterial
            ref={el => { matRefs.current[i] = el }}
            color={colour}
            emissive={colour}
            emissiveIntensity={baseEmissive}
            transparent
          />
        </animated.mesh>
      ))}
      {/* Zone base plate — glows with zone colour */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.5, 4.5]} />
        <meshStandardMaterial
          color={colour}
          transparent
          opacity={zone.visible ? 0.08 : 0}
        />
      </mesh>
    </group>
  )
}
```

---

## Step 10 — AgentSidebar: `src/components/citypulse/AgentSidebar.tsx` (10 min)

```tsx
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
```

---

## Step 11 — ResearchProgress: `src/components/citypulse/ResearchProgress.tsx` (10 min)

```tsx
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
      {/* Status line */}
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

      {/* Progress bar */}
      <div className="w-full rounded-full h-1 mb-1" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${(scored / 9) * 100}%`, background: "#60a5fa" }}
        />
      </div>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
        {scored}/9 zones analysed
      </p>

      {/* Live research log (last 3 lines) */}
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
```

---

## Step 12 — ZoneDetailCard: `src/components/citypulse/ZoneDetailCard.tsx` (10 min)

```tsx
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
```

---

## Step 13 — ScenarioSwitcher: `src/components/citypulse/ScenarioSwitcher.tsx` (5 min)

Cosmetic only — labels for quick reference. Clicking pre-fills the chat (optional enhancement).

```tsx
"use client"
import { useCityStore } from "@/lib/cityStore"

const SCENARIOS = [
  "flooding",
  "power grid failure",
  "transport disruption",
  "air quality",
]

export default function ScenarioSwitcher() {
  const scenario = useCityStore(s => s.scenario)

  return (
    <div className="flex gap-2 p-3 border-b overflow-x-auto" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      {SCENARIOS.map(s => (
        <span
          key={s}
          className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap"
          style={{
            background: scenario === s ? "#3b82f6" : "rgba(255,255,255,0.06)",
            color: scenario === s ? "white" : "rgba(255,255,255,0.45)",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  )
}
```

---

## Step 14 — Wire `.env` (2 min)

Add to `.env` (root or `agent/.env`):
```bash
# CityPulse agent backend URL (default: localhost)
CITYPULSE_AGENT_URL=http://localhost:8123/citypulse
```

---

## Step 15 — Smoke Test & Polish (remaining time)

**First test (after Step 13):**
```bash
pnpm dev
```
- Open `http://localhost:3000/citypulse`
- Type `London flooding risk`
- Watch: research feed updates → zones materialise one by one → click a zone → card appears

**Polish checklist:**
- [ ] All 9 zones materialise with smooth scale-Y animation
- [ ] CRITICAL zones pulse (useFrame emissive animation)
- [ ] Zone click opens ZoneDetailCard
- [ ] Research log shows live updates in sidebar
- [ ] Progress bar advances 1/9 per zone
- [ ] City name label floats above 3D grid
- [ ] Camera is locked (no accidental pan/zoom)
- [ ] "What if" follow-up triggers re-colouring of affected zones

**If behind on time — cut in this order:**
1. ScenarioSwitcher (cosmetic, not critical)
2. City name Html label (nice-to-have)
3. CRITICAL pulsing (impressive but not core)
4. Source links in ZoneDetailCard
5. **Do NOT cut:** materialisation animation, zone click, research progress bar

---

## Integration Contract with Person B

| What B emits | What A listens for |
|---|---|
| `status = "researching"` | isResearching → pulse dot, progress bar |
| `research_log` appends | Live feed in ResearchProgress |
| `zone_risks` grows 1 zone | Zone materialises in 3D (scaleY 0→1) |
| `status = "complete"` | isResearching false, bar full |
| `impact_summary` set | (optional) show in sidebar after "what if" |

**The 800ms stagger IS the staged build.** Person B's `asyncio.sleep(0.8)` in `emit_node.py` delays each zone emission. Your `useCoAgent` hook fires once per emission. You do not need `setTimeout` or manual stagger on the frontend.

---

## Demo Path (90 seconds — memorise this)

1. Type: **"London — flooding risk"**
2. Sidebar shows research feed updating
3. 3D city builds zone by zone (800ms each = ~7 seconds total)
4. High-risk zones glow red/critical-red; safe zones green
5. Click any zone → detail card shows evidence + sources
6. Type: **"What if we add a flood barrier at zone 4"**
7. Affected zones re-colour with new risk scores

**The demo path is sacred. Work backward from it.**
