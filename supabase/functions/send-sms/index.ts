import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Credentials loaded from Supabase secrets (set via CLI or dashboard)
// supabase secrets set TWILIO_SID=xxx TWILIO_TOKEN=xxx TWILIO_FROM=xxx
const TWILIO_SID = Deno.env.get("TWILIO_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_TOKEN") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_FROM") || "";

const MESSAGES: Record<string, string> = {
  en_route: "Your Rydz driver is on the way! Track your ride in the app.",
  arrived: "Your Rydz driver has arrived at your pickup location!",
  completed: "Thanks for riding with Rydz! We hope you enjoyed your ride.",
};

serve(async (req: Request) => {
  // Handle CORS preflight
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
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { phone, status, driverName } = await req.json();

    if (!phone || !status) {
      return new Response(JSON.stringify({ error: "Missing phone or status" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Only send for these statuses
    let msg = MESSAGES[status];
    if (!msg) {
      return new Response(JSON.stringify({ error: "No message for status: " + status }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Add driver name for en_route
    if (status === "en_route" && driverName) {
      msg = `Your Rydz driver ${driverName} is on the way! Track your ride in the app.`;
    }

    // Clean phone number — ensure it starts with +1
    let to = phone.replace(/[^0-9+]/g, "");
    if (!to.startsWith("+")) {
      to = to.startsWith("1") ? "+" + to : "+1" + to;
    }

    // Send via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);

    const body = new URLSearchParams({
      To: to,
      From: TWILIO_FROM,
      Body: msg,
    });

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Twilio error:", result);
      return new Response(JSON.stringify({ error: result.message || "Twilio error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ success: true, sid: result.sid }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error("SMS function error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
