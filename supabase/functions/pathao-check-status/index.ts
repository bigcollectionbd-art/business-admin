import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ success: false, error: "POST method required." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const pathaoBaseUrl = Deno.env.get("PATHAO_BASE_URL") || "https://api-hermes.pathao.com";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return response({ success: false, error: "Supabase environment configuration is missing." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return response({ success: false, error: "Login required." }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } =
      await authClient.auth.getUser(authHeader.slice(7).trim());

    if (authError || !user) {
      return response({ success: false, error: "Invalid or expired login session. Please login again." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles").select("role, active").eq("id", user.id).maybeSingle();

    if (profileError) throw new Error("Could not verify user profile.");
    if (!profile || profile.active !== true) {
      return response({ success: false, error: "Your account is inactive or not authorized." }, 403);
    }

    const body = await req.json();
    const saleId = String(body.sale_id || "").trim();
    if (!saleId) return response({ success: false, error: "Sale ID is required." }, 400);

    const { data: parcel, error: parcelError } = await admin
      .from("pathao_parcels").select("consignment_id").eq("sale_id", saleId).maybeSingle();

    if (parcelError) throw new Error("Could not read Pathao parcel.");
    if (!parcel?.consignment_id) {
      return response({ success: false, error: "Pathao Consignment ID was not found for this invoice." }, 404);
    }

    const { data: authData, error: authDataError } = await admin
      .from("pathao_auth").select("access_token, token_expires_at").eq("id", 1).single();

    if (authDataError || !authData?.access_token) {
      return response({ success: false, error: "Pathao access token was not found. Check Pathao token refresh." }, 503);
    }
    if (authData.token_expires_at && new Date(authData.token_expires_at).getTime() <= Date.now()) {
      return response({ success: false, error: "Pathao access token has expired. Refresh the token first." }, 503);
    }

    const pathaoResponse = await fetch(
      `${pathaoBaseUrl}/aladdin/api/v1/orders/${encodeURIComponent(parcel.consignment_id)}/info`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${authData.access_token}`, Accept: "application/json" },
      },
    );

    let pathaoResult: any;
    try { pathaoResult = await pathaoResponse.json(); } catch { pathaoResult = null; }

    if (!pathaoResponse.ok || pathaoResult?.type === "error" || !pathaoResult?.data) {
      console.error("Pathao status response:", pathaoResponse.status, pathaoResult);
      return response({ success: false, error: pathaoResult?.message || "Pathao could not return the parcel status." }, 502);
    }

    const latestStatus = pathaoResult.data.order_status_slug || pathaoResult.data.order_status;
    if (!latestStatus) {
      return response({ success: false, error: "Pathao response did not include a delivery status." }, 502);
    }

    const { error: updateError } = await admin
      .from("pathao_parcels")
      .update({ order_status: latestStatus, updated_at: new Date().toISOString() })
      .eq("sale_id", saleId);

    if (updateError) throw new Error("Pathao status was received but could not be saved.");

    return response({
      success: true,
      consignment_id: parcel.consignment_id,
      order_status: latestStatus,
      pathao_updated_at: pathaoResult.data.updated_at || null,
    });
  } catch (error) {
    console.error("Pathao status check error:", error);
    return response({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected server error.",
    }, 500);
  }
});
