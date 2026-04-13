// RYDZ - Send Push Notification via Apple APNs
// Triggered by Supabase Database Webhook on rides UPDATE.
// Looks up the rider's push_token and sends an APNs alert over HTTP/2.
//
// Required env vars (set via `supabase secrets set`):
//   APNS_KEY_ID       - 10 char Key ID from Apple Developer
//   APNS_TEAM_ID      - 10 char Team ID from Apple Developer
//   APNS_BUNDLE_ID    - com.betarydz.rider
//   APNS_P8_KEY       - full contents of the .p8 file (including BEGIN/END lines)
//   APNS_ENV          - "sandbox" for TestFlight/dev, "production" for App Store
//   SUPABASE_URL      - auto-set by Supabase
//   SUPABASE_SERVICE_ROLE_KEY - auto-set by Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID") || "";
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID") || "";
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") || "";
const APNS_BUNDLE_ID_DRIVER = Deno.env.get("APNS_BUNDLE_ID_DRIVER") || "";
const APNS_P8_KEY = Deno.env.get("APNS_P8_KEY") || "";
const APNS_ENV = Deno.env.get("APNS_ENV") || "sandbox";

const APNS_HOST = APNS_ENV === "production"
  ? "api.push.apple.com"
  : "api.sandbox.push.apple.com";

// JWT cache - Apple allows reuse for up to 60 min, refresh at 45 min
let cachedJwt: { token: string; exp: number } | null = null;

// Convert PEM-encoded PKCS8 key to raw DER bytes
function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
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

async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp > now + 60) return cachedJwt.token;

  const header = { alg: "ES256", kid: APNS_KEY_ID, typ: "JWT" };
  const payload = { iss: APNS_TEAM_ID, iat: now };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const unsigned = headerB64 + "." + payloadB64;

  const keyDer = pemToDer(APNS_P8_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned)
  );

  const token = unsigned + "." + base64url(new Uint8Array(sig));
  cachedJwt = { token, exp: now + 45 * 60 };
  return token;
}

async function sendApns(
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  topic?: string
): Promise<void> {
  const jwt = await getApnsJwt();
  const url = "https://" + APNS_HOST + "/3/device/" + deviceToken;
  const payload = {
    aps: {
      alert: { title, body },
      sound: "default",
      badge: 1,
    },
    ...data,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": "bearer " + jwt,
      "apns-topic": topic || APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("APNs " + res.status + ": " + err);
  }
}

// Pick the correct apns-topic (bundle ID) based on the target user's role
function topicForRole(role: string | null | undefined): string {
  if (role === "driver" && APNS_BUNDLE_ID_DRIVER) return APNS_BUNDLE_ID_DRIVER;
  return APNS_BUNDLE_ID;
}

// Map a ride status transition to a notification (or null to skip)
function buildNotification(newStatus: string, driverName?: string): { title: string; body: string } | null {
  const who = driverName ? driverName : "Your driver";
  switch (newStatus) {
    case "accepted":
      return {
        title: "Driver on the way",
        body: who + " accepted your ride and is heading to pickup.",
      };
    case "arrived":
      return {
        title: "Driver is nearby",
        body: who + " is approaching your pickup location.",
      };
    case "picked_up":
      return {
        title: "Ride started",
        body: "Enjoy your ride with Rydz!",
      };
    case "completed":
      return {
        title: "Ride complete",
        body: "Thanks for riding with Rydz!",
      };
    case "cancelled":
      return {
        title: "Ride cancelled",
        body: "Your ride has been cancelled.",
      };
    default:
      return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  try {
    if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID || !APNS_P8_KEY) {
      return new Response("APNs not configured", { status: 500 });
    }

    const raw = await req.text();
    const payload = raw ? JSON.parse(raw) : {};

    // Supabase Database Webhook payload shape:
    // { type: "UPDATE" | "INSERT", table: "rides", record: {...}, old_record: {...} }
    // Also supports manual invocation: { user_id, title, body, data }

    // --- Manual invocation path ---
    if (payload.user_id && payload.title) {
      const supa = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );
      const { data: user } = await supa
        .from("users")
        .select("push_token, role")
        .eq("id", payload.user_id)
        .single();

      if (!user || !user.push_token) {
        return new Response("no push token", { status: 200 });
      }
      await sendApns(
        user.push_token,
        payload.title,
        payload.body || "",
        payload.data || {},
        topicForRole(user.role)
      );
      return new Response("sent", { status: 200 });
    }

    // --- Database webhook path ---
    const type = payload.type;
    const record = payload.record;
    const oldRecord = payload.old_record;

    if (!record) {
      return new Response("ignored", { status: 200 });
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // ========================================================
    // INSERT path: a new ride was just created → notify driver
    // ========================================================
    if (type === "INSERT") {
      const driverId = record.driver_id || record.driverId;
      const newStatus = record.status;
      if (!driverId || newStatus !== "requested") {
        return new Response("no driver assigned or not requested", { status: 200 });
      }

      const { data: drv } = await supa
        .from("users")
        .select("push_token")
        .eq("id", driverId)
        .single();

      if (!drv || !drv.push_token) {
        return new Response("no push token for driver", { status: 200 });
      }

      await sendApns(
        drv.push_token,
        "New ride request",
        "Tap to view and accept",
        { rideId: record.id, role: "driver", type: "new_ride" },
        topicForRole("driver")
      );
      return new Response("sent to driver", { status: 200 });
    }

    // ========================================================
    // UPDATE path: status changed → notify rider
    // ========================================================
    if (type !== "UPDATE") {
      return new Response("ignored", { status: 200 });
    }

    const oldStatus = oldRecord ? oldRecord.status : null;
    const newStatus = record.status;
    if (!newStatus || oldStatus === newStatus) {
      return new Response("no status change", { status: 200 });
    }

    const note = buildNotification(newStatus);
    if (!note) {
      return new Response("status not notifiable", { status: 200 });
    }

    const riderId = record.rider_id || record.riderId;
    if (!riderId) {
      return new Response("no rider_id on record", { status: 200 });
    }

    const { data: user } = await supa
      .from("users")
      .select("push_token, push_platform")
      .eq("id", riderId)
      .single();

    if (!user || !user.push_token) {
      return new Response("no push token for rider", { status: 200 });
    }

    // Optional: look up driver name for richer notification
    let driverName: string | undefined;
    const driverId = record.driver_id || record.driverId;
    if (driverId) {
      const { data: drv } = await supa
        .from("users")
        .select("name")
        .eq("id", driverId)
        .single();
      if (drv && drv.name) driverName = drv.name;
    }

    const finalNote = buildNotification(newStatus, driverName) || note;

    await sendApns(
      user.push_token,
      finalNote.title,
      finalNote.body,
      { rideId: record.id, status: newStatus },
      topicForRole("rider")
    );

    return new Response("sent", { status: 200 });
  } catch (e) {
    console.error("send-push error:", e);
    return new Response("error: " + (e instanceof Error ? e.message : String(e)), {
      status: 500,
    });
  }
});
