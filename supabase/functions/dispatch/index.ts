// RYDZ Server-Side Dispatch Engine
//
// Uses Apple Maps Server API for real driving ETAs (same MapKit routing
// the driver's Swift plugin uses). Zero haversine.
//
// Chain-walks each driver: current ride legs (uses driver_eta_secs from
// Swift if available) → queued rides (Apple Maps ETA per leg) → rider's
// pickup (Apple Maps ETA). Picks driver with shortest total ETA.
// Atomically assigns via assign_ride_to_driver RPC (row-lock).
//
// Required env vars:
//   MAPKIT_KEY_ID       - MapKit Server key ID from Apple Developer
//   MAPKIT_P8_KEY       - .p8 private key contents
//   APNS_TEAM_ID        - Apple Team ID (reused from push config)
//   SUPABASE_URL        - auto-set
//   SUPABASE_SERVICE_ROLE_KEY - auto-set

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const MAPKIT_KEY_ID = Deno.env.get("MAPKIT_KEY_ID") || "";
const MAPKIT_P8_KEY = Deno.env.get("MAPKIT_P8_KEY") || "";
const TEAM_ID = Deno.env.get("APNS_TEAM_ID") || "";

// ── Apple Maps Server API auth (identical signing to APNs JWT) ──────────

let _mapkitJwt: { token: string; exp: number } | null = null;

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64url(input: string | Uint8Array): string {
  let str: string;
  if (typeof input === "string") {
    str = btoa(input);
  } else {
    let s = "";
    for (let i = 0; i < input.length; i++) s += String.fromCharCode(input[i]);
    str = btoa(s);
  }
  return str.replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getMapkitJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_mapkitJwt && _mapkitJwt.exp > now + 60) return _mapkitJwt.token;

  const header = { alg: "ES256", kid: MAPKIT_KEY_ID, typ: "JWT" };
  const payload = { iss: TEAM_ID, iat: now, exp: now + 3600 };
  const hB64 = base64url(JSON.stringify(header));
  const pB64 = base64url(JSON.stringify(payload));
  const unsigned = hB64 + "." + pB64;

  const keyDer = pemToDer(MAPKIT_P8_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );

  const token = unsigned + "." + base64url(new Uint8Array(sig));
  _mapkitJwt = { token, exp: now + 3500 };
  return token;
}

// ── Apple Maps access token (exchanged from JWT) ────────────────────────
//
// Apple Maps Server API requires a two-step auth:
//   1. Sign a JWT with the MapKit private key
//   2. GET /v1/token with "Authorization: Bearer <JWT>" to exchange for
//      a short-lived access token (~30 min)
//   3. Use "Authorization: Bearer <accessToken>" on actual API calls
// Sending the raw JWT to /v1/etas returns 401 Not Authorized.

let _mapkitAccessToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_mapkitAccessToken && _mapkitAccessToken.exp > now + 60) {
    return _mapkitAccessToken.token;
  }

  const jwt = await getMapkitJwt();
  const res = await fetch("https://maps-api.apple.com/v1/token", {
    headers: { Authorization: "Bearer " + jwt },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MapKit token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const accessToken = data.accessToken as string;
  const expiresIn = (data.expiresInSeconds as number) || 1800;

  _mapkitAccessToken = { token: accessToken, exp: now + expiresIn - 60 };
  return accessToken;
}

// ── Apple Maps ETA ──────────────────────────────────────────────────────

async function appleETA(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<number> {
  const accessToken = await getAccessToken();
  const url =
    `https://maps-api.apple.com/v1/etas` +
    `?origin=${fromLat},${fromLng}` +
    `&destinations=${toLat},${toLng}` +
    `&transportType=Automobile`;

  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + accessToken },
  });

  if (!res.ok) {
    console.error("Apple Maps ETA error:", res.status, await res.text());
    return Infinity;
  }

  const data = await res.json();
  const eta = data?.etas?.[0];
  return eta?.expectedTravelTimeSeconds ?? Infinity;
}

// ── Types ───────────────────────────────────────────────────────────────

interface Ride {
  id: string;
  driver_id: string;
  status: string;
  pu_x: number;
  pu_y: number;
  do_x: number;
  do_y: number;
  driver_eta_secs: number | null;
  driver_eta_updated_at: string | null;
  created_at: string;
}

