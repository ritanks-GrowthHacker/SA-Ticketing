import { NextResponse } from "next/server";
// import { supabase } from "@/app/db/connections";
import { db, users, eq } from "@/lib/db-helper";

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

    // Get user with OTP details
    const userData = await db
      .select({
        id: users.id,
        email: users.email,
        otp: users.otp,
        otpExpiresAt: users.otpExpiresAt
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!userData) {
      console.log(`❌ User not found for email: ${email}`);
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
    const expiresAt = userData.otpExpiresAt ? new Date(userData.otpExpiresAt.toString() + (userData.otpExpiresAt.toString().includes('Z') ? '' : 'Z')) : null;
    
    // Debug logging for timezone issues
    console.log(`🔍 OTP Debug Info for ${email}:`);
    console.log(`   Stored OTP: ${userData.otp}`);
    console.log(`   Provided OTP: ${otp}`);
    console.log(`   Raw DB Expiry: ${userData.otpExpiresAt}`);
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
      await db
        .update(users)
        .set({ 
          otp: null,
          otpExpiresAt: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, userData.id));
      
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." }, 
        { status: 400 }
      );
    }

    // OTP is valid, clear it (one-time use)
    await db
      .update(users)
      .set({ 
        otp: null,
        otpExpiresAt: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userData.id));

    console.log(`✅ Password reset OTP verified successfully for ${email}`);

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
      userId: userData.id
    }, { status: 200 });

  } catch (error) {
    console.error("💥 Verify password reset OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}