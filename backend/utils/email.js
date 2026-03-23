const nodemailer = require("nodemailer");

let transport;

function getTransport() {
  if (transport) return transport;

  const hasSmtp =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (hasSmtp) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // fallback (logs email instead of sending)
    transport = nodemailer.createTransport({ jsonTransport: true });
  }

  return transport;
}

async function sendOtpEmail({ to, code }) {
  const transporter = getTransport();

  try {
    const info = await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        "MAHIMA CHATRABAS <no-reply@mahima.local>",
      to,
      subject: "Your OTP for MAHIMA CHATRABAS",
      text: `Your OTP is ${code}. It expires in 10 minutes.`,
      html: `<p>Your OTP is <b>${code}</b>. It expires in 10 minutes.</p>`,
    });

    console.log("✅ Email sent:", info.response);

    return { success: true };

  } catch (error) {
    console.error("❌ EMAIL FAILED:", error.message);

    // 🔥 IMPORTANT: Show OTP in logs (for Render debugging)
    console.log("🔑 OTP (DEBUG):", code);

    // return OTP so you can use it in API response if needed
    return {
      success: false,
      otp: code,
      error: error.message,
    };
  }
}

module.exports = {
  sendOtpEmail,
};
