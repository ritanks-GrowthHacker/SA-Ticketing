import { NextResponse } from "next/server";
// import { supabase } from "@/app/db/connections";
import { db, users, eq } from "@/lib/db-helper";
import bcrypt from "bcrypt";

interface ResetPasswordRequest {
  email: string;
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
    if (!body.email || !body.newPassword || !body.confirmPassword) {
      return NextResponse.json(
        { error: "Email, new password, and confirm password are required" }, 
        { status: 400 }
      );
    }

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" }, 
        { status: 400 }
      );
    }

    if (body.newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" }, 
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();

    console.log(`🔐 Resetting password for ${email}...`);

    // Get user
    const user = await db
      .select({
        id: users.id,
        email: users.email
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!user) {
      console.log(`❌ User not found for email: ${email}`);
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 404 }
      );
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(body.newPassword, saltRounds);

    console.log(`🔒 Generated password hash for ${email}`);

    // Update password in database
    const updatedUser = await db
      .update(users)
      .set({
        passwordHash: hashedPassword,
        updatedAt: new Date(),
        // Clear the OTP fields after successful password reset
        otp: null,
        otpExpiresAt: null
      })
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        email: users.email
      })
      .then(rows => rows[0] || null);

    if (!updatedUser) {
      console.error("❌ Failed to update password");
      return NextResponse.json(
        { error: "Failed to update password" }, 
        { status: 500 }
      );
    }

    console.log(`✅ Password reset successfully for ${email}`);

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully"
    }, { status: 200 });

  } catch (error) {
    console.error("💥 Reset password API error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}