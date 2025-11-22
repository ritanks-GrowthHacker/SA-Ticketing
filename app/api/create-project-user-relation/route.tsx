import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";
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
    const { data: userOrgRoles, error: userOrgError } = await supabase
      .from("user_organization_roles")
      .select(`
        user_id,
        organization_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq("user_id", decodedToken.sub)
      .eq("organization_id", decodedToken.org_id);

    const { data: userDeptRoles, error: userDeptError } = await supabase
      .from("user_department_roles")
      .select(`
        user_id,
        organization_id,
        department_id,
        global_roles!user_department_roles_role_id_fkey(name)
      `)
      .eq("user_id", decodedToken.sub)
      .eq("organization_id", decodedToken.org_id);

    // User must have either org role or department role
    if ((!userOrgRoles || userOrgRoles.length === 0) && (!userDeptRoles || userDeptRoles.length === 0)) {
      console.error("User organization validation error - no roles found");
      return NextResponse.json({ error: "User not found or unauthorized" }, { status: 403 });
    }

    // Determine user's role - prioritize org role, then department role
    let userRoleName = 'Member';
    if (userOrgRoles && userOrgRoles.length > 0) {
      userRoleName = (userOrgRoles[0] as any).global_roles?.name || 'Member';
    } else if (userDeptRoles && userDeptRoles.length > 0) {
      userRoleName = (userDeptRoles[0] as any).global_roles?.name || 'Member';
    }
    if (!userRoleName || !["Admin", "Manager"].includes(userRoleName)) {
      return NextResponse.json({ error: "Insufficient permissions. Only Admins and Managers can remove users from projects" }, { status: 403 });
    }

    // Verify project exists and belongs to organization
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, organization_id")
      .eq("id", project_id)
      .maybeSingle();

    if (projectError || !project) {
      console.error("Project lookup error:", projectError);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.organization_id !== decodedToken.org_id) {
      return NextResponse.json({ error: "Project does not belong to your organization" }, { status: 403 });
    }

    // If Manager, verify they are assigned to this project
    if (userRoleName === "Manager") {
      const { data: managerAssignment } = await supabase
        .from("user_project")
        .select("user_id")
        .eq("user_id", decodedToken.sub)
        .eq("project_id", project_id)
        .maybeSingle();

      if (!managerAssignment) {
        return NextResponse.json({ error: "Managers can only remove users from projects they are assigned to" }, { status: 403 });
      }
    }

    // Remove user assignments
    const { data: deleted, error: deleteError } = await supabase
      .from("user_project")
      .delete()
      .in("user_id", user_ids)
      .eq("project_id", project_id)
      .select("*");

    if (deleteError) {
      console.error("Failed to delete user_project:", deleteError);
      return NextResponse.json({ error: "Failed to remove users from project" }, { status: 500 });
    }

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
		const { data: userOrgRoles, error: userOrgError } = await supabase
			.from("user_organization_roles")
			.select(`
				user_id,
				organization_id,
				global_roles!user_organization_roles_role_id_fkey(name)
			`)
			.eq("user_id", decodedToken.sub)
			.eq("organization_id", decodedToken.org_id);

		const { data: userDeptRoles, error: userDeptError } = await supabase
			.from("user_department_roles")
			.select(`
				user_id,
				organization_id,
				department_id,
				global_roles!user_department_roles_role_id_fkey(name)
			`)
			.eq("user_id", decodedToken.sub)
			.eq("organization_id", decodedToken.org_id);

		// User must have either org role or department role
		if ((!userOrgRoles || userOrgRoles.length === 0) && (!userDeptRoles || userDeptRoles.length === 0)) {
			console.error("User organization validation error - no roles found");
			return NextResponse.json({ error: "User not found or unauthorized" }, { status: 403 });
		}

		// Determine user's role - PRIORITY: Project role > Org role > Dept role
		let userRoleName = 'Member';
		
		// First check: Does user have a PROJECT ROLE in this specific project?
		const { data: userProjectRole } = await supabase
			.from("user_project")
			.select(`
				user_id,
				project_id,
				global_roles!user_project_role_id_fkey(name)
			`)
			.eq("user_id", decodedToken.sub)
			.eq("project_id", project_id)
			.single();

		if (userProjectRole && userProjectRole.global_roles) {
			userRoleName = (userProjectRole.global_roles as any)?.name || 'Member';
			console.log('✅ Using PROJECT ROLE:', userRoleName);
		} else if (userOrgRoles && userOrgRoles.length > 0) {
			userRoleName = (userOrgRoles[0] as any).global_roles?.name || 'Member';
			console.log('✅ Using ORG ROLE:', userRoleName);
		} else if (userDeptRoles && userDeptRoles.length > 0) {
			userRoleName = (userDeptRoles[0] as any).global_roles?.name || 'Member';
			console.log('✅ Using DEPT ROLE:', userRoleName);
		}

		console.log('🔍 CREATE-PROJECT-USER-RELATION - User Check:', {
			userId: decodedToken.sub,
			orgRoles: userOrgRoles?.length || 0,
			deptRoles: userDeptRoles?.length || 0,
			projectRole: userProjectRole ? 'Yes' : 'No',
			finalRoleName: userRoleName
		});
    if (!userRoleName || !["Admin", "Manager"].includes(userRoleName)) {
      return NextResponse.json({ error: "Insufficient permissions. Only Admins and Managers can assign users to projects" }, { status: 403 });
    }

    // Verify project exists and belongs to organization
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, organization_id")
      .eq("id", project_id)
      .maybeSingle();

    if (projectError || !project) {
      console.error("Project lookup error:", projectError);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.organization_id !== decodedToken.org_id) {
      return NextResponse.json({ error: "Project does not belong to your organization" }, { status: 403 });
    }

    // If Manager, verify they are assigned to this project
    if (userRoleName === "Manager") {
      const { data: managerAssignment } = await supabase
        .from("user_project")
        .select("user_id")
        .eq("user_id", decodedToken.sub)
        .eq("project_id", project_id)
        .maybeSingle();

      if (!managerAssignment) {
        return NextResponse.json({ error: "Managers can only assign users to projects they are assigned to" }, { status: 403 });
      }
    }		// Prepare upsert payload and validate assignees
		const toUpsert: any[] = [];
		const notifyList: { email: string; name: string; roleName: string }[] = [];

		for (const a of assignments) {
			if (!a.user_id || !a.role_id) continue;

			console.log(`🔍 Validating user ${a.user_id} for assignment...`);

			// Validate user belongs to organization - check BOTH org and department roles
			const { data: assigneeOrgRoles, error: orgError } = await supabase
				.from("user_organization_roles")
				.select(`user_id, organizations(id, name), users(id, name, email)`)
				.eq("user_id", a.user_id)
				.eq("organization_id", decodedToken.org_id);

			console.log(`   Org roles found: ${assigneeOrgRoles?.length || 0}, error:`, orgError);

			const { data: assigneeDeptRoles, error: deptError } = await supabase
				.from("user_department_roles")
				.select(`
					user_id, 
					department_id,
					departments!inner(id, name),
					users(id, name, email)
				`)
				.eq("user_id", a.user_id)
				.eq("organization_id", decodedToken.org_id);

			console.log(`   Dept roles found: ${assigneeDeptRoles?.length || 0}, error:`, deptError);

			// User must have either org role or department role
			if ((!assigneeOrgRoles || assigneeOrgRoles.length === 0) && (!assigneeDeptRoles || assigneeDeptRoles.length === 0)) {
				console.warn(`❌ Skipping assignment for user ${a.user_id} - not in organization`);
				continue;
			}

			// Get role name for notification
			const { data: roleData } = await supabase
				.from("global_roles")
				.select("id, name")
				.eq("id", a.role_id)
				.maybeSingle();

			const roleName = roleData?.name || "Member";

			// Get user info for notification - prioritize org roles, then dept roles
			let userInfo: any = null;
			if (assigneeOrgRoles && assigneeOrgRoles.length > 0) {
				userInfo = (assigneeOrgRoles[0] as any).users;
			} else if (assigneeDeptRoles && assigneeDeptRoles.length > 0) {
				userInfo = (assigneeDeptRoles[0] as any).users;
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
			try {
				// Check if user already has an assignment (this would be an update/role change)
				const { data: existingAssignment } = await supabase
					.from("user_project")
					.select("role_id, global_roles!user_project_role_id_fkey(name)")
					.eq("user_id", entry.user_id)
					.eq("project_id", entry.project_id)
					.single();

			// If updating an existing assignment, enforce role hierarchy
			if (existingAssignment && userRoleName === 'Manager') {
				const currentRoleName = (existingAssignment.global_roles as any)?.name;
				const newRole = await supabase
					.from("global_roles")
					.select("name")
					.eq("id", entry.role_id)
					.single();
				const newRoleName = newRole.data?.name;

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
			}				// Try update first
				const { data: updated, error: updateErr } = await supabase
					.from("user_project")
					.update({ role_id: entry.role_id })
					.eq("user_id", entry.user_id)
					.eq("project_id", entry.project_id)
					.select("*");

				if (updateErr) {
					console.warn("Update error for user_project", updateErr);
				}

				if (updated && updated.length > 0) {
					processed.push(updated[0]);
						continue;
					}

					// Not updated => insert
					const { data: inserted, error: insertErr } = await supabase
						.from("user_project")
						.insert([entry])
						.select("*");

					if (insertErr) {
						console.warn("Insert error for user_project", insertErr);
					}

					if (inserted && inserted.length > 0) {
						processed.push(inserted[0]);
						
						// 🎯 AUTO-ADD USER TO PROJECT'S DEPARTMENT
						// Get project's department
						const { data: projectDept } = await supabase
							.from("project_department")
							.select("department_id")
							.eq("project_id", entry.project_id)
							.single();
						
						if (projectDept?.department_id) {
							// Check if user already has department role
							const { data: existingDeptRole } = await supabase
								.from("user_department_roles")
								.select("user_id")
								.eq("user_id", entry.user_id)
								.eq("department_id", projectDept.department_id)
								.maybeSingle();
							
							if (!existingDeptRole) {
								// Add user to department with Member role (default for cross-dept assignments)
								const { data: memberRole } = await supabase
									.from("global_roles")
									.select("id")
									.eq("name", "Member")
									.single();
								
								if (memberRole) {
									const { error: deptInsertError } = await supabase.from("user_department_roles").insert({
										user_id: entry.user_id,
										department_id: projectDept.department_id,
										organization_id: decodedToken.org_id,
										role_id: memberRole.id
									});
									
									if (!deptInsertError) {
										console.log(`✅ Auto-added user ${entry.user_id} to department ${projectDept.department_id}`);
										
										// 🔥 REBUILD JWT FOR THIS USER with new department access
										try {
											// Get user's all departments now (including newly added)
											const { data: userDepts } = await supabase
												.from("user_department_roles")
												.select(`
													department_id,
													role_id,
													departments!inner(id, name),
													global_roles!user_department_roles_role_id_fkey(id, name)
												`)
												.eq("user_id", entry.user_id)
												.eq("organization_id", decodedToken.org_id);
											
											// Get user info
											const { data: userData } = await supabase
												.from("users")
												.select("id, email, name")
												.eq("id", entry.user_id)
												.single();
											
											// Get org info
											const { data: orgData } = await supabase
												.from("organizations")
												.select("id, name, domain")
												.eq("id", decodedToken.org_id)
												.single();
											
											if (userData && orgData && userDepts && userDepts.length > 0) {
												// Build departments array for JWT
												const departments = userDepts.map((ud: any) => ({
													id: ud.departments.id,
													name: ud.departments.name,
													role: ud.global_roles?.name || 'Member'
												}));
												
												// Use the newly added department as current department
												const currentDept = departments.find((d: any) => d.id === projectDept.department_id);
												
												// Build new JWT
												const newToken = jwt.sign(
													{
														sub: userData.id,
														email: userData.email,
														name: userData.name,
														org_id: orgData.id,
														org_name: orgData.name,
														org_domain: orgData.domain,
														department_id: currentDept?.id,
														department_name: currentDept?.name,
														department_role: currentDept?.role,
														departments: departments,
														role: currentDept?.role || 'Member',
														roles: departments.map((d: any) => d.role)
													},
													process.env.JWT_SECRET!,
													{ expiresIn: '7d' }
												);
												
												// Store new token for this user (they'll get it on next login or we can push via notification)
												console.log(`✅ Rebuilt JWT for user ${entry.user_id} with new department access`);
												
												// Send in-app notification with refresh instruction
												await supabase.from("notifications").insert({
													user_id: entry.user_id,
													type: "department_added",
													title: "New Department Access",
													message: `You now have access to ${currentDept?.name} department. Please refresh the page to see updated projects.`,
													entity_type: "department",
													entity_id: projectDept.department_id,
													created_at: new Date().toISOString()
												});
											}
										} catch (jwtError) {
											console.error("Error rebuilding JWT:", jwtError);
										}
									}
								}
							}
						}
					}
				} catch (e) {
					console.error("Error processing assignment entry", e);
				}
			}

		// Optionally send notification emails and create in-app notifications (best-effort)
		if (notifyList.length > 0) {
			// Create in-app notifications for all assigned users
			const inAppNotifications = notifyList.map(n => {
				// Find the corresponding assignment to get user_id
				const assignment = toUpsert.find(entry => {
					// Match by checking if this user's info matches the notifyList entry
					// We need to find the user_id that corresponds to this email
					return true; // We'll use a different approach
				});

				return {
					user_id: toUpsert[notifyList.indexOf(n)]?.user_id, // Match by index since they were added in same order
					entity_type: 'project',
					entity_id: project.id,
					type: 'info',
					title: 'Added to Project',
					message: `You have been added to project "${project.name}" as ${n.roleName}`,
					is_read: false
				};
			}).filter(notif => notif.user_id); // Filter out any without user_id

			try {
				await supabase.from('notifications').insert(inAppNotifications);
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
		}			return NextResponse.json({ message: "Assignments processed successfully", assignments: processed }, { status: 200 });

	} catch (error) {
		console.error("create-project-user-relation error:", error);
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
