import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// This function never touches the audio file itself — it only exchanges a
// stored Google OAuth refresh token for a short-lived access token, which
// the browser then uses to upload directly to Google Drive. That keeps
// large files off of Supabase entirely (no body-size limits to hit) and
// keeps the Google client secret / refresh token off the client.

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const GOOGLE_DRIVE_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const missing = [
      !GOOGLE_CLIENT_ID && "GOOGLE_CLIENT_ID",
      !GOOGLE_CLIENT_SECRET && "GOOGLE_CLIENT_SECRET",
      !GOOGLE_REFRESH_TOKEN && "GOOGLE_REFRESH_TOKEN",
      !GOOGLE_DRIVE_FOLDER_ID && "GOOGLE_DRIVE_FOLDER_ID",
    ].filter(Boolean);

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ error: `Google Drive is not configured. Missing secrets: ${missing.join(", ")}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return new Response(
        JSON.stringify({ error: tokenData?.error_description || tokenData?.error || "Failed to mint Google access token." }),
        { status: tokenResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
        folderId: GOOGLE_DRIVE_FOLDER_ID,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
