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

    const { attendees, title, meetingDate, actionItems, senderName } = await req.json();

    if (!Array.isArray(attendees) || attendees.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid attendee email addresses were found for this meeting." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const itemsHtml = (actionItems || [])
      .map(
        (item) => `
        <li style="margin-bottom: 10px;">
          <strong>${item.text}</strong><br/>
          <span style="color: #6b7280; font-size: 13px;">
            Owner: ${item.assignee || "Not specified"} &nbsp;•&nbsp; Deadline: ${item.due_date || "Not specified"}
          </span>
        </li>`
      )
      .join("");

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
        <h2 style="margin: 0 0 8px;">${title || "Meeting"} — Action Items</h2>
        <p style="margin: 0 0 20px; color: #6b7280; font-size: 13px;">
          ${meetingDate ? `Meeting date: ${meetingDate}` : ""} ${senderName ? `• Shared by ${senderName}` : ""}
        </p>
        ${itemsHtml ? `<ul style="padding-left: 20px; margin: 0 0 20px;">${itemsHtml}</ul>` : "<p>No action items were recorded for this meeting.</p>"}
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
        subject: `${title || "Meeting"} — Your Action Items`,
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
