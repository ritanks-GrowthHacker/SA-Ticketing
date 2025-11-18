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

    // Get updated user info with organization_id
    const { data: fullUser, error: fullUserError } = await supabase
      .from("users")
      .select("id, name, email, organization_id, department_id, created_at")
      .eq("id", user.id)
      .single();

    if (fullUserError || !fullUser) {
      return NextResponse.json({ error: "Failed to fetch user details" }, { status: 500 });
    }

    // Get user organizations from user_organization_roles (org-level roles)
    const { data: userOrganizations, error: orgError } = await supabase
      .from("user_organization_roles")
      .select(`
        organization_id,
        role_id,
        organizations(id, name, domain),
        global_roles!user_organization_roles_role_id_fkey(id, name, description)
      `)
      .eq("user_id", user.id);

    if (orgError) {
      console.error("Organization lookup error:", orgError);
    }

    // Get user's department roles (department-level roles)
    const { data: departmentRoles, error: deptRoleError } = await supabase
      .from("user_department_roles")
      .select(`
        department_id,
        role_id,
        organization_id,
        departments(id, name),
        global_roles(id, name)
      `)
      .eq("user_id", user.id);

    if (deptRoleError) {
      console.error("Department role lookup error:", deptRoleError);
    }

    // Determine organization: prioritize org roles, fallback to department roles, then user.organization_id
    let organization: any = null;
    let role: any = null;
    let allRoles: string[] = [];

    if (userOrganizations && userOrganizations.length > 0) {
      // User has org-level role
      const primaryOrg = userOrganizations[0] as any;
      organization = primaryOrg.organizations;
      role = primaryOrg.global_roles;
      allRoles = userOrganizations
        .map((uo: any) => uo.global_roles?.name)
        .filter(Boolean) as string[];
    } else if (departmentRoles && departmentRoles.length > 0) {
      // User only has department-level role, get org from department role
      const primaryDeptRole = departmentRoles[0] as any;
      const orgId = primaryDeptRole.organization_id || fullUser.organization_id;
      
      if (orgId) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("id, name, domain")
          .eq("id", orgId)
          .single();
        
        if (orgData) {
          organization = orgData;
          role = primaryDeptRole.global_roles;
          allRoles = [role?.name || "Member"];
        }
      }
    } else if (fullUser.organization_id) {
      // Fallback to user's direct organization_id
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name, domain")
        .eq("id", fullUser.organization_id)
        .single();
      
      if (orgData) {
        organization = orgData;
        role = { name: "Member" }; // Default role
        allRoles = ["Member"];
      }
    }

    if (!organization) {
      return NextResponse.json(
        { error: "User is not associated with any organization" }, 
        { status: 403 }
      );
    }

    // Include department-level admin roles
    const departmentAdminRoles = (departmentRoles || [])
      .filter((dr: any) => dr.global_roles?.name === 'Admin')
      .map((dr: any) => ({
        department_id: dr.department_id,
        department_name: dr.departments?.name,
        role: dr.global_roles?.name
      }));

    // Get user's first project from database (for default project context)
    const { data: defaultProjectData, error: projectError } = await supabase
      .from("user_project")
      .select(`
        project_id,
        role_id,
        projects(id, name),
        global_roles(id, name)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    let defaultProject = null;
    let defaultProjectRole = null;

    if (!projectError && defaultProjectData) {
      const projectData = defaultProjectData as any;
      defaultProject = {
        id: projectData.projects?.id,
        name: projectData.projects?.name
      };
      defaultProjectRole = projectData.global_roles?.name;
    }

    // Generate JWT token with project context
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      org_id: organization.id,
      org_name: organization.name,
      org_domain: organization.domain,
      role: role?.name || "Member",
      roles: allRoles,
      department_roles: departmentAdminRoles, // Include department-level roles
      project_id: defaultProject?.id || null, // Add default project ID
      project_name: defaultProject?.name || null, // Add default project name
      project_role: defaultProjectRole || role?.name || "Member", // Project-specific role
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
      currentProject: defaultProject, // Include default project info
      organizations: (userOrganizations || []).map((uo: any) => ({
        id: uo.organizations.id,
        name: uo.organizations.name,
        domain: uo.organizations.domain,
        role: uo.global_roles?.name || "Member"
      }))
    };

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error("VERIFY LOGIN OTP ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}