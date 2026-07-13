"use client"
import { useCopilotChat } from "@copilotkit/react-core"
import { useCityStore } from "@/lib/cityStore"
import { ZONE_NAMES } from "./londonZones"
import { useRef, useEffect, KeyboardEvent, useState, forwardRef, useImperativeHandle } from "react"

function riskBadge(label: string) {
  const map: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg: "rgba(220,38,38,0.18)", color: "#f87171" },
    HIGH:     { bg: "rgba(249,115,22,0.18)", color: "#fb923c" },
    MEDIUM:   { bg: "rgba(234,179,8,0.18)",  color: "#fbbf24" },
    LOW:      { bg: "rgba(74,222,128,0.18)", color: "#4ade80" },
  }
  return map[label] ?? map.LOW
}

function riskBarColor(label: string): string {
  return { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#4ade80" }[label] ?? "#4ade80"
}

function dotColor(label: string): string {
  return { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#3b82f6", LOW: "#22c55e" }[label] ?? "#22c55e"
}

// Every suggestion MUST contain an IMPACT_TRIGGERS phrase (parse_node.py:
// "what if" | "barrier" | "intervention" | "what would happen") — anything
// else silently re-runs a fresh analysis instead of answering the question.
function suggestions(scenario: string, topName: string): string[] {
  const s = scenario.toLowerCase()
  if (s.includes("flood"))     return ["What if the Thames barrier holds?", `What if flood defences in ${topName} were upgraded?`]
  if (s.includes("power") || s.includes("grid")) return ["What if backup generators were added?", `What if ${topName}'s substation had redundancy?`]
  if (s.includes("transport")) return ["What if alternative routes were opened?", `What if ${topName} had a transport intervention?`]
  if (s.includes("air"))       return ["What if emissions were cut by half?", `What if a low-emission zone intervention covered ${topName}?`]
  return [`What if we improve ${topName}?`, "What if a mitigation intervention were funded?"]
}

interface Snapshot { zones: Record<string, any>; city: string; scenario: string; scoringSource: string }

function sourceBadge(scoringSource: string): { label: string; bg: string; color: string } | null {
  if (scoringSource === "ai") return { label: "Live AI", bg: "rgba(59,130,246,0.14)", color: "#60a5fa" }
  if (scoringSource === "fallback") return { label: "Estimated", bg: "rgba(234,179,8,0.14)", color: "#eab308" }
  return null
}
interface LocalMsg { id: string; role: "user" | "assistant"; content: string }

function extractContent(m: any): string {
  if (typeof m.content === "string") return m.content
  if (Array.isArray(m.content)) {
    return (m.content as any[])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text || "")
      .join("")
  }
  return ""
}

function AgentIcon({ size = 28 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45,
    }}>⚡</div>
  )
}

