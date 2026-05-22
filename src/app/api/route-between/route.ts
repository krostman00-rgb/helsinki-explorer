import { NextRequest, NextResponse } from "next/server";

const DIGITRANSIT_URL =
  "https://api.digitransit.fi/routing/v2/hsl/gtfs/v1";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fromLat     = p.get("fromLat");
  const fromLng     = p.get("fromLng");
  const toLat       = p.get("toLat");
  const toLng       = p.get("toLng");
  const timeParam   = p.get("time") ?? "09:00:00"; // e.g. "09:30:00"

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Use today's date so we get correct weekday schedules
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  const apiKey = process.env.DIGITRANSIT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 503 });
  }

  const query = `{
    plan(
      from: { lat: ${fromLat}, lon: ${fromLng} }
      to:   { lat: ${toLat},   lon: ${toLng}   }
      date: "${today}"
      time: "${timeParam}"
      numItineraries: 1
      transportModes: [
        { mode: WALK }
        { mode: TRAM }
        { mode: BUS }
        { mode: SUBWAY }
        { mode: FERRY }
      ]
    ) {
      itineraries {
        duration
        legs {
          mode
          duration
          distance
          route { shortName }
          from { name }
          to   { name }
        }
      }
    }
  }`;

  try {
    const res = await fetch(DIGITRANSIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "digitransit-subscription-key": apiKey,
      },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 }, // cache 1 h — routes don't change often
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Digitransit ${res.status}` }, { status: 502 });
    }

    const json = await res.json();

    if (json.errors) {
      console.error("Digitransit GraphQL errors:", JSON.stringify(json.errors));
    }

    const itinerary = json.data?.plan?.itineraries?.[0];

    if (!itinerary) {
      console.error("No itinerary in response:", JSON.stringify(json).slice(0, 400));
      return NextResponse.json({ error: "No route found" }, { status: 404 });
    }

    const totalMin = Math.round((itinerary.duration as number) / 60);

    type RawLeg = { mode: string; duration: number; route: { shortName: string } | null; from: { name: string }; to: { name: string } };
    const rawLegs = itinerary.legs as RawLeg[];

    // Build simplified leg list — skip walks under 90 seconds
    const legs = rawLegs
      .filter(l => l.mode !== "WALK" || l.duration >= 90)
      .map(l => ({
        mode:     l.mode,
        durationMin: Math.max(1, Math.round(l.duration / 60)),
        line:     l.route?.shortName ?? null,
        fromStop: l.from?.name ?? null,
        toStop:   l.to?.name ?? null,
      }));

    return NextResponse.json({ totalMin, legs });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
