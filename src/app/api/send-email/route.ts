
import { NextResponse, type NextRequest } from 'next/server';
import emailjs from 'emailjs-com';

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const USER_ID = process.env.EMAILJS_PUBLIC_KEY; // EmailJS Public Key (often called User ID)

let isEmailJsConfigured = false;
if (SERVICE_ID && TEMPLATE_ID && USER_ID) {
  isEmailJsConfigured = true;
  console.log("[LOG API /api/send-email] EmailJS IS CONFIGURED.");
} else {
  console.warn(
    "[LOG API /api/send-email] EmailJS IS NOT FULLY CONFIGURED. Required environment variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY) are missing. Emails will be mocked."
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

    if (!isEmailJsConfigured || !SERVICE_ID || !TEMPLATE_ID || !USER_ID) {
      console.log(`--- [LOG API /api/send-email] MOCK EMAIL SEND REQUEST ---`);
      console.log("To:", Array.isArray(to) ? to.join(', ') : to);
      console.log("Subject:", subject);
      console.log("HTML Body (first 200 chars):", html.substring(0, 200) + (html.length > 200 ? "..." : ""));
      console.log("--- [LOG API /api/send-email] END MOCK EMAIL ---");
      return NextResponse.json({ success: true, message: "Email sending is mocked due to missing EmailJS configuration. Check server logs." });
    }

    const sendToAddresses = Array.isArray(to) ? to : [to];
    let allSuccessful = true;
    const detailedMessages: string[] = [];
    let successfulSends = 0;

    console.log(`[LOG API /api/send-email] Attempting to send ${sendToAddresses.length} email(s) via EmailJS.`);

    for (const recipientEmail of sendToAddresses) {
      const templateParams = {
        to_email: recipientEmail,
        subject_line: subject,
        html_body: html,
        from_name: 'CampusHub Notifications', // Ensure your EmailJS template uses this
        reply_to: recipientEmail, // Recommended
      };

      try {
        console.log(`[LOG API /api/send-email] Sending to ${recipientEmail} with subject "${subject}"`);
        const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, USER_ID);
        console.log(`[LOG API /api/send-email] EmailJS success for ${recipientEmail}: Status ${response.status}, Text: ${response.text}`);
        detailedMessages.push(`Email successfully sent to ${recipientEmail}.`);
        successfulSends++;
      } catch (error: any) {
        console.error(`[LOG API /api/send-email] Failed to send email to ${recipientEmail}. Status: ${error?.status}, Text: ${error?.text}. Full error:`, error);
        detailedMessages.push(`Failed for ${recipientEmail}: ${error?.text || error?.message || 'Unknown EmailJS error'}`);
        allSuccessful = false;
      }
    }

    const overallMessage = allSuccessful
      ? `Successfully dispatched ${successfulSends} email(s).`
      : `Email dispatch attempted. ${successfulSends} sent. Failures: ${detailedMessages.filter(m => m.startsWith("Failed")).join('; ')}`;
    
    console.log(`[LOG API /api/send-email] Result: ${overallMessage}`);
    return NextResponse.json({ success: allSuccessful, message: overallMessage, details: detailedMessages });

  } catch (error: any) {
    console.error('[LOG API /api/send-email] Error processing request:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
