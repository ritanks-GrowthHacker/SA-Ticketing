import { NextResponse } from "next/server";
import { db, organizations, eq } from "@/lib/db-helper";
import bcrypt from "bcrypt";

interface ResetPasswordRequest {
  email?: string;
  username?: string;
  newPassword: string;
  confirmPassword: string;
}

export async function POST(req: Request) {
  try {
    // Parse request body
    let body: ResetPasswordRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid request body" }, 
        { status: 400 }
      );
    }

    // Validate input
    if (!body.email && !body.username) {
      return NextResponse.json(
        { error: "Email or username is required" }, 
        { status: 400 }
      );
    }

    if (!body.newPassword || !body.confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirm password are required" }, 
        { status: 400 }
      );
    }

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" }, 
        { status: 400 }
      );
    }

    if (body.newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" }, 
        { status: 400 }
      );
    }

    console.log(`🔐 Resetting organization password...`);

    // Get organization by email or username
    let organization;
    
    if (body.email) {
      const email = body.email.toLowerCase().trim();
      const orgResults = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          orgEmail: organizations.orgEmail,
          username: organizations.username
        })
        .from(organizations)
        .where(eq(organizations.orgEmail, email))
        .limit(1);
      
      organization = orgResults[0];
    } else if (body.username) {
      const username = body.username.toLowerCase().trim();
      const orgResults = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          orgEmail: organizations.orgEmail,
          username: organizations.username
        })
        .from(organizations)
        .where(eq(organizations.username, username))
        .limit(1);
      
      organization = orgResults[0];
    }

    if (!organization) {
      console.log(`❌ Organization not found`);
      return NextResponse.json(
        { error: "Organization not found" }, 
        { status: 404 }
      );
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.newPassword, saltRounds);

    console.log(`🔒 Generated password hash for organization ${organization.name}`);

    // Update password in database
    const updatedOrg = await db
      .update(organizations)
      .set({
        passwordHash: hashedPassword,
        updatedAt: new Date(),
        // Clear the OTP fields after successful password reset
        otp: null,
        otpExpiresAt: null,
        otpVerified: true
      })
      .where(eq(organizations.id, organization.id))
      .returning({
        id: organizations.id,
        name: organizations.name,
        orgEmail: organizations.orgEmail
      })
      .then(rows => rows[0] || null);

    if (!updatedOrg) {
      console.error("❌ Failed to update organization password");
      return NextResponse.json(
        { error: "Failed to update password" }, 
        { status: 500 }
      );
    }

    console.log(`✅ Password reset successfully for organization ${organization.name}`);

    return NextResponse.json({
      success: true,
      message: "Organization password has been reset successfully"
    }, { status: 200 });

  } catch (error) {
    console.error("💥 Reset organization password API error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
