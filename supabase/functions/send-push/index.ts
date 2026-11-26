import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { ...corsHeaders, "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:bigcollectionbd@gmail.com";
    const systemSecret = Deno.env.get("PUSH_SYSTEM_SECRET");
    if (!supabaseUrl || !anonKey || !serviceKey || !publicKey || !privateKey || !systemSecret) {
      return json({ error: "Push server configuration is incomplete." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "").trim().slice(0, 80);
    const message = String(body.message || "").trim().slice(0, 500);
    const kind = String(body.kind || "custom");
    if (!title || !message) return json({ error: "Title and message are required." }, 400);

    const isSystemCall = req.headers.get("x-push-secret") === systemSecret;
    if (!isSystemCall) {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      if (!token) return json({ error: "Login required." }, 401);
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) return json({ error: "Invalid login session." }, 401);
      const { data: profile, error: profileError } = await admin
        .from("profiles").select("role, active").eq("id", user.id).maybeSingle();
      if (profileError) throw new Error("Could not verify owner permission.");
      if (!profile || profile.active !== true || profile.role !== "owner") {
        return json({ error: "Only the owner can send custom notifications." }, 403);
      }
      if (kind !== "custom") return json({ error: "Invalid notification type." }, 400);
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const { data: subscriptions, error: listError } = await admin
      .from("notification_push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth");
    if (listError) throw new Error("Could not load device subscriptions.");

    const userIds = [...new Set((subscriptions || []).map((row) => row.user_id))];
    const { data: profiles, error: profilesError } = await admin
      .from("profiles").select("id, active").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    if (profilesError) throw new Error("Could not verify active team members.");
    const activeIds = new Set((profiles || []).filter((p) => p.active === true).map((p) => p.id));
    const payload = JSON.stringify({ title, body: message, url: "/" });

    let sent = 0;
    let removed = 0;
    let failed = 0;
    for (const row of subscriptions || []) {
      if (!activeIds.has(row.user_id)) continue;
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
          { TTL: 60 * 60, urgency: "high" },
        );
        sent += 1;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("notification_push_subscriptions").delete().eq("id", row.id);
          removed += 1;
        } else {
          failed += 1;
          console.error("Push delivery failed:", statusCode || "unknown");
        }
      }
    }

    return json({ success: true, sent, removed, failed });
  } catch (error) {
    console.error("Push send error:", error);
    return json({ error: error instanceof Error ? error.message : "Push delivery failed." }, 500);
  }
});
