import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

var S = Deno.env.get("TWILIO_SID") || "";
var T = Deno.env.get("TWILIO_TOKEN") || "";
var F = Deno.env.get("TWILIO_FROM") || "";

serve(async function(req) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey"
      }
    });
  }

  try {
    if (!S || !T || !F) {
      return new Response("Twilio not configured", { status: 500 });
    }

    var raw = await req.text();
    var data = JSON.parse(raw);
    var phone = data.phone || "";
    var status = data.status || "";
    var driverName = data.driverName || "";

    if (!phone || !status) {
      return new Response("Missing phone or status", { status: 400 });
    }

    var msg = "";
    if (status === "en_route") {
      msg = "Your Rydz driver " + driverName + " is on the way!";
    } else if (status === "arrived") {
      msg = "Your Rydz driver has arrived at your pickup location!";
    } else if (status === "completed") {
      msg = "Thanks for riding with Rydz!";
    } else {
      return new Response("Invalid status", { status: 400 });
    }

    var to = phone.replace(/[^0-9+]/g, "");
    if (to.charAt(0) !== "+") {
      to = "+1" + to.replace(/^1/, "");
    }

    var url = "https://api.twilio.com/2010-04-01/Accounts/" + S + "/Messages.json";

    var res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(S + ":" + T),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "To=" + encodeURIComponent(to) + "&From=" + encodeURIComponent(F) + "&Body=" + encodeURIComponent(msg)
    });

    var result = await res.text();
    return new Response(result, {
      status: res.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response("Error: " + String(e), { status: 500 });
  }
});
