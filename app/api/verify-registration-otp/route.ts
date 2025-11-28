import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, users, globalRoles, userOrganizationRoles, organizations, eq } from "@/lib/db-helper";
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    const { email, otp, userData } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and OTP are required" }, { status: 400 });
    }

    // Get user with OTP details
    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        otp: users.otp,
        otpExpiresAt: users.otpExpiresAt
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.otp || !user.otpExpiresAt) {
      return NextResponse.json({ error: "No OTP found for this user" }, { status: 400 });
    }

    // Debug logging
    const expiryDate = new Date(user.otpExpiresAt);
    const currentTime = new Date();
    
    console.log('Registration OTP Verification Debug:', {
      storedOTP: user.otp,
      providedOTP: otp,
      expiryTimeRaw: user.otpExpiresAt,
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
    await db
      .update(users)
      .set({
        otp: null,
        otpExpiresAt: null
      })
      .where(eq(users.id, user.id));

    // Get organization from userData
    const { organization_id } = userData;

    // Get default Member role (global)
    const role = await db
      .select({
        id: globalRoles.id,
        name: globalRoles.name
      })
      .from(globalRoles)
      .where(eq(globalRoles.name, "Member"))
      .limit(1)
      .then(rows => rows[0] || null);

    // Create user-organization relationship with role
    if (role?.id) {
      await db
        .insert(userOrganizationRoles)
        .values({ 
          userId: user.id, 
          organizationId: organization_id, 
          roleId: role.id
        });
    }

    // Get organization details for JWT token
    const organization = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        domain: organizations.domain
      })
      .from(organizations)
      .where(eq(organizations.id, organization_id))
      .limit(1)
      .then(rows => rows[0] || null);

    // Get user roles for token
    const userOrgRoles = await db
      .select({
        roleId: userOrganizationRoles.roleId,
        roleName: globalRoles.name
      })
      .from(userOrganizationRoles)
      .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
      .where(eq(userOrganizationRoles.userId, user.id));

    const roleNames = userOrgRoles?.map((r: any) => r.roleName) || [];

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        org_id: organization_id,
        org_name: organization?.name,
        org_domain: organization?.domain,
        role: roleNames[0] || "Member", // Primary role
        roles: roleNames,
        iss: process.env.JWT_ISSUER,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    return NextResponse.json({ 
      success: true,
      message: "Registration verified successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      organization: {
        id: organization?.id,
        name: organization?.name,
        domain: organization?.domain
      },
      role: roleNames[0] || "Member",
      roles: roleNames,
      token 
    }, { status: 200 });

  } catch (err) {
    console.error("VERIFY REGISTRATION OTP ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}