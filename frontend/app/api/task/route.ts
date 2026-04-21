import { NextRequest, NextResponse } from "next/server";

const ROUTER_URL = process.env.ROUTER_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Forward JWT if present (router can use it for per-user task logging in future)
    const auth = req.headers.get("Authorization");
    if (auth) headers["Authorization"] = auth;

    const upstream = await fetch(`${ROUTER_URL}/task`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Router unreachable", details: message }, { status: 502 });
  }
}
