// CopilotKit polls {basePath}/threads for thread history. This is a distinct
// Next.js route segment from the base /api/citypulse-copilotkit route (a GET
// handler on route.ts only matches the exact base path, not /threads) — this
// file is what actually answers that request instead of 404ing.
export async function GET() {
  return new Response(JSON.stringify({ threads: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
