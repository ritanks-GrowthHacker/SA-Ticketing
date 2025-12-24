import { NextResponse } from "next/server";
import { db, organizations, eq } from "@/lib/db-helper";

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

    console.log(`🔍 Verifying organization password reset OTP for ${email}...`);

    // Get organization with OTP details
    const orgData = await db
      .select({
        id: organizations.id,
        orgEmail: organizations.orgEmail,
        otp: organizations.otp,
        otpExpiresAt: organizations.otpExpiresAt
      })
      .from(organizations)
      .where(eq(organizations.orgEmail, email))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!orgData) {
      console.log(`❌ Organization not found for email: ${email}`);
      return NextResponse.json(
        { error: "Invalid email or OTP" }, 
        { status: 400 }
      );
    }

    if (!orgData.otp) {
      console.log(`❌ No OTP found for organization ${email}`);
      return NextResponse.json(
        { error: "No OTP found. Please request a new password reset." }, 
        { status: 400 }
      );
    }

    const now = new Date();
    // Handle timezone for database timestamp without timezone
    const expiresAt = orgData.otpExpiresAt ? new Date(orgData.otpExpiresAt.toString() + (orgData.otpExpiresAt.toString().includes('Z') ? '' : 'Z')) : null;
    
    // Debug logging for timezone issues
    console.log(`🔍 Organization OTP Debug Info for ${email}:`);
    console.log(`   Stored OTP: ${orgData.otp}`);
    console.log(`   Provided OTP: ${otp}`);
    console.log(`   Raw DB Expiry: ${orgData.otpExpiresAt}`);
    console.log(`   Current Time: ${now.toISOString()} (${now.getTime()})`);
    console.log(`   Expires At: ${expiresAt ? expiresAt.toISOString() : 'null'} (${expiresAt ? expiresAt.getTime() : 'null'})`);
    console.log(`   Time Difference: ${expiresAt ? (expiresAt.getTime() - now.getTime()) / 1000 : 'null'} seconds`);
    
    const otpValid = orgData.otp === otp;
    const otpExpired = expiresAt ? now > expiresAt : true;

    if (!otpValid) {
      console.log(`❌ Invalid OTP provided for organization ${email}`);
      return NextResponse.json(
        { error: "Invalid OTP" }, 
        { status: 400 }
      );
    }

    if (otpExpired) {
      console.log(`❌ Expired OTP used for organization ${email}`);
      // Clear expired OTP
      await db
        .update(organizations)
        .set({ 
          otp: null,
          otpExpiresAt: null,
          updatedAt: new Date()
        })
        .where(eq(organizations.id, orgData.id));
      
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." }, 
        { status: 400 }
      );
    }

    // OTP is valid, mark as verified (don't clear yet, needed for password reset)
    await db
      .update(organizations)
      .set({ 
        otpVerified: true,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, orgData.id));

    console.log(`✅ Organization password reset OTP verified successfully for ${email}`);

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
      organizationId: orgData.id
    }, { status: 200 });

  } catch (error) {
    console.error("💥 Verify organization password reset OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
