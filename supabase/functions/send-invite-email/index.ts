import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Resend's test sender — works immediately without domain verification.
// Once you verify your own domain in Resend, switch this to something like
// "SGEW MOM <invites@yourdomain.com>".
const FROM_ADDRESS = "Digital Meeting Controller <onboarding@resend.dev>";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured on the server." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, inviterName, role } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "A valid 'email' field is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inviter = inviterName || "A teammate";
    const roleLabel = role || "member";

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
        <h2 style="margin: 0 0 16px;">You've been invited to Digital Meeting Controller</h2>
        <p style="margin: 0 0 16px; line-height: 1.5;">
          ${inviter} invited you to join their team as a <strong>${roleLabel}</strong> on
          SGEW's AI Meeting Minutes portal.
        </p>
        <p style="margin: 0 0 24px; line-height: 1.5;">
          Create your account to start collaborating on meeting minutes, transcripts, and action items.
        </p>
        <p style="color: #6b7280; font-size: 13px; margin-top: 32px;">
          If you weren't expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject: `${inviter} invited you to Digital Meeting Controller`,
        html,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ error: resendData?.message || "Failed to send email via Resend." }),
        { status: resendResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
