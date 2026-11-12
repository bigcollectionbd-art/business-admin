import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: "Supabase server environment variables are missing." },
        500
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Authorization token is missing." },
        401
      );
    }

    const accessToken = authHeader.substring(7);

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: userData,
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !userData.user) {
      return jsonResponse(
        {
          error:
            userError?.message ||
            "Invalid or expired login session.",
        },
        401
      );
    }

    const currentUser = userData.user;

    const {
      data: requesterProfile,
      error: requesterError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, role, active")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (requesterError) {
      return jsonResponse(
        {
          error:
            "Could not verify owner profile: " +
            requesterError.message,
        },
        500
      );
    }

    if (!requesterProfile) {
      return jsonResponse(
        { error: "Your profile was not found." },
        403
      );
    }

    if (
      requesterProfile.role !== "owner" ||
      requesterProfile.active !== true
    ) {
      return jsonResponse(
        {
          error:
            "Only an active owner can create admin users.",
        },
        403
      );
    }

    let body;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid request body." },
        400
      );
    }

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");

    if (!name || !email || !password) {
      return jsonResponse(
        {
          error:
            "Admin name, email and password are required.",
        },
        400
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        {
          error:
            "Password must be at least 6 characters.",
        },
        400
      );
    }

    const {
      data: userList,
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      return jsonResponse(
        {
          error:
            "Could not check existing users: " +
            listError.message,
        },
        500
      );
    }

    const emailExists = userList.users.some(
      (item) =>
        item.email?.toLowerCase() === email
    );

    if (emailExists) {
      return jsonResponse(
        {
          error:
            "A user with this email already exists.",
        },
        409
      );
    }

    const {
      data: createdUserData,
      error: createUserError,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: "admin",
      },
    });

    if (createUserError || !createdUserData?.user) {
      return jsonResponse(
        {
          error:
            createUserError?.message ||
            "Could not create Auth user.",
        },
        500
      );
    }

    const newUser = createdUserData.user;

    const {
      error: insertProfileError,
    } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.id,
        name,
        role: "admin",
        active: true,
      });

    if (insertProfileError) {
      await supabaseAdmin.auth.admin.deleteUser(
        newUser.id
      );

      return jsonResponse(
        {
          error:
            "Auth user was created, but profile creation failed: " +
            insertProfileError.message,
        },
        500
      );
    }

    return jsonResponse(
      {
        success: true,
        message: "Admin account created successfully.",
        user: {
          id: newUser.id,
          email: newUser.email,
          name,
          role: "admin",
          active: true,
        },
      },
      201
    );
  } catch (error) {
    console.error("create-admin unexpected error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500
    );
  }
});
