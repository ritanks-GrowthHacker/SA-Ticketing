import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
// import { supabase } from "@/app/db/connections";
import { db, users, invitations, userDepartmentRoles, globalRoles, userOrganizationRoles, eq, and } from "@/lib/db-helper";
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    const { invitationId, email, password, name, phone } = await req.json();

    if (!invitationId || !email || !password || !name) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Get invitation details to get organization_id
    const invitation = await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.id, invitationId),
        eq(invitations.email, email),
        eq(invitations.status, 'pending')
      ))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
    }

    const existingUser = await db
      .select({
        id: users.id,
        email: users.email,
        organizationId: users.organizationId
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then(rows => rows[0] || null);

    if (existingUser) {
      // User exists - check if they're already in this department
      const existingDeptRole = await db
        .select({ id: userDepartmentRoles.id })
        .from(userDepartmentRoles)
        .where(and(
          eq(userDepartmentRoles.userId, existingUser.id),
          eq(userDepartmentRoles.departmentId, invitation.departmentId),
          eq(userDepartmentRoles.organizationId, invitation.organizationId)
        ))
        .limit(1)
        .then(rows => rows[0] || null);

      if (existingDeptRole) {
        return NextResponse.json({ 
          error: "User already exists in this department" 
        }, { status: 400 });
      }

      // User exists but in different department - add them to new department
      console.log("Adding existing user to new department:", {
        userId: existingUser.id,
        email: email,
        newDepartmentId: invitation.departmentId
      });

      // Get Member role
      const memberRole = await db
        .select({ id: globalRoles.id })
        .from(globalRoles)
        .where(eq(globalRoles.name, "Member"))
        .limit(1)
        .then(rows => rows[0] || null);

      if (memberRole && invitation.departmentId) {
        // Add user to new department
        await db
          .insert(userDepartmentRoles)
          .values({
            userId: existingUser.id,
            departmentId: invitation.departmentId,
            organizationId: invitation.organizationId,
            roleId: memberRole.id
          });
      }

      // Mark invitation as completed
      await db
        .update(invitations)
        .set({ status: 'completed' })
        .where(eq(invitations.id, invitationId));

      return NextResponse.json({ 
        success: true,
        message: "User added to new department successfully. You can now login with your existing credentials.",
        existingUser: true,
        email
      }, { status: 200 });
    }

    // Generate OTP and hash password - exactly like register-user API
    const otp = OTPService.generateOTP();
    const otpExpiresAt = OTPService.getExpiryTime();
    const password_hash = await bcrypt.hash(password, 10);

    // Store user with OTP and invitation details
    const user = await db
      .insert(users)
      .values({ 
        name, 
        email, 
        passwordHash: password_hash,
        phone: phone || null,
        organizationId: invitation.organizationId,
        departmentId: invitation.departmentId,
        otp,
        otpExpiresAt: otpExpiresAt,
        createdAt: new Date()
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt
      })
      .then(rows => rows[0] || null);

    if (!user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // Assign default "Member" role to the user
    const memberRole = await db
      .select({ id: globalRoles.id })
      .from(globalRoles)
      .where(eq(globalRoles.name, "Member"))
      .limit(1)
      .then(rows => rows[0] || null);

    if (memberRole) {
      // Assign organization-level Member role
      await db
        .insert(userOrganizationRoles)
        .values({
          userId: user.id,
          organizationId: invitation.organizationId,
          roleId: memberRole.id
        });

      // Also assign department-level Member role
      if (invitation.departmentId) {
        await db
          .insert(userDepartmentRoles)
          .values({
            userId: user.id,
            departmentId: invitation.departmentId,
            organizationId: invitation.organizationId,
            roleId: memberRole.id
          });
      }
    }

    // Send OTP email
    const emailSent = await OTPService.sendOTP(email, otp, 'registration');
    
    if (!emailSent) {
      // Clean up user if email fails
      await db.delete(users).where(eq(users.id, user.id));
      return NextResponse.json({ 
        error: "Failed to send OTP. Please try again." 
      }, { status: 500 });
    }

    // Mark invitation as completed
    await db
      .update(invitations)
      .set({ status: 'completed' })
      .where(eq(invitations.id, invitationId));

    return NextResponse.json({ 
      success: true,
      message: "Registration completed. Please check your email for OTP.",
      email,
      userData: { name, email, password_hash, organizationId: invitation.organizationId }
    }, { status: 200 });
  } catch (err) {
    console.error("REGISTRATION ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}