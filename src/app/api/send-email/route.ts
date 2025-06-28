
import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

let resend: Resend | null = null;
if (resendApiKey && resendApiKey.startsWith('re_')) {
  try {
    resend = new Resend(resendApiKey);
    console.log("[LOG API /api/send-email] Resend IS CONFIGURED.");
  } catch(e) {
     console.error("[LOG API /api/send-email] Error initializing Resend client:", e);
     resend = null;
  }
} else {
  console.warn(
    "[LOG API /api/send-email] RESEND_API_KEY is missing or invalid. Emails will be mocked."
  );
}

interface EmailRequestBody {
  to: string | string[];
  subject: string;
  html: string;
}

export async function POST(request: NextRequest) {
  console.log("[LOG API /api/send-email] Received POST request.");
  try {
    const body = await request.json() as EmailRequestBody;
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      console.error("[LOG API /api/send-email] Missing parameters in request body.");
      return NextResponse.json({ success: false, message: 'Missing required parameters: to, subject, html' }, { status: 400 });
    }

    if (!resend) {
      console.log(`--- [LOG API /api/send-email] MOCK EMAIL SEND REQUEST ---`);
      console.log("To:", Array.isArray(to) ? to.join(', ') : to);
      console.log("Subject:", subject);
      console.log("HTML Body (first 200 chars):", html.substring(0, 200) + (html.length > 200 ? "..." : ""));
      console.log("--- [LOG API /api/send-email] END MOCK EMAIL ---");
      return NextResponse.json({ success: true, message: "Email sending is mocked due to missing or invalid Resend configuration. Check server logs." });
    }
    
    // NOTE: Resend requires a verified sending domain. 'onboarding@resend.dev' is for testing/development.
    // In production, you would replace this with a from address on your own verified domain.
    const fromAddress = 'CampusHub <onboarding@resend.dev>';
    
    console.log(`[LOG API /api/send-email] Attempting to send email via Resend from ${fromAddress}.`);
    
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: to,
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('[LOG API /api/send-email] Resend error:', JSON.stringify(error, null, 2));
      return NextResponse.json({ success: false, message: `Resend API Error: ${(error as Error).message}` }, { status: 500 });
    }

    console.log('[LOG API /api/send-email] Email sent successfully via Resend:', data);
    return NextResponse.json({ success: true, message: 'Email sent successfully via Resend.', data });

  } catch (error: any) {
    console.error('[LOG API /api/send-email] Error processing request:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
