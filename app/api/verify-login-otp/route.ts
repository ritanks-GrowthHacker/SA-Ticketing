import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 });
    }

    // Get user with OTP details
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email, otp, otp_expires_at, created_at")
      .eq("email", email.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Debug logging
    const expiryDate = new Date(user.otp_expires_at + (user.otp_expires_at.includes('Z') ? '' : 'Z'));
    const currentTime = new Date();
    
    console.log('OTP Verification Debug:', {
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

    console.log('OTP Validation Result:', isValidOTP);

    if (!isValidOTP) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // Clear OTP after successful verification
    await supabase
      .from("users")
      .update({
        otp: null,
        otp_expires_at: null
      })
      .eq("id", user.id);

    // Get user organizations and roles
    const { data: userOrganizations, error: orgError } = await supabase
      .from("user_organization")
      .select(`
        organization_id,
        role_id,
        organizations(id, name, domain),
        roles(id, name, description)
      `)
      .eq("user_id", user.id);

    if (orgError) {
      console.error("Organization lookup error:", orgError);
      return NextResponse.json(
        { error: "Failed to fetch user organizations" }, 
        { status: 500 }
      );
    }

    if (!userOrganizations || userOrganizations.length === 0) {
      return NextResponse.json(
        { error: "User is not associated with any organization" }, 
        { status: 403 }
      );
    }

    const primaryOrg = userOrganizations[0] as any;
    const organization = primaryOrg.organizations;
    const role = primaryOrg.roles;

    const allRoles = userOrganizations
      .map((uo: any) => uo.roles?.name)
      .filter(Boolean) as string[];

    // Generate JWT token
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      org_id: organization.id,
      org_name: organization.name,
      org_domain: organization.domain,
      role: role?.name || "Member",
      roles: allRoles,
      iss: process.env.JWT_ISSUER,
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    const responseData = {
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at
      },
      organization: {
        id: organization.id,
        name: organization.name,
        domain: organization.domain
      },
      role: role?.name || "Member",
      roles: allRoles,
      token,
      organizations: userOrganizations.map((uo: any) => ({
        id: uo.organizations.id,
        name: uo.organizations.name,
        domain: uo.organizations.domain,
        role: uo.roles?.name || "Member"
      }))
    };

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error("VERIFY LOGIN OTP ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}