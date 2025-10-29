import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

interface JWTPayload {
  sub: string;        // user ID
  org_id: string;     // organization ID
  org_name: string;   // organization name
  org_domain: string; // organization domain
  role: string;       // user role
  roles: string[];    // all user roles
  iat?: number;
  exp?: number;
}

export async function GET(req: Request) {
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

    // Parse query parameters
    const url = new URL(req.url);
    const format = url.searchParams.get("format"); // 'dropdown' for simple format
    const search = url.searchParams.get("search");
    const includeStats = url.searchParams.get("includeStats") === "true";

    // Check if user belongs to the organization
    const { data: userOrg, error: userOrgError } = await supabase
      .from("user_organization")
      .select(`
        user_id,
        organization_id,
        role_id,
        organizations(id, name, domain),
        roles(id, name, description)
      `)
      .eq("user_id", decodedToken.sub)
      .eq("organization_id", decodedToken.org_id)
      .maybeSingle();

    if (userOrgError || !userOrg) {
      console.error("User organization validation error:", userOrgError);
      return NextResponse.json(
        { error: "User not found or unauthorized" }, 
        { status: 403 }
      );
    }

    const userRole = (userOrg as any).roles?.name;

    let projectsQuery;

    // Role-based filtering
    if (userRole === "Admin") {
      // Admin can see all projects in the organization
      projectsQuery = supabase
        .from("projects")
        .select(`
          id,
          name,
          description,
          created_at,
          updated_at,
          organization_id,
          created_by,
          organizations(id, name, domain),
          users!projects_created_by_fkey(id, name, email)
        `)
        .eq("organization_id", decodedToken.org_id);

    } else if (userRole === "Manager") {
      // Manager can see only projects they are assigned to
      projectsQuery = supabase
        .from("projects")
        .select(`
          id,
          name,
          description,
          created_at,
          updated_at,
          organization_id,
          created_by,
          organizations(id, name, domain),
          users!projects_created_by_fkey(id, name, email),
          user_project!inner(user_id, role_id, roles(name))
        `)
        .eq("organization_id", decodedToken.org_id)
        .eq("user_project.user_id", decodedToken.sub);

    } else {
      // Other roles (User, Team Lead) can see projects they are assigned to
      projectsQuery = supabase
        .from("projects")
        .select(`
          id,
          name,
          description,
          created_at,
          updated_at,
          organization_id,
          created_by,
          organizations(id, name, domain),
          users!projects_created_by_fkey(id, name, email),
          user_project!inner(user_id, role_id, roles(name))
        `)
        .eq("organization_id", decodedToken.org_id)
        .eq("user_project.user_id", decodedToken.sub);
    }

    // Apply search filter if provided
    if (search) {
      projectsQuery = projectsQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Order by created_at descending
    projectsQuery = projectsQuery.order("created_at", { ascending: false });

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError) {
      console.error("Projects retrieval error:", projectsError);
      return NextResponse.json(
        { error: "Failed to retrieve projects" }, 
        { status: 500 }
      );
    }

    // If format is dropdown, return simple format
    if (format === "dropdown") {
      const dropdownProjects = (projects || []).map((project: any) => ({
        id: project.id,
        name: project.name,
        value: project.id,
        label: project.name
      }));

      return NextResponse.json({
        message: "Projects retrieved successfully",
        projects: dropdownProjects,
        totalCount: dropdownProjects.length
      });
    }

    // Enhanced project data with statistics if requested
    const enrichedProjects = await Promise.all(
      (projects || []).map(async (project: any) => {
        let projectStats = null;

        if (includeStats) {
          // Get project statistics
          const [
            { data: totalTickets },
            { data: openTickets },
            { data: completedTickets },
            { data: teamMembers }
          ] = await Promise.all([
            // Total tickets
            supabase
              .from('tickets')
              .select('id', { count: 'exact' })
              .eq('project_id', project.id),

            // Open tickets (not completed status)
            supabase
              .from('tickets')
              .select('id, statuses!inner(name)', { count: 'exact' })
              .eq('project_id', project.id)
              .neq('statuses.name', 'Completed'),

            // Completed tickets
            supabase
              .from('tickets')
              .select('id, statuses!inner(name)', { count: 'exact' })
              .eq('project_id', project.id)
              .eq('statuses.name', 'Completed'),

            // Team members
            supabase
              .from('user_project')
              .select(`
                user_id,
                users!inner(id, name, email),
                roles(name)
              `, { count: 'exact' })
              .eq('project_id', project.id)
          ]);

          const totalCount = totalTickets?.length || 0;
          const completedCount = completedTickets?.length || 0;
          
          projectStats = {
            totalTickets: totalCount,
            openTickets: openTickets?.length || 0,
            completedTickets: completedCount,
            teamMembers: teamMembers?.length || 0,
            completionRate: totalCount > 0 
              ? Math.round((completedCount / totalCount) * 100)
              : 0
          };
        }

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          created_at: project.created_at,
          updated_at: project.updated_at,
          created_by: project.users || null,
          organization: project.organizations || null,
          user_role_in_project: project.user_project ? project.user_project[0]?.roles?.name : null,
          stats: projectStats
        };
      })
    );

    return NextResponse.json({
      message: "Projects retrieved successfully",
      projects: enrichedProjects,
      totalCount: enrichedProjects.length,
      userRole: userRole,
      filters: {
        search,
        includeStats
      }
    });

  } catch (error) {
    console.error("Projects retrieval error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
