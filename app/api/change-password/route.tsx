import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";
import bcrypt from "bcrypt";

interface JWTPayload {
  sub: string;        // user ID
  org_id: string;     // organization ID
  org_name: string;   // organization name
  org_domain: string; // organization domain
  role: string;       // user role
  roles: string[];    // all user roles
  iat?: number;
  exp?: number;
}

interface ChangePasswordRequest {
  otp: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export async function POST(req: Request) {
  try {
    // Get JWT token from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token is required" }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: JWTPayload;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    // Parse request body
    let body: ChangePasswordRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid request body" }, 
        { status: 400 }
      );
    }

    // Validate input
    if (!body.otp || !body.currentPassword || !body.newPassword || !body.confirmPassword) {
      return NextResponse.json(
        { error: "All fields are required" }, 
        { status: 400 }
      );
    }

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json(
        { error: "New passwords do not match" }, 
        { status: 400 }
      );
    }

    if (body.newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long" }, 
        { status: 400 }
      );
    }

    // Get user with current password
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, password_hash")
      .eq("id", decodedToken.sub)
      .single();

    if (userError || !user) {
      console.error("User fetch error:", userError);
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 404 }
      );
    }

    // Verify current password
    if (user.password_hash) {
      const isCurrentPasswordValid = await bcrypt.compare(body.currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" }, 
          { status: 400 }
        );
      }
    }

    // Verify OTP (simplified for development - in production, check against database)
    // For now, we'll accept any 6-digit number as valid OTP for development
    if (!/^\d{6}$/.test(body.otp)) {
      return NextResponse.json(
        { error: "Invalid OTP format" }, 
        { status: 400 }
      );
    }

    // TODO: In production, verify OTP against database
    // const { data: otpRecord, error: otpError } = await supabase
    //   .from("user_otps")
    //   .select("*")
    //   .eq("user_id", user.id)
    //   .eq("otp", body.otp)
    //   .eq("purpose", "password_change")
    //   .gt("expires_at", new Date().toISOString())
    //   .single();

    // For development, we'll accept the OTP (remove this in production)
    console.log(`🔐 Verifying OTP: ${body.otp} for user ${user.email}`);

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(body.newPassword, saltRounds);

    // Update password in database
    const { error: updateError } = await supabase
      .from("users")
      .update({
        password_hash: hashedNewPassword,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Password update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update password" }, 
        { status: 500 }
      );
    }

    // TODO: Delete used OTP from database
    // await supabase
    //   .from("user_otps")
    //   .delete()
    //   .eq("user_id", user.id)
    //   .eq("purpose", "password_change");

    console.log(`✅ Password successfully changed for user ${user.email}`);

    return NextResponse.json({
      success: true,
      message: "Password changed successfully"
    }, { status: 200 });

  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}