import { CopilotKit } from "@copilotkit/react-core"
import "@/app/(citypulse)/citypulse.css"

export default function CityPulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/citypulse-copilotkit" agent="citypulse_agent">
      {children}
    </CopilotKit>
  )
}
