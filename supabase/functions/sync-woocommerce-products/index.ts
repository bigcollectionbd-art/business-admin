import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const wcStoreUrl = Deno.env.get("WOOCOMMERCE_URL")!;
const wcConsumerKey = Deno.env.get("WOOCOMMERCE_CONSUMER_KEY")!;
const wcConsumerSecret = Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed." },
      { status: 405, headers: corsHeaders },
    );
  }

  const authorization = req.headers.get("Authorization") || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch) {
    return Response.json(
      { success: false, error: "Authentication is required." },
      { status: 401, headers: corsHeaders },
    );
  }

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceKey ||
    !wcStoreUrl ||
    !wcConsumerKey ||
    !wcConsumerSecret
  ) {
    console.error("WooCommerce sync configuration is incomplete.");
    return Response.json(
      { success: false, error: "Sync service is not configured." },
      { status: 500, headers: corsHeaders },
    );
  }

  try {
    // Verify the caller's real Supabase Auth user. Do not trust user_metadata
    // for role checks; role and active state come from the protected profiles row.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error: userError } =
      await userClient.auth.getUser(bearerMatch[1]);

    if (userError || !userData.user) {
      return Response.json(
        { success: false, error: "Your login session is invalid or expired." },
        { status: 401, headers: corsHeaders },
      );
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role, active")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Could not verify sync permissions:", profileError.message);
      return Response.json(
        { success: false, error: "Could not verify your account permissions." },
        { status: 500, headers: corsHeaders },
      );
    }

    if (
      !profile ||
      profile.active !== true ||
      !["owner", "admin"].includes(profile.role)
    ) {
      return Response.json(
        { success: false, error: "You are not allowed to sync products." },
        { status: 403, headers: corsHeaders },
      );
    }

    // The privileged client is created only after the caller is authenticated
    // and confirmed as an active owner/admin.
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let page = 1;
    let totalSynced = 0;
    const storeUrl = wcStoreUrl.replace(/\/+$/, "");

    while (true) {
      const url =
        `${storeUrl}/wp-json/wc/v3/products?per_page=100&page=${page}`;

      const auth = btoa(`${wcConsumerKey}:${wcConsumerSecret}`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.error("WooCommerce API returned status:", response.status);
        throw new Error(`WooCommerce API error: ${response.status}`);
      }

      const products = await response.json();

      if (!Array.isArray(products)) {
        throw new Error("WooCommerce returned an invalid products response.");
      }

      if (products.length === 0) {
        break;
      }

      for (const product of products) {
        const imageUrl =
          product.images?.length > 0 ? product.images[0].src : null;

        const sellingPrice =
          product.sale_price !== ""
            ? Number(product.sale_price)
            : Number(product.regular_price || 0);

        const status =
          product.status === "publish" ? "active" : "inactive";

        const { data: existingProduct, error: findError } =
          await supabaseAdmin
            .from("products")
            .select("id")
            .eq("woo_product_id", product.id)
            .maybeSingle();

        if (findError) {
          throw new Error(
            `Supabase lookup error for product ${product.id}: ${findError.message}`,
          );
        }

        const productData = {
          woo_product_id: product.id,
          sku: product.sku || null,
          name: product.name,
          image_url: imageUrl,
          selling_price: sellingPrice,
          status,
        };

        let error;

        if (existingProduct) {
          // Keep existing stock_qty unchanged: stock is managed in this app,
          // not overwritten by a WooCommerce catalog sync.
          ({ error } = await supabaseAdmin
            .from("products")
            .update(productData)
            .eq("id", existingProduct.id));
        } else {
          const stockQty =
            product.stock_quantity !== null
              ? Number(product.stock_quantity)
              : 0;

          ({ error } = await supabaseAdmin
            .from("products")
            .insert({
              ...productData,
              stock_qty: stockQty,
            }));
        }

        if (error) {
          throw new Error(
            `Supabase error for product ${product.id}: ${error.message}`,
          );
        }

        totalSynced++;
      }

      page++;
    }

    return Response.json(
      { success: true, synced: totalSynced },
      { headers: { ...corsHeaders, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "WooCommerce product sync failed:",
      error instanceof Error ? error.message : String(error),
    );

    return Response.json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Product sync failed.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
});
