import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";

interface EmailRequestBody {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "rihina.techorzo@gmail.com",
    pass: "wdufgyawvizccnwc",
  },
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: EmailRequestBody = await req.json();
    const { to, subject = "Team Assignment", text, html } = body;

    if (!to) {
      return NextResponse.json(
        { error: "Missing 'to' field (receiver email)" },
        { status: 400 }
      );
    }

    const mailOptions = {
      from: "rihina.techorzo@gmail.com",
      to,
      subject,
      text: text || "Hi there, You have been assigned to a new project!",
      html: html,
    };

    const response = await transporter.sendMail(mailOptions);

    console.log("Email sent:", response.messageId);
    return NextResponse.json({ 
      success: true, 
      messageId: response.messageId,
      message: "Email sent successfully"
    });
  } catch (error) {
    console.error("Error sending email:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Test endpoint to verify email configuration
export async function GET(): Promise<NextResponse> {
  try {
    // Verify the transporter configuration
    await transporter.verify();
    return NextResponse.json({ 
      success: true, 
      message: "Email service is configured correctly" 
    });
  } catch (error) {
    console.error("Email configuration error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Email service configuration failed';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}