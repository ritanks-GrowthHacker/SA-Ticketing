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

    // Check user organization membership and role
    const { data: userOrg, error: userOrgError } = await supabase
      .from("user_organization")
      .select(`
        user_id,
        organization_id,
        roles(name)
      `)
      .eq("user_id", decodedToken.sub)
      .eq("organization_id", decodedToken.org_id)
      .maybeSingle();

    if (userOrgError || !userOrg) {
      console.error("User organization validation error:", userOrgError);
      return NextResponse.json({ error: "User not found or unauthorized" }, { status: 403 });
    }

    const userRoleName = (userOrg as any).roles?.name;
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

		// Check user organization membership and role
		const { data: userOrg, error: userOrgError } = await supabase
			.from("user_organization")
			.select(`
				user_id,
				organization_id,
				roles(name)
			`)
			.eq("user_id", decodedToken.sub)
			.eq("organization_id", decodedToken.org_id)
			.maybeSingle();

		if (userOrgError || !userOrg) {
			console.error("User organization validation error:", userOrgError);
			return NextResponse.json({ error: "User not found or unauthorized" }, { status: 403 });
		}

    const userRoleName = (userOrg as any).roles?.name;
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

			// Validate user belongs to organization
			const { data: assigneeOrg } = await supabase
				.from("user_organization")
				.select(`user_id, organizations(id, name), users(id, name, email)`)
				.eq("user_id", a.user_id)
				.eq("organization_id", decodedToken.org_id)
				.maybeSingle();

			if (!assigneeOrg) {
				// skip assignment for users outside org
				console.warn(`Skipping assignment for user ${a.user_id} - not in organization`);
				continue;
			}

			// Get role name for notification
			const { data: roleData } = await supabase
				.from("roles")
				.select("id, name")
				.eq("id", a.role_id)
				.maybeSingle();

			const roleName = roleData?.name || "Member";

			// Get user info for notification
			const { data: userInfo } = await supabase
				.from("users")
				.select("id, name, email")
				.eq("id", a.user_id)
				.maybeSingle();

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
					// Try update first
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
					}
				} catch (e) {
					console.error("Error processing assignment entry", e);
				}
			}

			// Optionally send notification emails (best-effort)
			if (notifyList.length > 0) {
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
