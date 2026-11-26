import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
  const secret = Deno.env.get("PUSH_SYSTEM_SECRET");
  if (!secret || req.headers.get("x-push-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return Response.json({ error: "Server configuration missing" }, { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // These are the Pathao states that mean a booked parcel is still awaiting pickup.
  // Picked-up, in-transit, delivered, cancelled and returned parcels are excluded.
  const { count, error } = await admin
    .from("pathao_parcels")
    .select("id", { count: "exact", head: true })
    .in("order_status_slug", ["Pending", "Pickup_Requested", "Assigned_for_Pickup"]);
  if (error) return Response.json({ error: "Could not check pending pickups." }, { status: 500 });
  if (!count) return Response.json({ success: true, waiting_for_pickup: 0, sent: 0 });

  const response = await fetch(`${url}/functions/v1/send-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-push-secret": secret },
    body: JSON.stringify({
      kind: "pickup_reminder",
      title: "Pathao Pickup Reminder",
      message: `${count} parcel(s) are still waiting for pickup. Please arrange pickup.`,
    }),
  });
  const result = await response.json().catch(() => ({}));
  return Response.json({ success: response.ok, waiting_for_pickup: count, delivery: result }, { status: response.ok ? 200 : 502 });
});
