import { NextRequest, NextResponse } from 'next/server';
import jwt from "jsonwebtoken";
import { db, users, organizations, userOrganizationRoles, userDepartmentRoles, globalRoles, projects, projectStatuses, projectDepartment, userProject, departments, eq, and, or, desc, sql } from '@/lib/db-helper';

interface ProjectRequestBody {
  name: string;
  description?: string;
}

interface JWTPayload {
  sub: string;
  org_id: string;
  org_name: string;
  org_domain: string;
  org_role?: string;
  role: string;
  roles: string[];
  department_id?: string;
  department_name?: string;
  department_role?: string;
  departments?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  iat?: number;
  exp?: number;
}

export async function POST(req: NextRequest) {
  try {
    // Get JWT token from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token is required" }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: JWTPayload;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    // Parse request body
    let requestBody: ProjectRequestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error("JSON parsing error:", jsonError);
      return NextResponse.json(
        { error: "Invalid JSON format in request body" }, 
        { status: 400 }
      );
    }

    const { name, description } = requestBody;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Project name is required" }, 
        { status: 400 }
      );
    }

    // Get user basic info
    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(eq(users.id, decodedToken.sub))
      .limit(1);

    if (!user.length) {
      console.error("User validation error - user not found");
      return NextResponse.json(
        { error: "User not found" }, 
        { status: 403 }
      );
    }

    // Determine effective role - PRIORITIZE DEPARTMENT ROLE over org role
    let effectiveRole = null;
    
    // First check if user has a department role (from JWT)
    if (decodedToken.department_role) {
      effectiveRole = decodedToken.department_role;
      console.log("✅ Using department role from JWT:", effectiveRole);
    } 
    // Fallback to org role
    else if (decodedToken.org_role) {
      effectiveRole = decodedToken.org_role;
      console.log("✅ Using org role from JWT:", effectiveRole);
    }
    // Last resort: check database
    else {
      // Check org-level role
      const userOrg = await db
        .select({
          roleName: globalRoles.name
        })
        .from(userOrganizationRoles)
        .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
        .where(
          and(
            eq(userOrganizationRoles.userId, decodedToken.sub),
            eq(userOrganizationRoles.organizationId, decodedToken.org_id)
          )
        )
        .limit(1);

      // Check department role if current department is set
      let deptRole = null;
      if (decodedToken.department_id) {
        deptRole = await db
          .select({
            roleName: globalRoles.name
          })
          .from(userDepartmentRoles)
          .leftJoin(globalRoles, eq(userDepartmentRoles.roleId, globalRoles.id))
          .where(
            and(
              eq(userDepartmentRoles.userId, decodedToken.sub),
              eq(userDepartmentRoles.departmentId, decodedToken.department_id),
              eq(userDepartmentRoles.organizationId, decodedToken.org_id)
            )
          )
          .limit(1);
      }

      // Prioritize department role for project creation
      if (deptRole?.[0]?.roleName) {
        effectiveRole = deptRole[0].roleName;
      } else if (userOrg?.[0]?.roleName) {
        effectiveRole = userOrg[0].roleName;
      }
    }

    console.log("🔍 CREATE PROJECT - Role check:", {
      userId: decodedToken.sub,
      departmentRole: decodedToken.department_role,
      orgRole: decodedToken.org_role,
      effectiveRole,
      departmentId: decodedToken.department_id
    });

    // Check if the user has permission to create projects (Admin or Manager)
    if (!effectiveRole || !["Admin", "Manager"].includes(effectiveRole)) {
      return NextResponse.json(
        { 
          error: "Insufficient permissions. Only Admins and Managers can create projects",
          debug: {
            effectiveRole,
            departmentRole: decodedToken.department_role,
            orgRole: decodedToken.org_role
          }
        }, 
        { status: 403 }
      );
    }

    // Use user's organization for the project
    const targetOrganizationId = decodedToken.org_id;

    // 1️⃣ Fetch ACTIVE status for this organization
    let status = await db
      .select()
      .from(projectStatuses)
      .where(
        and(
          eq(projectStatuses.organizationId, targetOrganizationId),
          eq(projectStatuses.name, "Active")
        )
      )
      .limit(1);

    // 2️⃣ If no Active status exists → create one automatically
    if (!status.length) {
      const inserted = await db
        .insert(projectStatuses)
        .values({
          name: "Active",
          description: "Default active project state",
          organizationId: targetOrganizationId,
          createdBy: decodedToken.sub,
          colorCode: "#22c55e",
          sortOrder: 1,
        })
        .returning();

      status = inserted;
      console.log("✅ Created Active project status:", status[0].id);
    }

    const activeStatusId = status[0].id;

    // Check if project with same name already exists in the target organization
    const existingProject = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(
          eq(projects.name, name.trim()),
          eq(projects.organizationId, targetOrganizationId)
        )
      )
      .limit(1);

    if (existingProject.length) {
      return NextResponse.json(
        { error: "A project with this name already exists in the target organization" }, 
        { status: 409 }
      );
    }

    // 3️⃣ Create the project
    const projectData = {
      name: name.trim(),
      description: description?.trim() || null,
      organizationId: targetOrganizationId,
      statusId: activeStatusId,
      createdBy: decodedToken.sub,
      updatedBy: decodedToken.sub
    };

    const [project] = await db
      .insert(projects)
      .values(projectData)
      .returning();

    console.log("✅ Project created successfully:", project.id);

    // Associate project with CURRENT department from JWT
    const departmentId = decodedToken.department_id;
    if (departmentId) {
      try {
        await db
          .insert(projectDepartment)
          .values({
            projectId: project.id,
            departmentId: departmentId
          });

        console.log("✅ Project assigned to department:", {
          projectId: project.id,
          departmentId
        });
      } catch (deptAssignError) {
        console.error("Department assignment error:", deptAssignError);
      }
    }

    // Assign the creator to the project as Project Admin
    const creatorRoleData = await db
      .select({ id: globalRoles.id })
      .from(globalRoles)
      .where(eq(globalRoles.name, "Admin"))
      .limit(1);

    if (creatorRoleData.length) {
      try {
        await db
          .insert(userProject)
          .values({
            userId: decodedToken.sub,
            projectId: project.id,
            roleId: creatorRoleData[0].id
          });

        console.log("✅ Creator assigned to project as Admin");
      } catch (userProjectError) {
        console.error("❌ Failed to assign creator to project:", userProjectError);
      }
    }

    // Fetch related data
    let createdBy = null;
    if (project.createdBy) {
      const createdByData = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, project.createdBy))
        .limit(1);
      createdBy = createdByData[0] || null;
    }

    let organization = null;
    if (project.organizationId) {
      const orgData = await db
        .select({ id: organizations.id, name: organizations.name, domain: organizations.domain })
        .from(organizations)
        .where(eq(organizations.id, project.organizationId))
        .limit(1);
      organization = orgData[0] || null;
    }

    return NextResponse.json(
      {
        message: "Project created successfully",
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          created_at: project.createdAt?.toISOString(),
          updated_at: project.updatedAt?.toISOString(),
          created_by: createdBy,
          organization: organization
        }
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error("Project creation error:", error);
    
    // Log detailed PostgreSQL error for debugging
    if (error.code === '23503') {
      console.error("Foreign key violation details:", {
        code: error.code,
        detail: error.detail,
        table: error.table,
        constraint: error.constraint
      });
    }
    
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token is required" }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    let decodedToken: JWTPayload;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return NextResponse.json(
        { error: "Invalid or expired token" }, 
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search");

    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" }, 
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;
    const targetOrganizationId = decodedToken.org_id;

    let projectsData;
    if (search) {
      const searchPattern = `%${search}%`;
      projectsData = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, targetOrganizationId),
            or(
              sql`${projects.name} ILIKE ${searchPattern}`,
              sql`${projects.description} ILIKE ${searchPattern}`
            )
          )
        )
        .orderBy(desc(projects.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      projectsData = await db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, targetOrganizationId))
        .orderBy(desc(projects.createdAt))
        .limit(limit)
        .offset(offset);
    }

    let totalCount;
    if (search) {
      const searchPattern = `%${search}%`;
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, targetOrganizationId),
            or(
              sql`${projects.name} ILIKE ${searchPattern}`,
              sql`${projects.description} ILIKE ${searchPattern}`
            )
          )
        );
      totalCount = Number(countResult[0]?.count || 0);
    } else {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(eq(projects.organizationId, targetOrganizationId));
      totalCount = Number(countResult[0]?.count || 0);
    }

    const totalPages = Math.ceil(totalCount / limit);

    const enrichedProjects = await Promise.all(
      (projectsData || []).map(async (project: any) => {
        let createdBy = null;
        if (project.createdBy) {
          const createdByData = await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, project.createdBy))
            .limit(1);
          createdBy = createdByData[0] || null;
        }

        let organization = null;
        if (project.organizationId) {
          const orgData = await db
            .select({ id: organizations.id, name: organizations.name, domain: organizations.domain })
            .from(organizations)
            .where(eq(organizations.id, project.organizationId))
            .limit(1);
          organization = orgData[0] || null;
        }

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          created_at: project.createdAt?.toISOString(),
          updated_at: project.updatedAt?.toISOString(),
          created_by: createdBy,
          organization: organization
        };
      })
    );

    return NextResponse.json(
      {
        message: "Projects retrieved successfully",
        projects: enrichedProjects,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: totalCount,
          limit: limit,
          has_next_page: page < totalPages,
          has_previous_page: page > 1
        },
        filters: { search }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Projects retrieval error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
