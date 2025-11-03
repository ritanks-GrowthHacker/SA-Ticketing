import { NextResponse } from "next/server";
import { supabase } from "@/app/db/connections";
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
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (userError || !user) {
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
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString(),
        // Clear the OTP fields after successful password reset
        otp: null,
        otp_expires_at: null,
        otp_verified: false
      })
      .eq("id", user.id)
      .select("id, email")
      .single();

    if (updateError) {
      console.error("❌ Failed to update password:", updateError);
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