interface Driver {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

// ── Chain-walk with real Apple Maps ETAs ─────────────────────────────────

async function chainWalkETA(
  driver: Driver,
  driverRides: Ride[],
  riderPuLat: number,
  riderPuLng: number,
): Promise<number> {
  let curLat = parseFloat(String(driver.lat));
  let curLng = parseFloat(String(driver.lng));
  let totalSecs = 0;

  const sorted = [...driverRides].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const ride of sorted) {
    const puLat = parseFloat(String(ride.pu_x));
    const puLng = parseFloat(String(ride.pu_y));
    const doLat = parseFloat(String(ride.do_x));
    const doLng = parseFloat(String(ride.do_y));

    if (
      ride.status === "requested" ||
      ride.status === "accepted" ||
      ride.status === "en_route"
    ) {
      // Use Swift's live ETA if fresh (< 15s old), otherwise Apple Maps
      const swiftFresh =
        ride.driver_eta_secs &&
        ride.driver_eta_updated_at &&
        Date.now() - new Date(ride.driver_eta_updated_at).getTime() < 15000;

      if (swiftFresh && ride.status !== "requested") {
        // Swift ETA covers driver→current target (pickup or dropoff)
        totalSecs += ride.driver_eta_secs!;
        if (ride.status === "accepted" || ride.status === "en_route") {
          // Still needs pickup→dropoff after arriving
          totalSecs += 60; // boarding
          totalSecs += await appleETA(puLat, puLng, doLat, doLng);
        }
      } else {
        totalSecs += await appleETA(curLat, curLng, puLat, puLng);
        totalSecs += 60; // boarding
        totalSecs += await appleETA(puLat, puLng, doLat, doLng);
      }
      curLat = doLat;
      curLng = doLng;
    } else if (ride.status === "arrived") {
      totalSecs += 60; // boarding
      totalSecs += await appleETA(puLat, puLng, doLat, doLng);
      curLat = doLat;
      curLng = doLng;
    } else if (ride.status === "picked_up") {
      const swiftFresh =
        ride.driver_eta_secs &&
        ride.driver_eta_updated_at &&
        Date.now() - new Date(ride.driver_eta_updated_at).getTime() < 15000;

      if (swiftFresh) {
        totalSecs += ride.driver_eta_secs!;
      } else {
        totalSecs += await appleETA(curLat, curLng, doLat, doLng);
      }
      curLat = doLat;
      curLng = doLng;
    }
  }

  // Final leg: last position → rider's pickup
  totalSecs += await appleETA(curLat, curLng, riderPuLat, riderPuLng);
  return totalSecs;
}

// ── Main handler ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json();
    const {
      riderId, pickup, dropoff,
      puLat, puLng, doLat, doLng,
      passengers, phone, note,
    } = body;

    if (!riderId || !puLat || !puLng) {
      return new Response(
        JSON.stringify({ ok: false, reason: "missing_fields" }),
        {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        },
      );
    }

    if (!MAPKIT_KEY_ID || !MAPKIT_P8_KEY || !TEAM_ID) {
      return new Response(
        JSON.stringify({ ok: false, reason: "mapkit_not_configured" }),
        {
          status: 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        },
      );
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    // 1. Fetch all online drivers with GPS
    const { data: drivers, error: drvErr } = await supa
      .from("users")
      .select("id, lat, lng, name")
      .eq("role", "driver")
      .eq("status", "online")
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (drvErr || !drivers || drivers.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, reason: "no_drivers" }),
        {
          status: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Fetch all active rides for these drivers (includes driver_eta_secs)
    const driverIds = drivers.map((d) => d.id);
    const { data: activeRides } = await supa
      .from("rides")
      .select(
        "id, driver_id, status, pu_x, pu_y, do_x, do_y, " +
        "driver_eta_secs, driver_eta_updated_at, created_at",
      )
      .in("driver_id", driverIds)
      .in("status", [
        "accepted",
        "en_route",
        "arrived",
        "picked_up",
        "requested",
      ]);

    const ridesByDriver: Record<string, Ride[]> = {};
    (activeRides || []).forEach((r) => {
      if (!ridesByDriver[r.driver_id]) ridesByDriver[r.driver_id] = [];
      ridesByDriver[r.driver_id].push(r as Ride);
    });

    // 3. Score each driver with real Apple Maps chain-walked ETA (parallel)
    const riderPuLat = parseFloat(puLat);
    const riderPuLng = parseFloat(puLng);

    const etaResults = await Promise.all(
      drivers.map(async (d) => {
        const queue = ridesByDriver[d.id] || [];
        try {
          const totalEta = await chainWalkETA(
            d as Driver,
            queue,
            riderPuLat,
            riderPuLng,
          );
          return { ...d, queue: queue.length, totalEta, ok: true };
        } catch (e) {
          console.error("ETA failed for driver", d.id, e);
          return { ...d, queue: queue.length, totalEta: Infinity, ok: false };
        }
      }),
    );

    const scored = etaResults
      .filter((d) => d.ok && isFinite(d.totalEta) && d.totalEta > 0)
      .sort((a, b) => a.totalEta - b.totalEta);

    if (scored.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, reason: "no_drivers" }),
        {
          status: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Atomically assign, falling through on race condition
    const rideId =
      "ride-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    for (const candidate of scored) {
      const { data: result, error: rpcErr } = await supa.rpc(
        "assign_ride_to_driver",
        {
          p_driver_id: candidate.id,
          p_rider_id: riderId,
          p_ride_id: rideId,
          p_pickup: pickup || "Pickup",
          p_dropoff: dropoff || "Dropoff",
          p_pu_x: riderPuLat,
          p_pu_y: riderPuLng,
          p_do_x: parseFloat(doLat) || 0,
          p_do_y: parseFloat(doLng) || 0,
          p_passengers: parseInt(passengers) || 1,
          p_phone: phone || null,
          p_note: note || null,
          p_expected_queue: candidate.queue,
        },
      );

      if (rpcErr) {
        console.error("RPC error for driver", candidate.id, rpcErr);
        continue;
      }

      if (result) {
        return new Response(
          JSON.stringify({
            ok: true,
            ride_id: rideId,
            driver_id: candidate.id,
            driver_name: candidate.name || "",
            eta_seconds: candidate.totalEta,
            eta_mins: Math.max(1, Math.round(candidate.totalEta / 60)),
          }),
          {
            status: 200,
            headers: { ...CORS, "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: false, reason: "no_drivers" }),
      {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("dispatch error:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "error",
        message: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      },
    );
  }
});
