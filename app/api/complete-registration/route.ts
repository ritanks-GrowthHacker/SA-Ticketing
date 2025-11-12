import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { supabase } from "@/app/db/connections";
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    const { invitationId, email, password, name, phone } = await req.json();

    if (!invitationId || !email || !password || !name) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Get invitation details to get organization_id
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Generate OTP and hash password - exactly like register-user API
    const otp = OTPService.generateOTP();
    const otpExpiresAt = OTPService.getExpiryTime();
    const password_hash = await bcrypt.hash(password, 10);

    // Store user with OTP and invitation details
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert([{ 
        name, 
        email, 
        password_hash,
        phone: phone || null,
        organization_id: invitation.organization_id,
        department_id: invitation.department_id,
        department: invitation.departments?.name,
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

    // Mark invitation as completed
    await supabase
      .from('invitations')
      .update({ status: 'completed' })
      .eq('id', invitationId);

    return NextResponse.json({ 
      success: true,
      message: "Registration completed. Please check your email for OTP.",
      email,
      userData: { name, email, password_hash, organization_id: invitation.organization_id }
    }, { status: 200 });
  } catch (err) {
    console.error("REGISTRATION ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}