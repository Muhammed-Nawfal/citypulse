import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { HttpAgent } from "@ag-ui/client";

const CITYPULSE_AGENT_URL =
  process.env.CITYPULSE_AGENT_URL ?? "http://localhost:8123/citypulse";

const citypulseAgent = new HttpAgent({ url: CITYPULSE_AGENT_URL });

const runtime = new CopilotRuntime({
  agents: {
    default: citypulseAgent,
    citypulse_agent: citypulseAgent,
  },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/citypulse-copilotkit",
  mode: "single-route",
});

export { handler as POST };
