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

    // Get updated user info with organization_id and profile picture
    const { data: fullUser, error: fullUserError } = await supabase
      .from("users")
      .select("id, name, email, organization_id, department_id, created_at, profile_picture_url, about, phone, location, job_title")
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

    // Get user's department roles (department-level roles) ordered by created_at
    const { data: departmentRoles, error: deptRoleError } = await supabase
      .from("user_department_roles")
      .select(`
        department_id,
        role_id,
        organization_id,
        created_at,
        departments(id, name),
        global_roles(id, name)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }); // First department = default

    if (deptRoleError) {
      console.error("Department role lookup error:", deptRoleError);
    }

    // Determine organization: prioritize org roles, fallback to department roles, then user.organization_id
    let organization: any = null;
    let role: any = null;
    let allRoles: string[] = [];
    let currentDepartment: any = null; // The active department for JWT
    let currentDepartmentRole: string | null = null; // User's role in the current department

    if (userOrganizations && userOrganizations.length > 0) {
      // User has org-level role
      const primaryOrg = userOrganizations[0] as any;
      organization = primaryOrg.organizations;
      role = primaryOrg.global_roles;
      allRoles = userOrganizations
        .map((uo: any) => uo.global_roles?.name)
        .filter(Boolean) as string[];
      
      // If user also has department roles, set first department as current
      if (departmentRoles && departmentRoles.length > 0) {
        const firstDept = departmentRoles[0] as any;
        currentDepartment = firstDept.departments;
        currentDepartmentRole = firstDept.global_roles?.name || null;
      }
    } else if (departmentRoles && departmentRoles.length > 0) {
      // User only has department-level role, get org from department role
      const primaryDeptRole = departmentRoles[0] as any;
      const orgId = primaryDeptRole.organization_id || fullUser.organization_id;
      
      // Set first department as current
      currentDepartment = primaryDeptRole.departments;
      currentDepartmentRole = primaryDeptRole.global_roles?.name || null;
      
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

    // Get all departments user is part of
    const allDepartments = (departmentRoles || []).map((dr: any) => ({
      id: dr.department_id,
      name: dr.departments?.name,
      role: dr.global_roles?.name
    }));

    // Get default project: PRIORITIZE project assignment, not department
    let defaultProject: any = null;
    let defaultProjectRole: string = "Member";
    
    // First, try to get user's assigned projects (user_project table)
    const { data: assignedProjects } = await supabase
      .from('user_project')
      .select(`
        project_id,
        projects!inner(id, name),
        global_roles!user_project_role_id_fkey(id, name)
      `)
      .eq('user_id', user.id)
      .eq('projects.organization_id', organization.id)
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (assignedProjects && assignedProjects.length > 0) {
      const firstAssignment = assignedProjects[0] as any;
      defaultProject = firstAssignment.projects;
      defaultProjectRole = firstAssignment.global_roles?.name || 'Member';
    } else if (currentDepartment?.id && currentDepartmentRole === 'Admin') {
      // Fallback: Department Admin sees first project in their department
      const { data: deptProjects } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          project_department!inner(department_id)
        `)
        .eq('organization_id', organization.id)
        .eq('project_department.department_id', currentDepartment.id)
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (deptProjects && deptProjects.length > 0) {
        defaultProject = deptProjects[0];
        defaultProjectRole = 'Admin'; // Department admin gets admin in projects
      }
    }

    // Generate JWT token with PROJECT ROLE as dominant
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      org_id: organization.id,
      org_name: organization.name,
      org_domain: organization.domain,
      org_role: role?.name || "Member", // Organization role (for profile only)
      project_id: defaultProject?.id || null,
      project_name: defaultProject?.name || null,
      project_role: defaultProjectRole, // THIS IS THE DOMINANT ROLE
      role: defaultProjectRole, // Alias for compatibility
      roles: [defaultProjectRole], // Active role array
      departments: allDepartments, // All departments user is part of
      department_id: currentDepartment?.id || null, // Current department (can be switched)
      department_name: currentDepartment?.name || null,
      department_role: currentDepartmentRole, // Role in current department
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
        created_at: user.created_at,
        profile_picture_url: fullUser.profile_picture_url,
        about: fullUser.about,
        phone: fullUser.phone,
        location: fullUser.location,
        job_title: fullUser.job_title
      },
      organization: {
        id: organization.id,
        name: organization.name,
        domain: organization.domain,
        role: role?.name || "Member" // Org-level role for display
      },
      project: defaultProject ? {
        id: defaultProject.id,
        name: defaultProject.name,
        role: defaultProjectRole // THIS IS THE DOMINANT ROLE
      } : null,
      department: currentDepartment ? {
        id: currentDepartment.id,
        name: currentDepartment.name,
        role: currentDepartmentRole
      } : null,
      departments: allDepartments, // All departments user is part of
      role: defaultProjectRole, // The active role (project-based)
      roles: [defaultProjectRole],
      token,
      hasMultipleDepartments: allDepartments.length > 1,
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