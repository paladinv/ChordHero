import { NextResponse } from "next/server";
import { isUltimateGuitarURL } from "../../../../lib/songSource";

const providerEndpoint = () => process.env.CHORD_HERO_AUTHORIZED_SONG_PROVIDER_URL;

export async function GET(request: Request) {
  const endpoint = providerEndpoint();
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  if (!endpoint) return NextResponse.json({ enabled: false, message: "No authorized song provider is configured." }, { status: 503 });
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}`, { headers: authorizationHeaders() });
  return NextResponse.json(await response.json(), { status: response.status });
}

export async function POST(request: Request) {
  const endpoint = providerEndpoint();
  if (!endpoint) return NextResponse.json({ enabled: false, message: "Full offline import requires an authorized provider." }, { status: 503 });
  const body = await request.json() as { sourceUrl?: string };
  if (!body.sourceUrl || !isUltimateGuitarURL(body.sourceUrl)) return NextResponse.json({ message: "Only Ultimate Guitar source URLs are accepted." }, { status: 400 });
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/import`, { method: "POST", headers: { ...authorizationHeaders(), "content-type": "application/json" }, body: JSON.stringify(body) });
  return NextResponse.json(await response.json(), { status: response.status });
}

function authorizationHeaders(): HeadersInit {
  const token = process.env.CHORD_HERO_AUTHORIZED_SONG_PROVIDER_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}
