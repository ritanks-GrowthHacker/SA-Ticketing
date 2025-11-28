import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, userOrganizationRoles, userDepartmentRoles, globalRoles, projects, userProject, projectDepartment, users as usersTable, organizations, departments, notifications, eq, and, inArray, sql } from '@/lib/db-helper';
import { sendTeamAssignmentEmail } from "@/app/api/commonEmail";

interface JWTPayload {
	sub: string;
	org_id: string;
	org_name?: string;
	org_domain?: string;
	role?: string;
	roles?: string[];
	iat?: number;
	exp?: number;
}

interface Assignment {
	user_id: string;
	role_id: string; // role in project (references roles table)
}

interface RequestBody {
	project_id: string;
	assignments: Assignment[]; // list of users to assign with role
	notify?: boolean; // whether to send notification emails (default true)
}

export async function DELETE(req: Request) {
  try {
    // Auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization token is required" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: JWTPayload;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // Parse body for DELETE
    let body: { project_id: string; user_ids: string[] };
    try {
      body = await req.json();
    } catch (err) {
      console.error("Invalid JSON body:", err);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { project_id, user_ids } = body || {};

    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: "user_ids array is required with at least one entry" }, { status: 400 });
    }

    // Check user organization membership and role - check BOTH org and department roles
    const userOrgRolesData = await db.select({
      userId: userOrganizationRoles.userId,
      organizationId: userOrganizationRoles.organizationId,
      roleName: globalRoles.name
    })
    .from(userOrganizationRoles)
    .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
    .where(and(
      eq(userOrganizationRoles.userId, decodedToken.sub),
      eq(userOrganizationRoles.organizationId, decodedToken.org_id)
    ));

    const userDeptRolesData = await db.select({
      userId: userDepartmentRoles.userId,
      organizationId: userDepartmentRoles.organizationId,
      departmentId: userDepartmentRoles.departmentId,
      roleName: globalRoles.name
    })
    .from(userDepartmentRoles)
    .leftJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
    .where(and(
      eq(userDepartmentRoles.userId, decodedToken.sub),
      eq(userDepartmentRoles.organizationId, decodedToken.org_id)
    ));

    // User must have either org role or department role
    if ((!userOrgRolesData || userOrgRolesData.length === 0) && (!userDeptRolesData || userDeptRolesData.length === 0)) {
      console.error("User organization validation error - no roles found");
      return NextResponse.json({ error: "User not found or unauthorized" }, { status: 403 });
    }

    // Determine user's role - prioritize org role, then department role
    let userRoleName = 'Member';
    if (userOrgRolesData && userOrgRolesData.length > 0) {
      userRoleName = userOrgRolesData[0].roleName || 'Member';
    } else if (userDeptRolesData && userDeptRolesData.length > 0) {
      userRoleName = userDeptRolesData[0].roleName || 'Member';
    }
    if (!userRoleName || !["Admin", "Manager"].includes(userRoleName)) {
      return NextResponse.json({ error: "Insufficient permissions. Only Admins and Managers can remove users from projects" }, { status: 403 });
    }

    // Verify project exists and belongs to organization
    const projectData = await db.select({
      id: projects.id,
      name: projects.name,
      organizationId: projects.organizationId
    })
    .from(projects)
    .where(eq(projects.id, project_id))
    .limit(1);

    const project = projectData[0];
    if (!project) {
      console.error("Project lookup error: Project not found");
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.organizationId !== decodedToken.org_id) {
      return NextResponse.json({ error: "Project does not belong to your organization" }, { status: 403 });
    }

    // If Manager, verify they are assigned to this project
    if (userRoleName === "Manager") {
      const managerAssignmentData = await db.select({ userId: userProject.userId })
        .from(userProject)
        .where(and(
          eq(userProject.userId, decodedToken.sub),
          eq(userProject.projectId, project_id)
        ))
        .limit(1);

      if (!managerAssignmentData || managerAssignmentData.length === 0) {
        return NextResponse.json({ error: "Managers can only remove users from projects they are assigned to" }, { status: 403 });
      }
    }

    // Remove user assignments
    const deleted = await db.delete(userProject)
      .where(and(
        inArray(userProject.userId, user_ids),
        eq(userProject.projectId, project_id)
      ))
      .returning();

    return NextResponse.json({ 
      message: "Users removed from project successfully", 
      removed: deleted || [],
      removed_count: deleted?.length || 0
    }, { status: 200 });

  } catch (error) {
    console.error("delete project-user-relation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
	try {
		// Auth header
		const authHeader = req.headers.get("authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return NextResponse.json({ error: "Authorization token is required" }, { status: 401 });
		}

		const token = authHeader.split(" ")[1];
		let decodedToken: JWTPayload;
		try {
			decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
		} catch (jwtError) {
			console.error("JWT verification error:", jwtError);
			return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
		}

		// Parse body
		let body: RequestBody;
		try {
			body = await req.json();
		} catch (err) {
			console.error("Invalid JSON body:", err);
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		const { project_id, assignments, notify = true } = body || {};

		if (!project_id) {
			return NextResponse.json({ error: "project_id is required" }, { status: 400 });
		}

		if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
			return NextResponse.json({ error: "assignments array is required with at least one entry" }, { status: 400 });
		}

		// Check user organization membership and role - check BOTH org and department roles
		const userOrgRolesData = await db.select({
			userId: userOrganizationRoles.userId,
			organizationId: userOrganizationRoles.organizationId,
			roleName: globalRoles.name
		})
		.from(userOrganizationRoles)
		.leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
		.where(and(
			eq(userOrganizationRoles.userId, decodedToken.sub),
			eq(userOrganizationRoles.organizationId, decodedToken.org_id)
		));

		const userDeptRolesData = await db.select({
			userId: userDepartmentRoles.userId,
			organizationId: userDepartmentRoles.organizationId,
			departmentId: userDepartmentRoles.departmentId,
			roleName: globalRoles.name
		})
		.from(userDepartmentRoles)
		.leftJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
		.where(and(
			eq(userDepartmentRoles.userId, decodedToken.sub),
			eq(userDepartmentRoles.organizationId, decodedToken.org_id)
		));

		// User must have either org role or department role
		if ((!userOrgRolesData || userOrgRolesData.length === 0) && (!userDeptRolesData || userDeptRolesData.length === 0)) {
			console.error("User organization validation error - no roles found");
			return NextResponse.json({ error: "User not found or unauthorized" }, { status: 403 });
		}

		// Determine user's role - PRIORITY: Project role > Org role > Dept role
		let userRoleName = 'Member';
		
		// First check: Does user have a PROJECT ROLE in this specific project?
		const userProjectRoleData = await db.select({
			userId: userProject.userId,
			projectId: userProject.projectId,
			roleName: globalRoles.name
		})
		.from(userProject)
		.leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
		.where(and(
			eq(userProject.userId, decodedToken.sub),
			eq(userProject.projectId, project_id)
		))
		.limit(1);

		const userProjectRole = userProjectRoleData[0];
		if (userProjectRole && userProjectRole.roleName) {
			userRoleName = userProjectRole.roleName || 'Member';
			console.log('✅ Using PROJECT ROLE:', userRoleName);
		} else if (userOrgRolesData && userOrgRolesData.length > 0) {
			userRoleName = userOrgRolesData[0].roleName || 'Member';
			console.log('✅ Using ORG ROLE:', userRoleName);
		} else if (userDeptRolesData && userDeptRolesData.length > 0) {
			userRoleName = userDeptRolesData[0].roleName || 'Member';
			console.log('✅ Using DEPT ROLE:', userRoleName);
		}

		console.log('🔍 CREATE-PROJECT-USER-RELATION - User Check:', {
			userId: decodedToken.sub,
			orgRoles: userOrgRolesData?.length || 0,
			deptRoles: userDeptRolesData?.length || 0,
			projectRole: userProjectRole ? 'Yes' : 'No',
			finalRoleName: userRoleName
		});
    if (!userRoleName || !["Admin", "Manager"].includes(userRoleName)) {
      return NextResponse.json({ error: "Insufficient permissions. Only Admins and Managers can assign users to projects" }, { status: 403 });
    }

    // Verify project exists and belongs to organization
    const projectData = await db.select({
      id: projects.id,
      name: projects.name,
      organizationId: projects.organizationId
    })
    .from(projects)
    .where(eq(projects.id, project_id))
    .limit(1);

    const project = projectData[0];
    if (!project) {
      console.error("Project lookup error: Project not found");
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.organizationId !== decodedToken.org_id) {
      return NextResponse.json({ error: "Project does not belong to your organization" }, { status: 403 });
    }

    // If Manager, verify they are assigned to this project
    if (userRoleName === "Manager") {
      const managerAssignmentData = await db.select({ userId: userProject.userId })
        .from(userProject)
        .where(and(
          eq(userProject.userId, decodedToken.sub),
          eq(userProject.projectId, project_id)
        ))
        .limit(1);

      if (!managerAssignmentData || managerAssignmentData.length === 0) {
        return NextResponse.json({ error: "Managers can only assign users to projects they are assigned to" }, { status: 403 });
      }
    }		// Prepare upsert payload and validate assignees
		const toUpsert: any[] = [];
		const notifyList: { email: string; name: string; roleName: string }[] = [];

		for (const a of assignments) {
			if (!a.user_id || !a.role_id) continue;

			console.log(`🔍 Validating user ${a.user_id} for assignment...`);

			// Validate user belongs to organization - check BOTH org and department roles
			const assigneeOrgRolesData = await db.select({
				userId: userOrganizationRoles.userId,
				organizationsId: organizations.id,
				organizationsName: organizations.name,
				usersId: usersTable.id,
				usersName: usersTable.name,
				usersEmail: usersTable.email
			})
			.from(userOrganizationRoles)
			.leftJoin(organizations, eq(userOrganizationRoles.organizationId, organizations.id))
			.leftJoin(usersTable, eq(userOrganizationRoles.userId, usersTable.id))
			.where(and(
				eq(userOrganizationRoles.userId, a.user_id),
				eq(userOrganizationRoles.organizationId, decodedToken.org_id)
			));

			console.log(`   Org roles found: ${assigneeOrgRolesData?.length || 0}`);

			const assigneeDeptRolesData = await db.select({
				userId: userDepartmentRoles.userId,
				departmentId: userDepartmentRoles.departmentId,
				departmentsId: departments.id,
				departmentsName: departments.name,
				usersId: usersTable.id,
				usersName: usersTable.name,
				usersEmail: usersTable.email
			})
			.from(userDepartmentRoles)
			.innerJoin(departments, eq(userDepartmentRoles.departmentId, departments.id))
			.leftJoin(usersTable, eq(userDepartmentRoles.userId, usersTable.id))
			.where(and(
				eq(userDepartmentRoles.userId, a.user_id),
				eq(userDepartmentRoles.organizationId, decodedToken.org_id)
			));

			console.log(`   Dept roles found: ${assigneeDeptRolesData?.length || 0}`);

			// User must have either org role or department role
			if ((!assigneeOrgRolesData || assigneeOrgRolesData.length === 0) && (!assigneeDeptRolesData || assigneeDeptRolesData.length === 0)) {
				console.warn(`❌ Skipping assignment for user ${a.user_id} - not in organization`);
				continue;
			}

			// Get role name for notification
			const roleDataResult = await db.select({
				id: globalRoles.id,
				name: globalRoles.name
			})
			.from(globalRoles)
			.where(eq(globalRoles.id, a.role_id))
			.limit(1);

			const roleData = roleDataResult[0];
			const roleName = roleData?.name || "Member";

			// Get user info for notification - prioritize org roles, then dept roles
			let userInfo: any = null;
			if (assigneeOrgRolesData && assigneeOrgRolesData.length > 0) {
				userInfo = {
					id: assigneeOrgRolesData[0].usersId,
					name: assigneeOrgRolesData[0].usersName,
					email: assigneeOrgRolesData[0].usersEmail
				};
			} else if (assigneeDeptRolesData && assigneeDeptRolesData.length > 0) {
				userInfo = {
					id: assigneeDeptRolesData[0].usersId,
					name: assigneeDeptRolesData[0].usersName,
					email: assigneeDeptRolesData[0].usersEmail
				};
			}

			if (!userInfo) {
				console.warn(`Skipping assignment for user ${a.user_id} - user info not found`);
				continue;
			}

			// Upsert entry
			toUpsert.push({
				user_id: a.user_id,
				project_id,
				role_id: a.role_id
			});

			if (notify && userInfo?.email) {
				notifyList.push({ email: userInfo.email, name: userInfo.name || "", roleName });
			}
		}

		if (toUpsert.length === 0) {
			return NextResponse.json({ error: "No valid assignments to process" }, { status: 400 });
		}

		// Insert or update each assignment individually to avoid client typing issues
		const processed: any[] = [];
		for (const entry of toUpsert) {
			// Check if user already has an assignment (this would be an update/role change)
			const existingAssignmentData = await db.select({
				roleId: userProject.roleId,
				roleName: globalRoles.name
			})
			.from(userProject)
			.leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
			.where(and(
				eq(userProject.userId, entry.user_id),
				eq(userProject.projectId, entry.project_id)
			))
			.limit(1);

			const existingAssignment = existingAssignmentData[0];

			// If updating an existing assignment, enforce role hierarchy
			if (existingAssignment && userRoleName === 'Manager') {
				const currentRoleName = existingAssignment.roleName;
				const newRoleData = await db.select({ name: globalRoles.name })
					.from(globalRoles)
					.where(eq(globalRoles.id, entry.role_id))
					.limit(1);
				const newRoleName = newRoleData[0]?.name;

				// Manager cannot change Admin or Manager roles
				if (currentRoleName === 'Admin' || currentRoleName === 'Manager') {
					console.warn(`❌ Project Manager attempted to modify ${currentRoleName} role`);
					return NextResponse.json({ 
						error: "User permission not allowed" 
					}, { status: 403 });
				}

				// Manager cannot assign Admin or Manager roles
				if (newRoleName === 'Admin' || newRoleName === 'Manager') {
					console.warn(`❌ Project Manager attempted to assign ${newRoleName} role`);
					return NextResponse.json({ 
						error: "User permission not allowed" 
					}, { status: 403 });
				}
			}

			// Try update first
			const updated = await db.update(userProject)
				.set({ roleId: entry.role_id })
				.where(and(
					eq(userProject.userId, entry.user_id),
					eq(userProject.projectId, entry.project_id)
				))
				.returning();

			if (updated && updated.length > 0) {
				processed.push(updated[0]);
				continue;
			}

			// Not updated => insert
			const inserted = await db.insert(userProject)
				.values({
					userId: entry.user_id,
					projectId: entry.project_id,
					roleId: entry.role_id
				})
				.returning();

			if (inserted && inserted.length > 0) {
				processed.push(inserted[0]);
				
				// Note: Auto-department addition and JWT rebuilding removed for simplicity
				// Users will need to refresh or re-login to see new department access
				console.log(`✅ User ${entry.user_id} assigned to project ${entry.project_id}`);
			}
		}

		// Optionally send notification emails and create in-app notifications (best-effort)
		if (notifyList.length > 0) {
			// Create in-app notifications for all assigned users
			const inAppNotifications = notifyList.map((n: any, index: number) => {
				return {
					user_id: toUpsert[index]?.user_id, // Match by index since they were added in same order
					entity_type: 'project',
					entity_id: project.id,
					type: 'info',
					title: 'Added to Project',
					message: `You have been added to project "${project.name}" as ${n.roleName}`,
					is_read: false
				};
			}).filter((notif: any) => notif.user_id); // Filter out any without user_id

			try {
				await db.insert(notifications).values(inAppNotifications);
				console.log(`✅ Created ${inAppNotifications.length} in-app notifications for project assignments`);
			} catch (notifErr) {
				console.warn('Failed to create in-app notifications:', notifErr);
			}

			// Send email notifications
			for (const n of notifyList) {
				try {
					await sendTeamAssignmentEmail(n.email, project.name, n.roleName, n.name);
				} catch (emailErr) {
					console.warn("Failed to send assignment email to", n.email, emailErr);
				}
			}
		}

		return NextResponse.json({ message: "Assignments processed successfully", assignments: processed }, { status: 200 });

	} catch (error) {
		console.error("create-project-user-relation error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
