import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    const { email, otp, userData } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 });
    }

    // Get user with OTP details
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email, otp, otp_expires_at")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Debug logging
    const expiryDate = new Date(user.otp_expires_at + (user.otp_expires_at.includes('Z') ? '' : 'Z'));
    const currentTime = new Date();
    
    console.log('Registration OTP Verification Debug:', {
      storedOTP: user.otp,
      providedOTP: otp,
      expiryTimeRaw: user.otp_expires_at,
      expiryTimeParsed: expiryDate.toISOString(),
      currentTime: currentTime.toISOString(),
      isExpired: currentTime > expiryDate,
      otpMatches: user.otp === otp
    });

    // Validate OTP
    const isValidOTP = OTPService.isOTPValid(
      user.otp,
      otp,
      expiryDate
    );

    console.log('Registration OTP Validation Result:', isValidOTP);

    if (!isValidOTP) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // Clear OTP after verification
    const { error: updateError } = await supabase
      .from("users")
      .update({
        otp: null,
        otp_expires_at: null
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to verify user" }, { status: 500 });
    }

    // Get organization from userData
    const { organization_id } = userData;

    // Get default role for the organization
    const { data: role } = await supabase
      .from("roles")
      .select("id, name")
      .eq("organization_id", organization_id)
      .eq("name", "Member")
      .maybeSingle();

    // Create user-organization relationship
    await supabase
      .from("user_organization")
      .insert([{ 
        user_id: user.id, 
        organization_id, 
        role_id: role?.id || null 
      }]);

    // Get user roles for token
    const { data: roles } = await supabase
      .from("roles")
      .select("name")
      .in(
        "id",
        (
          await supabase
            .from("user_organization")
            .select("role_id")
            .eq("user_id", user.id)
        ).data?.map((r: any) => r.role_id) || []
      );

    const roleNames = roles?.map((r) => r.name) || [];

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        org_id: organization_id,
        roles: roleNames,
        iss: process.env.JWT_ISSUER,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }, 
      token 
    }, { status: 200 });

  } catch (err) {
    console.error("VERIFY REGISTRATION OTP ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}