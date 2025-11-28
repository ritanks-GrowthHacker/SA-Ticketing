import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, users, userOrganizationRoles, userDepartmentRoles, organizations, departments, globalRoles, userProject, projects, projectDepartment, eq, and, asc } from '@/lib/db-helper';
import { OTPService } from "@/lib/otpService";

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

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
        otpExpiresAt: users.otpExpiresAt,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Debug logging
    const expiryDate = user.otpExpiresAt || new Date();
    const currentTime = new Date();
    
    console.log('OTP Verification Debug:', {
      storedOTP: user.otp,
      providedOTP: otp,
      expiryTimeParsed: expiryDate.toISOString(),
      currentTime: currentTime.toISOString(),
      isExpired: currentTime > expiryDate,
      otpMatches: user.otp === otp
    });

    // Validate OTP
    const isValidOTP = OTPService.isOTPValid(
      user.otp || '',
      otp,
      expiryDate
    );

    console.log('OTP Validation Result:', isValidOTP);

    if (!isValidOTP) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // Clear OTP after successful verification
    await db
      .update(users)
      .set({
        otp: null,
        otpExpiresAt: null
      })
      .where(eq(users.id, user.id));

    // Get updated user info with organization_id and profile picture
    const fullUser = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        organizationId: users.organizationId,
        departmentId: users.departmentId,
        createdAt: users.createdAt,
        profilePictureUrl: users.profilePictureUrl,
        about: users.about,
        phone: users.phone,
        location: users.location,
        jobTitle: users.jobTitle
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!fullUser) {
      return NextResponse.json({ error: "Failed to fetch user details" }, { status: 500 });
    }

    // Get user organizations from user_organization_roles (org-level roles)
    const userOrganizations = await db
      .select({
        organizationId: userOrganizationRoles.organizationId,
        roleId: userOrganizationRoles.roleId,
        orgId: organizations.id,
        orgName: organizations.name,
        orgDomain: organizations.domain,
        globalRoleId: globalRoles.id,
        globalRoleName: globalRoles.name,
        globalRoleDescription: globalRoles.description
      })
      .from(userOrganizationRoles)
      .leftJoin(organizations, eq(userOrganizationRoles.organizationId, organizations.id))
      .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
      .where(eq(userOrganizationRoles.userId, user.id));

    // Get user's department roles (department-level roles) ordered by created_at
    const departmentRoles = await db
      .select({
        departmentId: userDepartmentRoles.departmentId,
        roleId: userDepartmentRoles.roleId,
        organizationId: userDepartmentRoles.organizationId,
        createdAt: userDepartmentRoles.createdAt,
        deptId: departments.id,
        deptName: departments.name,
        globalRoleId: globalRoles.id,
        globalRoleName: globalRoles.name
      })
      .from(userDepartmentRoles)
      .leftJoin(departments, eq(userDepartmentRoles.departmentId, departments.id))
      .leftJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
      .where(eq(userDepartmentRoles.userId, user.id))
      .orderBy(asc(userDepartmentRoles.createdAt)); // First department = default

    // Determine organization: prioritize org roles, fallback to department roles, then user.organizationId
    let organization: any = null;
    let role: any = null;
    let allRoles: string[] = [];
    let currentDepartment: any = null; // The active department for JWT
    let currentDepartmentRole: string | null = null; // User's role in the current department

    if (userOrganizations && userOrganizations.length > 0) {
      // User has org-level role
      const primaryOrg = userOrganizations[0];
      organization = { id: primaryOrg.orgId, name: primaryOrg.orgName, domain: primaryOrg.orgDomain };
      role = { id: primaryOrg.globalRoleId, name: primaryOrg.globalRoleName, description: primaryOrg.globalRoleDescription };
      allRoles = userOrganizations
        .map((uo: any) => uo.globalRoleName)
        .filter(Boolean) as string[];
      
      // If user also has department roles, set first department as current
      if (departmentRoles && departmentRoles.length > 0) {
        const firstDept = departmentRoles[0];
        currentDepartment = { id: firstDept.deptId, name: firstDept.deptName };
        currentDepartmentRole = firstDept.globalRoleName || null;
      }
    } else if (departmentRoles && departmentRoles.length > 0) {
      // User only has department-level role, get org from department role
      const primaryDeptRole = departmentRoles[0];
      const orgId = primaryDeptRole.organizationId || fullUser.organizationId;
      
      // Set first department as current
      currentDepartment = { id: primaryDeptRole.deptId, name: primaryDeptRole.deptName };
      currentDepartmentRole = primaryDeptRole.globalRoleName || null;
      
      if (orgId) {
        const orgData = await db
          .select({ id: organizations.id, name: organizations.name, domain: organizations.domain })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1)
          .then(rows => rows[0] || null);
        
        if (orgData) {
          organization = orgData;
          role = { id: primaryDeptRole.globalRoleId, name: primaryDeptRole.globalRoleName };
          allRoles = [role?.name || "Member"];
        }
      }
    } else if (fullUser.organizationId) {
      // Fallback to user's direct organizationId
      const orgData = await db
        .select({ id: organizations.id, name: organizations.name, domain: organizations.domain })
        .from(organizations)
        .where(eq(organizations.id, fullUser.organizationId))
        .limit(1)
        .then(rows => rows[0] || null);
      
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
      .filter((dr: any) => dr.globalRoleName === 'Admin')
      .map((dr: any) => ({
        department_id: dr.departmentId,
        department_name: dr.deptName,
        role: dr.globalRoleName
      }));

    // Get all departments user is part of
    const allDepartments = (departmentRoles || []).map((dr: any) => ({
      id: dr.departmentId,
      name: dr.deptName,
      role: dr.globalRoleName
    }));

    // Get default project: PRIORITIZE project assignment, not department
    let defaultProject: any = null;
    let defaultProjectRole: string = "Member";
    
    // First, try to get user's assigned projects (user_project table)
    const assignedProjects = await db
      .select({
        projectId: userProject.projectId,
        projId: projects.id,
        projName: projects.name,
        roleId: globalRoles.id,
        roleName: globalRoles.name
      })
      .from(userProject)
      .innerJoin(projects, eq(userProject.projectId, projects.id))
      .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(
        and(
          eq(userProject.userId, user.id),
          eq(projects.organizationId, organization.id)
        )
      )
      .limit(1);
    
    if (assignedProjects && assignedProjects.length > 0) {
      const firstAssignment = assignedProjects[0];
      defaultProject = { id: firstAssignment.projId, name: firstAssignment.projName };
      defaultProjectRole = firstAssignment.roleName || 'Member';
    } else if (currentDepartment?.id && currentDepartmentRole === 'Admin') {
      // Fallback: Department Admin sees first project in their department
      const deptProjects = await db
        .select({
          id: projects.id,
          name: projects.name,
          deptId: projectDepartment.departmentId
        })
        .from(projects)
        .innerJoin(projectDepartment, eq(projects.id, projectDepartment.projectId))
        .where(
          and(
            eq(projects.organizationId, organization.id),
            eq(projectDepartment.departmentId, currentDepartment.id)
          )
        )
        .orderBy(asc(projects.createdAt))
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
        created_at: user.createdAt?.toISOString(),
        profile_picture_url: fullUser.profilePictureUrl,
        about: fullUser.about,
        phone: fullUser.phone,
        location: fullUser.location,
        job_title: fullUser.jobTitle
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
        id: uo.orgId,
        name: uo.orgName,
        domain: uo.orgDomain,
        role: uo.globalRoleName || "Member"
      }))
    };

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error("VERIFY LOGIN OTP ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}