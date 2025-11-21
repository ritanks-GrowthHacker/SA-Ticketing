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
      .select("id, email, organization_id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      // User exists - check if they're already in this department
      const { data: existingDeptRole } = await supabase
        .from("user_department_roles")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("department_id", invitation.department_id)
        .eq("organization_id", invitation.organization_id)
        .maybeSingle();

      if (existingDeptRole) {
        return NextResponse.json({ 
          error: "User already exists in this department" 
        }, { status: 400 });
      }

      // User exists but in different department - add them to new department
      console.log("Adding existing user to new department:", {
        userId: existingUser.id,
        email: email,
        newDepartmentId: invitation.department_id
      });

      // Get Member role
      const { data: memberRole } = await supabase
        .from("global_roles")
        .select("id")
        .eq("name", "Member")
        .single();

      if (memberRole && invitation.department_id) {
        // Add user to new department
        const { error: deptRoleError } = await supabase
          .from("user_department_roles")
          .insert({
            user_id: existingUser.id,
            department_id: invitation.department_id,
            organization_id: invitation.organization_id,
            role_id: memberRole.id
          });

        if (deptRoleError) {
          console.error("Failed to add user to department:", deptRoleError);
          return NextResponse.json({ 
            error: "Failed to add user to department" 
          }, { status: 500 });
        }
      }

      // Mark invitation as completed
      await supabase
        .from('invitations')
        .update({ status: 'completed' })
        .eq('id', invitationId);

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

    // Assign default "Member" role to the user
    const { data: memberRole } = await supabase
      .from("global_roles")
      .select("id")
      .eq("name", "Member")
      .single();

    if (memberRole) {
      // Assign organization-level Member role
      await supabase
        .from("user_organization_roles")
        .insert({
          user_id: user.id,
          organization_id: invitation.organization_id,
          role_id: memberRole.id
        });

      // Also assign department-level Member role
      if (invitation.department_id) {
        await supabase
          .from("user_department_roles")
          .insert({
            user_id: user.id,
            department_id: invitation.department_id,
            organization_id: invitation.organization_id,
            role_id: memberRole.id
          });
      }
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