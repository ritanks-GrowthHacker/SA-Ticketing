import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    // 🔍 Better JSON parsing with error handling
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError);
      return NextResponse.json(
        { error: "Invalid JSON format in request body" }, 
        { status: 400 }
      );
    }

    const { email, password } = requestBody;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" }, 
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" }, 
        { status: 400 }
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email, password_hash, created_at")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (userError) {
      console.error("User lookup error:", userError);
      return NextResponse.json(
        { error: "Internal Server Error" }, 
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" }, 
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" }, 
        { status: 401 }
      );
    }

    // Generate OTP for login verification
    const otp = OTPService.generateOTP();
    const otpExpiresAt = OTPService.getExpiryTime();

    console.log('Login OTP Generation Debug:', {
      email,
      userId: user.id,
      generatedOTP: otp,
      expiryTime: otpExpiresAt.toISOString()
    });

    // Update user with login OTP
    const { error: updateError } = await supabase
      .from("users")
      .update({
        otp,
        otp_expires_at: otpExpiresAt.toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("OTP update error:", updateError);
      return NextResponse.json(
        { error: "Failed to generate login code" }, 
        { status: 500 }
      );
    }

    // Send OTP email
    const emailSent = await OTPService.sendOTP(email, otp, 'login');
    
    if (!emailSent) {
      return NextResponse.json({ 
        error: "Failed to send login OTP. Please try again." 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: "Login OTP sent. Please check your email.",
      email,
      userId: user.id
    }, { status: 200 });

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}


