import { NextResponse } from "next/server";
// import { supabase } from "@/app/db/connections";
import { db, users, eq } from "@/lib/db-helper";
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
    const user = await db
      .select({
        id: users.id,
        email: users.email
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new OTP
    const otp = OTPService.generateOTP();
    const otpExpiresAt = OTPService.getExpiryTime();

    if (type === 'password-reset') {
      // Handle password reset OTP - store in users table
      try {
        await db
          .update(users)
          .set({
            otp: otp,
            otpExpiresAt: otpExpiresAt,
            updatedAt: new Date()
          })
          .where(eq(users.id, user.id));
      } catch (e) {
        console.error("Error storing password reset OTP:", e);
        return NextResponse.json({ error: "Failed to generate new OTP" }, { status: 500 });
      }
    } else {
      // Handle login/registration OTP
      try {
        await db
          .update(users)
          .set({
            otp,
            otpExpiresAt: otpExpiresAt
          })
          .where(eq(users.id, user.id));
      } catch (updateError) {
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