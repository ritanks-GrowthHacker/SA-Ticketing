import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    const { name, email, password, organization_domain } = await req.json();

    if (!name || !email || !password || !organization_domain) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const { data: organization } = await supabase
      .from("organizations")
      .select("id, name, domain")
      .eq("domain", organization_domain)
      .maybeSingle();

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const emailDomain = email.split('@')[1];
    if (emailDomain !== organization.domain) {
      return NextResponse.json({ 
        error: `Email must be from ${organization.domain} domain` 
      }, { status: 400 });
    }

    const organization_id = organization.id;

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Generate OTP and hash password
    const otp = OTPService.generateOTP();
    const otpExpiresAt = OTPService.getExpiryTime();
    const password_hash = await bcrypt.hash(password, 10);

    console.log('Registration OTP Generation Debug:', {
      email,
      generatedOTP: otp,
      expiryTime: otpExpiresAt.toISOString()
    });

    // Store user with OTP
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert([{ 
        name, 
        email, 
        password_hash,
        otp,
        otp_expires_at: otpExpiresAt.toISOString()
      }])
      .select("id, name, email, created_at")
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // Send OTP email
    const emailSent = await OTPService.sendOTP(email, otp, 'registration');
    
    if (!emailSent) {
      // Clean up user if email fails
      await supabase.from("users").delete().eq("id", user.id);
      return NextResponse.json({ 
        error: "Failed to send OTP. Please try again." 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: "Registration initiated. Please check your email for OTP.",
      email,
      userData: { name, email, password_hash, organization_id }
    }, { status: 200 });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
