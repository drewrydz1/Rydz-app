// RYDZ Server-Side Dispatch Engine
//
// Rider calls with pickup/dropoff coords + rider info.
// Queries ALL online drivers + their ride queues from Postgres.
// Chain-walks haversine ETA: driver → current pickup → dropoff → … → rider's pickup.
// Picks driver with shortest total ETA.
// Atomically assigns via assign_ride_to_driver RPC (row-lock).
// If race condition, falls to next-best driver.
// Returns { ride_id, driver_id, eta_seconds } in ~200-500ms.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const AVG_SPEED_MPS = 9.7; // ~22 mph typical Naples streets
const ROAD_FACTOR = 1.3; // haversine → road distance multiplier

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaSeconds(meters: number): number {
  return Math.max(60, Math.round((meters * ROAD_FACTOR) / AVG_SPEED_MPS));
}

interface Ride {
  id: string;
  driver_id: string;
  status: string;
  pu_x: number;
  pu_y: number;
  do_x: number;
  do_y: number;
  created_at: string;
}

interface Driver {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

// Chain-walk: driver position → finish current rides in order → rider's pickup
function chainWalkETA(
  driver: Driver,
  driverRides: Ride[],
  riderPuLat: number,
  riderPuLng: number,
): number {
  let curLat = parseFloat(String(driver.lat));
  let curLng = parseFloat(String(driver.lng));
  let totalSecs = 0;

  // Sort rides by created_at so we walk them in FIFO order
  const sorted = [...driverRides].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const ride of sorted) {
    const puLat = parseFloat(String(ride.pu_x));
    const puLng = parseFloat(String(ride.pu_y));
    const doLat = parseFloat(String(ride.do_x));
    const doLng = parseFloat(String(ride.do_y));

    if (ride.status === 'requested' || ride.status === 'accepted' || ride.status === 'en_route') {
      // Driver still needs to get to pickup, then dropoff
      totalSecs += etaSeconds(haversineMeters(curLat, curLng, puLat, puLng));
      totalSecs += etaSeconds(haversineMeters(puLat, puLng, doLat, doLng));
      curLat = doLat;
      curLng = doLng;
    } else if (ride.status === 'arrived') {
      // Driver is at pickup, still needs dropoff
      totalSecs += 60; // ~1 min boarding
      totalSecs += etaSeconds(haversineMeters(puLat, puLng, doLat, doLng));
      curLat = doLat;
      curLng = doLng;
    } else if (ride.status === 'picked_up') {
      // Driver heading to dropoff
      totalSecs += etaSeconds(haversineMeters(curLat, curLng, doLat, doLng));
      curLat = doLat;
      curLng = doLng;
    }
  }

  // Final leg: last position → rider's pickup
  totalSecs += etaSeconds(haversineMeters(curLat, curLng, riderPuLat, riderPuLng));
  return totalSecs;
}

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
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
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
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // 2. Fetch all active rides for these drivers (one query)
    const driverIds = drivers.map((d) => d.id);
    const { data: activeRides } = await supa
      .from("rides")
      .select("id, driver_id, status, pu_x, pu_y, do_x, do_y, created_at")
      .in("driver_id", driverIds)
      .in("status", ["accepted", "en_route", "arrived", "picked_up", "requested"]);

    // Group rides by driver
    const ridesByDriver: Record<string, Ride[]> = {};
    (activeRides || []).forEach((r) => {
      if (!ridesByDriver[r.driver_id]) ridesByDriver[r.driver_id] = [];
      ridesByDriver[r.driver_id].push(r as Ride);
    });

    // 3. Score each driver with chain-walked ETA
    const riderPuLat = parseFloat(puLat);
    const riderPuLng = parseFloat(puLng);

    const scored = drivers
      .map((d) => {
        const queue = ridesByDriver[d.id] || [];
        const totalEta = chainWalkETA(d as Driver, queue, riderPuLat, riderPuLng);
        return { ...d, queue: queue.length, totalEta };
      })
      .sort((a, b) => a.totalEta - b.totalEta);

    if (scored.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, reason: "no_drivers" }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // 4. Try to assign atomically, falling through on conflict
    const rideId = "ride-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);

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
          { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: false, reason: "no_drivers" }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("dispatch error:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "error",
        message: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
