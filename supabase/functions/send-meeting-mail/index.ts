import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
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

    const { attendees, title, scheduledAt, notes, organizerName } = await req.json();

    if (!Array.isArray(attendees) || attendees.length === 0) {
      return new Response(
        JSON.stringify({ error: "'attendees' must be a non-empty array of email addresses." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const when = scheduledAt
      ? new Date(scheduledAt).toLocaleString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
        })
      : "TBD";
    const organizer = organizerName || "A teammate";

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
        <h2 style="margin: 0 0 16px;">Meeting Reminder: ${title || "Untitled Meeting"}</h2>
        <p style="margin: 0 0 8px; line-height: 1.5;"><strong>When:</strong> ${when}</p>
        <p style="margin: 0 0 16px; line-height: 1.5;"><strong>Organizer:</strong> ${organizer}</p>
        ${notes ? `<p style="margin: 0 0 16px; line-height: 1.5;">${notes}</p>` : ""}
        <p style="color: #6b7280; font-size: 13px; margin-top: 32px;">
          Sent via Digital Meeting Controller.
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
        to: attendees,
        subject: `Meeting Reminder: ${title || "Untitled Meeting"}`,
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