function AgentCard({ snap, onAction }: { snap: Snapshot; onAction: (q: string) => void }) {
  const scored = Object.values(snap.zones)
    .filter((z: any) => z.visible)
    .sort((a: any, b: any) => b.score - a.score) as any[]

  if (scored.length === 0) return null

  const top = scored[0]
  const topName = ZONE_NAMES[top.zone_id] || top.zone_id
  const badge = riskBadge(top.label)
  const barColor = riskBarColor(top.label)
  const sugs = suggestions(snap.scenario, topName)
  const source = sourceBadge(snap.scoringSource)

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: "14px 16px",
      width: "100%",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
          {snap.city} — {snap.scenario} analysis
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {source && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: source.bg, color: source.color, textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
            }}>
              {source.label}
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
            background: badge.bg, color: badge.color, textTransform: "uppercase" as const,
            letterSpacing: "0.05em",
          }}>
            {top.label}
          </span>
        </div>
      </div>

      {/* Headline */}
      <div style={{ fontWeight: 700, fontSize: 17, color: "white", marginBottom: 12, lineHeight: 1.3 }}>
        {topName} is highest risk
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Risk score</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
            {top.score.toFixed(2)}
          </span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${top.score * 100}%`, background: barColor, borderRadius: 2, transition: "width 1s ease" }} />
        </div>
      </div>

      {/* Zone list */}
      {scored.length > 1 && (
        <>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "12px 0 10px" }} />
          {scored.slice(0, 4).map((z: any) => {
            const name = ZONE_NAMES[z.zone_id] || z.zone_id
            const dc = dotColor(z.label)
            return (
              <div key={z.zone_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dc, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", width: 96, flexShrink: 0 }}>{name}</span>
                <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${z.score * 100}%`, background: dc, borderRadius: 2, transition: "width 1s ease" }} />
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 30, textAlign: "right" as const }}>
                  {z.score.toFixed(2)}
                </span>
              </div>
            )
          })}
        </>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginTop: 10 }}>
        {sugs.map(s => (
          <button key={s} onClick={() => onAction(s)} style={{
            background: "transparent", border: "1px solid rgba(96,165,250,0.35)",
            borderRadius: 20, padding: "5px 13px", fontSize: 11,
            color: "#60a5fa", cursor: "pointer", transition: "border-color 0.2s",
          }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Zone dot visualization for the empty state ──────────────────────────────
const ZONE_POS: Record<string, { x: number; y: number }> = {
  z_0_0: { x: 0.18, y: 0.22 }, z_0_1: { x: 0.50, y: 0.15 }, z_0_2: { x: 0.82, y: 0.22 },
  z_1_0: { x: 0.13, y: 0.52 }, z_1_1: { x: 0.50, y: 0.50 }, z_1_2: { x: 0.84, y: 0.52 },
  z_2_0: { x: 0.22, y: 0.80 }, z_2_1: { x: 0.50, y: 0.82 }, z_2_2: { x: 0.80, y: 0.80 },
}

function emptyDot(score: number, visible: boolean): string {
  if (!visible) return "rgba(255,255,255,0.12)"
  if (score >= 0.8) return "#ef4444"
  if (score >= 0.6) return "#f97316"
  if (score >= 0.3) return "#3b82f6"
  return "#22c55e"
}

export interface ChatPanelHandle {
  send: (text: string) => void
}

const ChatPanel = forwardRef<ChatPanelHandle>(function ChatPanel(_props, ref) {
  const { appendMessage, isLoading } = useCopilotChat()
  // CopilotKit's own message hooks (useCopilotMessagesContext, useCopilotChat's
  // visibleMessages) are never populated in this app's v2 single-route AG-UI
  // setup — verified empirically (both stay empty/undefined all session).
  // The agent's chat reply is read from LangGraph state instead (AgentState.messages),
  // synced via the same useCoAgent state channel that already reliably drives
  // the map/sidebar (AgentBridge.tsx -> cityStore.agentMessages).
  const agentMessages = useCityStore(s => s.agentMessages)
  const zones    = useCityStore(s => s.zones)
  const city     = useCityStore(s => s.city)
  const scenario = useCityStore(s => s.scenario)
  const scoringSource = useCityStore(s => s.scoringSource)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Local message store — optimistic user messages + synced agent replies
  const [localMessages, setLocalMessages] = useState<LocalMsg[]>([])
  const knownAgentIds = useRef(new Set<string>())

  // Snapshot zone data the moment each agent message arrives
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  // Mirror latest zone/city/scenario/scoringSource in refs so the message-watching
  // effect below can snapshot them without re-running on every zone tick.
  const latest = useRef({ zones, city, scenario, scoringSource })
  latest.current = { zones, city, scenario, scoringSource }

  // Watch the agent's LangGraph state.messages for incoming replies. Snapshot
  // is taken in the SAME pass a new assistant message is discovered, so
  // localMessages and snapshots always stay 1:1 — even if several messages
  // land in one update (e.g. on reload, when thread history already has
  // multiple past turns).
  useEffect(() => {
    for (const m of agentMessages) {
      if (m.type !== "ai") continue
      const id = String(m.id ?? "")
      if (!id || knownAgentIds.current.has(id)) continue
      const content = extractContent(m)
      if (!content) continue
      knownAgentIds.current.add(id)
      const { zones: z, city: c, scenario: s, scoringSource: src } = latest.current
      setLocalMessages(prev => [...prev, { id, role: "assistant", content }])
      setSnapshots(prev => [...prev, { zones: { ...z }, city: c || "London", scenario: s || "", scoringSource: src }])
    }
  }, [agentMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [localMessages, isLoading])

  const send = (text?: string) => {
    const t = text || inputRef.current?.value.trim()
    if (!t) return
    if (!text && inputRef.current) inputRef.current.value = ""

    const msgId = Date.now().toString()
    // Show immediately — don't wait for round-trip
    setLocalMessages(prev => [...prev, { id: msgId, role: "user", content: t }])

    appendMessage({
      id: msgId, role: "user", content: t,
      type: "TextMessage", status: { code: "Success" }, createdAt: new Date(),
      isTextMessage: () => true, isActionExecutionMessage: () => false,
      isResultMessage: () => false, isAgentStateMessage: () => false, isImageMessage: () => false,
    } as any)
  }

  useImperativeHandle(ref, () => ({ send: (text: string) => send(text) }))

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  const hasMessages = localMessages.length > 0
  let agentIdx = 0

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>

      {/* ── Messages / empty state ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {!hasMessages ? (
          /* Empty state — zone dot grid */
          <div style={{
            height: "100%", minHeight: 240,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
          }}>
            <div style={{ position: "relative", width: 180, height: 160 }}>
              {Object.entries(ZONE_POS).map(([id, pos]) => {
                const z = (zones as any)[id]
                const color = emptyDot(z?.score ?? 0, z?.visible ?? false)
                return (
                  <div key={id} style={{
                    position: "absolute",
                    left: `${pos.x * 100}%`, top: `${pos.y * 100}%`,
                    width: 10, height: 10, borderRadius: "50%",
                    background: color, transform: "translate(-50%,-50%)",
                    boxShadow: (z?.visible) ? `0 0 8px ${color}99` : "none",
                    transition: "background 0.4s, box-shadow 0.4s",
                  }} />
                )
              })}
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%,-50%)", fontSize: 28, opacity: 0.3,
              }}>🗺</div>
            </div>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center" }}>
              London risk map — tap a zone for details
            </p>
            <div style={{ display: "flex", gap: 14 }}>
              {[["#ef4444","Critical"],["#f97316","High"],["#3b82f6","Medium"],["#22c55e","Low"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.33)" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "14px 14px 4px" }}>
            {localMessages.map((m) => {
              if (m.role === "user") {
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{
                      background: "#2563eb",
                      borderRadius: "18px 18px 4px 18px",
                      padding: "10px 16px",
                      maxWidth: "78%",
                      fontSize: 13, color: "white", fontWeight: 500, lineHeight: 1.4,
                    }}>
                      {m.content}
                    </div>
                  </div>
                )
              }

              // Agent message — show rich card
              const snap = snapshots[agentIdx++]
              return (
                <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <AgentIcon />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {snap && Object.values(snap.zones).some((z: any) => z.visible) ? (
                      <AgentCard snap={snap} onAction={send} />
                    ) : (
                      <div style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "4px 14px 14px 14px",
                        padding: "10px 14px",
                        fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {m.content}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <AgentIcon />
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "4px 14px 14px 14px",
                  padding: "12px 18px",
                }}>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 18, letterSpacing: 5 }}>•••</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        background: "rgba(255,255,255,0.02)",
      }}>
        <AgentIcon size={26} />
        <input
          ref={inputRef}
          onKeyDown={onKey}
          placeholder={hasMessages ? "Ask a “what if…” follow-up" : "Ask about a city + risk scenario…"}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "rgba(255,255,255,0.88)", fontSize: 13,
          }}
        />
        <button onClick={() => send()} style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#2563eb", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontSize: 16, flexShrink: 0,
        }}>↑</button>
      </div>
    </div>
  )
})

export default ChatPanel
