import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    const { email, type } = await req.json();

    if (!email || !type) {
      return NextResponse.json({ error: "Email and type are required" }, { status: 400 });
    }

    if (!['registration', 'login', 'password-reset'].includes(type)) {
      return NextResponse.json({ error: "Invalid type. Must be 'registration', 'login', or 'password-reset'" }, { status: 400 });
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

    if (type === 'password-reset') {
      // Handle password reset OTP differently
      try {
        // Try to store in user_otps table first
        const { error: otpError } = await supabase
          .from("user_otps")
          .upsert({
            user_id: user.id,
            otp: otp,
            purpose: 'password_reset',
            expires_at: otpExpiresAt.toISOString(),
            created_at: new Date().toISOString()
          });

        if (otpError) {
          // Fallback: store in users table
          const { error: userUpdateError } = await supabase
            .from("users")
            .update({
              reset_otp: otp,
              reset_otp_expires: otpExpiresAt.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", user.id);

          if (userUpdateError) {
            console.error("Failed to store password reset OTP:", userUpdateError);
            return NextResponse.json({ error: "Failed to generate new OTP" }, { status: 500 });
          }
        }
      } catch (e) {
        console.error("Error storing password reset OTP:", e);
        return NextResponse.json({ error: "Failed to generate new OTP" }, { status: 500 });
      }
    } else {
      // Handle login/registration OTP
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