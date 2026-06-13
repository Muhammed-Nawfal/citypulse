"use client"

import { useState, useRef } from "react"
import { useCopilotChat } from "@copilotkit/react-core"
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql"

const SCENARIOS = [
  { label: "flooding", query: "flood risk in London" },
  { label: "power grid failure", query: "power grid failure risk in London" },
  { label: "transport disruption", query: "transport disruption risk in London" },
]

interface Props {
  onStart: () => void
}

export default function LandingOverlay({ onStart }: Props) {
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { appendMessage } = useCopilotChat()

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    await appendMessage(
      new TextMessage({ content: trimmed, role: MessageRole.User })
    )
    onStart()
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6"
      style={{ background: "#0a0a1a" }}
    >
      {/* Brand */}
      <div className="mb-10 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-medium tracking-widest uppercase"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "#4ade80" }}
          />
          Infrastructure Risk Intelligence
        </div>
        <h1
          className="text-5xl font-bold tracking-tight mb-3"
          style={{ color: "rgba(255,255,255,0.95)" }}
        >
          CityPulse
        </h1>
        <p
          className="text-lg"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Ask about any city risk scenario to begin
        </p>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            onClick={() => send(s.query)}
            disabled={sending}
            className="px-4 py-1.5 rounded-full text-sm transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"
              ;(e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)"
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"
              ;(e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)"
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div
        className="w-full max-w-xl flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="e.g. 'London flooding risk' or 'power outage in Manchester'"
          disabled={sending}
          autoFocus
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: "rgba(255,255,255,0.85)" }}
        />
        <button
          onClick={() => send(input)}
          disabled={sending || !input.trim()}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
          style={{
            background: input.trim() && !sending
              ? "rgba(255,255,255,0.9)"
              : "rgba(255,255,255,0.1)",
          }}
        >
          {sending ? (
            <svg className="animate-spin w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              style={{ color: input.trim() ? "#0a0a1a" : "rgba(255,255,255,0.3)" }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      <p
        className="mt-6 text-xs"
        style={{ color: "rgba(255,255,255,0.2)" }}
      >
        Powered by CopilotKit
      </p>
    </div>
  )
}
