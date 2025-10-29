import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    const { email, type } = await req.json();

    if (!email || !type) {
      return NextResponse.json({ error: "Email and type are required" }, { status: 400 });
    }

    if (!['registration', 'login'].includes(type)) {
      return NextResponse.json({ error: "Invalid type. Must be 'registration' or 'login'" }, { status: 400 });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new OTP
    const otp = OTPService.generateOTP();
    const otpExpiresAt = OTPService.getExpiryTime();

    // Update user with new OTP
    const { error: updateError } = await supabase
      .from("users")
      .update({
        otp,
        otp_expires_at: otpExpiresAt.toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("OTP update error:", updateError);
      return NextResponse.json({ error: "Failed to generate new OTP" }, { status: 500 });
    }

    // Send OTP email
    const emailSent = await OTPService.sendOTP(email, otp, type);
    
    if (!emailSent) {
      return NextResponse.json({ 
        error: "Failed to send OTP email. Please try again." 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: `New ${type} OTP sent successfully. Please check your email.`
    }, { status: 200 });

  } catch (error) {
    console.error("RESEND OTP ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}