import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";

export async function POST(req: Request) {
  try {
    // Parse request body
    let body: { email: string; otp: string };
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid request body" }, 
        { status: 400 }
      );
    }

    // Validate input
    if (!body.email || !body.otp) {
      return NextResponse.json(
        { error: "Email and OTP are required" }, 
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();
    const otp = body.otp.trim();

    console.log(`🔍 Verifying password reset OTP for ${email}...`);

    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (userError || !user) {
      console.log(`❌ User not found for email: ${email}`);
      return NextResponse.json(
        { error: "Invalid email or OTP" }, 
        { status: 400 }
      );
    }

    // Check OTP from users table
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("id, otp, otp_expires_at, otp_verified")
      .eq("email", email)
      .single();

    if (userDataError || !userData) {
      console.log(`❌ User data not found for ${email}`);
      return NextResponse.json(
        { error: "Invalid email or OTP" }, 
        { status: 400 }
      );
    }

    if (!userData.otp) {
      console.log(`❌ No OTP found for ${email}`);
      return NextResponse.json(
        { error: "No OTP found. Please request a new password reset." }, 
        { status: 400 }
      );
    }

    const now = new Date();
    // Handle timezone for database timestamp without timezone
    const expiresAt = userData.otp_expires_at ? new Date(userData.otp_expires_at + 'Z') : null;
    
    // Debug logging for timezone issues
    console.log(`🔍 OTP Debug Info for ${email}:`);
    console.log(`   Stored OTP: ${userData.otp}`);
    console.log(`   Provided OTP: ${otp}`);
    console.log(`   Raw DB Expiry: ${userData.otp_expires_at}`);
    console.log(`   Current Time: ${now.toISOString()} (${now.getTime()})`);
    console.log(`   Expires At: ${expiresAt ? expiresAt.toISOString() : 'null'} (${expiresAt ? expiresAt.getTime() : 'null'})`);
    console.log(`   Time Difference: ${expiresAt ? (expiresAt.getTime() - now.getTime()) / 1000 : 'null'} seconds`);
    
    const otpValid = userData.otp === otp;
    const otpExpired = expiresAt ? now > expiresAt : true;

    if (!otpValid) {
      console.log(`❌ Invalid OTP provided for ${email}`);
      return NextResponse.json(
        { error: "Invalid OTP" }, 
        { status: 400 }
      );
    }

    if (otpExpired) {
      console.log(`❌ Expired OTP used for ${email}`);
      // Clear expired OTP
      await supabase
        .from("users")
        .update({ 
          otp: null,
          otp_expires_at: null,
          otp_verified: false,
          updated_at: new Date().toISOString()
        })
        .eq("id", userData.id);
      
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." }, 
        { status: 400 }
      );
    }

    // OTP is valid, mark as verified and clear it (one-time use)
    await supabase
      .from("users")
      .update({ 
        otp: null,
        otp_expires_at: null,
        otp_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", userData.id);

    console.log(`✅ Password reset OTP verified successfully for ${email}`);

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
      userId: user.id
    }, { status: 200 });

  } catch (error) {
    console.error("💥 Verify password reset OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}