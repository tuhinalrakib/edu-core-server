import nodemailer from "nodemailer";

export const sendEmail = async (to: string, subject: string, html: string) => {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.DEFAULT_FROM_EMAIL || "eng.tuhin77@gmail.com";

  // 1. Try sending via Brevo API v3 REST endpoint
  if (brevoApiKey) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "api-key": brevoApiKey,
        },
        body: JSON.stringify({
          sender: { name: "EduCore LMS", email: fromEmail },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log("Brevo API Email sent successfully to:", to, "MessageId:", data.messageId || data);
        return true;
      } else {
        console.warn("Brevo API Email error response:", data);
      }
    } catch (apiError) {
      console.error("Brevo API send error:", apiError);
    }
  }

  // 2. Fallback to Nodemailer SMTP transport
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      auth: {
        user: process.env.SMTP_USER || fromEmail,
        pass: process.env.SMTP_PASS || brevoApiKey || "mock_pass",
      },
    });

    const info = await transporter.sendMail({
      from: `"EduCore LMS" <${fromEmail}>`,
      to,
      subject,
      html,
    });
    console.log("Nodemailer Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.warn("Email sending failed:", error);
    return false;
  }
};
