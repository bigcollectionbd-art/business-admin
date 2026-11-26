import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  // Pathao sends naive timestamps in Bangladesh local time. Explicit offsets
  // (when present) are respected; offset-free values are interpreted as UTC+6.
  const hasTimezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(raw);
  const normalized = hasTimezone
    ? raw
    : `${raw.replace(" ", "T")}+06:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ success: false, error: "POST required" }, 405);

  try {
    const expectedSecret = Deno.env.get("PATHAO_CRON_SECRET");
    const receivedSecret = req.headers.get("x-cron-secret");
    if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const pathaoBaseUrl = (Deno.env.get("PATHAO_BASE_URL") || "https://api-hermes.pathao.com").replace(/\/+$/, "");
    if (!url || !serviceKey) return json({ success: false, error: "Supabase server configuration missing" }, 500);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: auth, error: authError } = await admin
      .from("pathao_auth")
      .select("access_token, token_expires_at")
      .eq("id", 1)
      .single();

    if (authError || !auth?.access_token) return json({ success: false, error: "Pathao token unavailable" }, 503);
    if (auth.token_expires_at && new Date(auth.token_expires_at).getTime() <= Date.now()) {
      return json({ success: false, error: "Pathao token expired" }, 503);
    }

    const { data: parcels, error: parcelError } = await admin
      .from("pathao_parcels")
      .select("id, sale_id, invoice_no, consignment_id, order_status, order_status_slug, tracking_updated_at")
      .not("consignment_id", "is", null)
      .order("booked_at", { ascending: true })
      .limit(500);

    if (parcelError) throw new Error("Could not load Pathao parcels");

    let updated = 0;
    let unchanged = 0;
    const failures: Array<{ invoice_no: string; message: string }> = [];

    for (let i = 0; i < (parcels || []).length; i += 3) {
      const batch = (parcels || []).slice(i, i + 3);
      await Promise.all(batch.map(async (parcel) => {
        try {
          const response = await fetch(
            `${pathaoBaseUrl}/aladdin/api/v1/orders/${encodeURIComponent(parcel.consignment_id)}/info`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${auth.access_token}`,
                Accept: "application/json",
              },
            },
          );
          const result = await response.json().catch(() => null);
          if (!response.ok || result?.type === "error" || !result?.data) {
            throw new Error(result?.message || `Pathao API returned HTTP ${response.status}`);
          }

          const data = result.data;
          const orderStatus = typeof data.order_status === "string" ? data.order_status : null;
          const orderStatusSlug = typeof data.order_status_slug === "string" ? data.order_status_slug : null;
          if (!orderStatus && !orderStatusSlug) throw new Error("Pathao response did not include a status");

          const pathaoUpdatedAt = parseTimestamp(data.updated_at);
          const changed =
            orderStatus !== parcel.order_status ||
            orderStatusSlug !== parcel.order_status_slug ||
            (pathaoUpdatedAt !== null && pathaoUpdatedAt !== parcel.tracking_updated_at);

          const update: Record<string, unknown> = {
            order_status: orderStatus,
            order_status_slug: orderStatusSlug,
            updated_at: new Date().toISOString(),
          };
          if (pathaoUpdatedAt) update.tracking_updated_at = pathaoUpdatedAt;

          const { error: saveError } = await admin
            .from("pathao_parcels")
            .update(update)
            .eq("id", parcel.id);
          if (saveError) throw new Error("Could not save latest status");

          if (changed) updated += 1;
          else unchanged += 1;

          // Notify only when the status itself transitions into one of the three requested states.
          const previousStatus = String(parcel.order_status_slug || parcel.order_status || "").toLowerCase().replace(/[^a-z]/g, "");
          const currentStatus = String(orderStatusSlug || orderStatus || "").toLowerCase().replace(/[^a-z]/g, "");
          const statusNotifications = {
            delivered: { title: "Pathao Parcel Delivered", body: `${parcel.invoice_no} parcel has been delivered.` },
            onhold: { title: "Pathao Parcel On Hold", body: `${parcel.invoice_no} parcel is now On Hold.` },
            returned: { title: "Pathao Parcel Returned", body: `${parcel.invoice_no} parcel has been returned.` },
            paidreturn: { title: "Pathao Parcel Returned", body: `${parcel.invoice_no} parcel has been returned.` },
          };
          const notification = statusNotifications[currentStatus];
          if (notification && currentStatus !== previousStatus && pushSystemSecret) {
            try {
              await fetch(`${url}/functions/v1/send-push`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-push-secret": pushSystemSecret },
                body: JSON.stringify({
                  kind: "pathao_status",
                  title: notification.title,
                  message: notification.body,
                }),
              });
            } catch (pushError) {
              console.error("Pathao push notification failed:", pushError);
            }
          }
        } catch (error) {
          failures.push({
            invoice_no: parcel.invoice_no,
            message: error instanceof Error ? error.message : "Unknown sync error",
          });
        }
      }));
      if (i + 3 < (parcels || []).length) await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return json({
      success: failures.length === 0,
      checked: parcels?.length || 0,
      updated,
      unchanged,
      failed: failures.length,
      failures,
      synced_at: new Date().toISOString(),
    }, failures.length ? 207 : 200);
  } catch (error) {
    console.error("Pathao sync error:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Unexpected sync error" }, 500);
  }
});
