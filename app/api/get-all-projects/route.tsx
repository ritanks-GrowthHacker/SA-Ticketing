import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase, supabaseAdmin } from "@/app/db/connections";

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
    const { data: userOrgRole, error: orgRoleError } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq('user_id', decodedToken.sub)
      .eq('organization_id', decodedToken.org_id)
      .single();

    if (orgRoleError || !userOrgRole) {
      console.error("User organization validation error:", orgRoleError);
      return NextResponse.json(
        { error: "User not found or unauthorized" }, 
        { status: 403 }
      );
    }

    // Prioritize JWT role (project-specific) over global org role
    let actualUserRole = decodedToken.role || 'Member';
    
    // Only use global org role as fallback if no JWT role is provided
    if (!decodedToken.role && userOrgRole && userOrgRole.global_roles) {
      actualUserRole = (userOrgRole.global_roles as any).name;
    }

    const userRole = actualUserRole;

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
          status_id,
          created_at,
          updated_at,
          organization_id,
          created_by,
          organizations(id, name, domain),
          users!projects_created_by_fkey(id, name, email),
          project_statuses(
            id,
            name,
            description,
            color_code,
            sort_order,
            is_active
          )
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
          status_id,
          created_at,
          updated_at,
          organization_id,
          created_by,
          organizations(id, name, domain),
          users!projects_created_by_fkey(id, name, email),
          user_project!inner(user_id, role_id, global_roles!user_project_role_id_fkey(name)),
          project_statuses(
            id,
            name,
            description,
            color_code,
            sort_order,
            is_active
          )
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
          status_id,
          created_at,
          updated_at,
          organization_id,
          created_by,
          organizations(id, name, domain),
          users!projects_created_by_fkey(id, name, email),
          user_project!inner(user_id, role_id, global_roles!user_project_role_id_fkey(name)),
          project_statuses(
            id,
            name,
            description,
            color_code,
            sort_order,
            is_active
          )
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

    // If format is statuses, return only statuses
    if (format === "statuses") {
      console.log("🔧 DEBUG: Fetching project statuses for dropdown...");
      
      // Temporary hardcoded fix while RLS is being debugged
      const hardcodedStatuses = [
        {
          id: "f85e266d-7b75-4b08-b775-2fc17ca4b2a6",
          name: "Planning",
          description: "Project is in planning phase",
          color_code: "#f59e0b",
          sort_order: 1,
          is_active: true
        },
        {
          id: "d05ef4b9-63be-42e2-b4a2-3d85537b9b7d",
          name: "Active", 
          description: "Project is actively being worked on",
          color_code: "#10b981",
          sort_order: 2,
          is_active: true
        },
        {
          id: "9e001b85-22f5-435f-a95e-f546621c0ce3",
          name: "On Hold",
          description: "Project is temporarily paused", 
          color_code: "#f97316",
          sort_order: 3,
          is_active: true
        },
        {
          id: "af968d18-dfcc-4d69-93d9-9e7932155ccd",
          name: "Review",
          description: "Project is under review",
          color_code: "#3b82f6",
          sort_order: 4,
          is_active: true
        },
        {
          id: "66a0ccee-c989-4835-a828-bd9765958cf6",
          name: "Completed",
          description: "Project has been completed",
          color_code: "#6b7280",
          sort_order: 5,
          is_active: true
        }
      ];

      console.log("🔧 DEBUG: Using hardcoded statuses:", hardcodedStatuses.length, "items");

      return NextResponse.json({
        message: "Project statuses retrieved successfully (hardcoded)",
        statuses: hardcodedStatuses,
        count: hardcodedStatuses.length
      });
    }

    // If format is user-projects, return user's project assignments with roles
    if (format === "user-projects") {
      console.log("🔧 DEBUG: Fetching user project assignments for switching...");
      
      const { data: userProjects, error: userProjectsError } = await supabase
        .from("user_project")
        .select(`
          project_id,
          role_id,
          projects!user_project_project_id_fkey(
            id,
            name
          ),
          global_roles!user_project_role_id_fkey(
            id,
            name
          )
        `)
        .eq('user_id', decodedToken.sub);

      if (userProjectsError) {
        console.error('❌ Error fetching user projects:', userProjectsError);
        return NextResponse.json(
          { error: "Failed to fetch user project assignments" },
          { status: 500 }
        );
      }

      console.log('✅ User projects fetched:', userProjects?.length || 0, 'assignments');
      
      return NextResponse.json({
        message: "User project assignments retrieved successfully",
        projects: userProjects,
        success: true
      });
    }

    // Get all project statuses for the organization first
    const { data: projectStatuses, error: statusesError } = await supabase
      .from("project_statuses")
      .select("*")
      .order("sort_order", { ascending: true });

    console.log('🔍 Status query debug:', {
      tokenOrgId: decodedToken.org_id,
      tokenOrgIdType: typeof decodedToken.org_id,
      queryResult: projectStatuses,
      error: statusesError
    });

    if (statusesError) {
      console.error('❌ Error fetching project statuses:', statusesError);
    } else {
      console.log('✅ Project statuses fetched:', projectStatuses?.length || 0, 'statuses');
      console.log('📋 Project statuses data:', projectStatuses);
    }

    // Enhanced project data with statistics if requested
    const enrichedProjects = await Promise.all(
      (projects || []).map(async (project: any) => {
        let projectStats = null;

        if (includeStats) {
          // Get all tickets for this project with their status information
          const { data: allProjectTickets } = await supabase
            .from('tickets')
            .select('id, status_id, statuses!tickets_status_id_fkey(name, type)')
            .eq('project_id', project.id);

          // Get team members count
          const { data: teamMembers } = await supabase
            .from('user_project')
            .select(`
              user_id,
              users!inner(id, name, email),
              global_roles!user_project_role_id_fkey(name)
            `, { count: 'exact' })
            .eq('project_id', project.id);

          const totalCount = allProjectTickets?.length || 0;
          const teamMembersCount = teamMembers?.length || 0;

          // Find project manager from team members
          const projectManager = teamMembers?.find(member => 
            (member.global_roles as any)?.name === 'Manager'
          );
          const managerName = projectManager 
            ? (projectManager.users as any)?.name 
            : null;

          // Count tickets by status - find completed/closed tickets  
          const completedTickets = allProjectTickets?.filter(t => {
            const statusName = (t as any).statuses?.name?.toLowerCase() || '';
            const statusType = (t as any).statuses?.type?.toLowerCase() || '';
            return statusName.includes('complete') || 
                   statusName.includes('done') || 
                   statusName.includes('closed') ||
                   statusType === 'completed';
          }) || [];
          const completedCount = completedTickets.length;
          const openCount = totalCount - completedCount;
          
          // Create detailed status breakdown for debugging
          const statusBreakdown: { [key: string]: number } = {};
          allProjectTickets?.forEach(t => {
            const statusName = (t as any).statuses?.name || 'No Status';
            statusBreakdown[statusName] = (statusBreakdown[statusName] || 0) + 1;
          });
          
          console.log('📊 Stats Debug:', {
            totalTickets: totalCount,
            openTickets: openCount,
            completedTickets: completedCount,
            teamMembers: teamMembersCount,
            statusBreakdown,
            allTicketsInProject: allProjectTickets?.map((t: any) => ({ 
              id: t.id, 
              status: t.statuses?.name || 'No Status',
              isCompleted: (t.statuses?.name?.toLowerCase().includes('complete') || 
                           t.statuses?.name?.toLowerCase().includes('done') ||
                           t.statuses?.name?.toLowerCase().includes('closed'))
            })) || []
          });
          
          projectStats = {
            totalTickets: totalCount,
            openTickets: openCount,
            completedTickets: completedCount,
            teamMembers: teamMembersCount,
            managerName,
            completionRate: totalCount > 0 
              ? Math.round((completedCount / totalCount) * 100)
              : 0,
            // Add detailed breakdown for frontend display
            statusBreakdown
          };

          console.log('📊 Project stats calculated:', {
            projectId: project.id,
            projectName: project.name,
            totalTickets: totalCount,
            teamMembers: teamMembersCount,
            teamMembersData: teamMembers,
            projectStats
          });
        }

        // Find the status details using status_id
        const statusDetails = project.status_id 
          ? (projectStatuses || []).find(s => s.id === project.status_id)
          : null;

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          status_id: project.status_id,
          status: statusDetails,
          created_at: project.created_at,
          updated_at: project.updated_at,
          created_by: project.users || null,
          organization: project.organizations || null,
          user_role_in_project: project.user_project ? project.user_project[0]?.global_roles?.name : null,
          stats: projectStats
        };
      })
    );



    // Fallback: If no statuses found, provide the known statuses
    let statusesToReturn = projectStatuses;
    if (!projectStatuses || projectStatuses.length === 0) {
      console.log('⚠️ No statuses found in DB query, using fallback statuses for org:', decodedToken.org_id);
      statusesToReturn = [
        {
          id: "d05ef4b9-63be-42e2-b4a2-3d85537b9b7d",
          name: "Active",
          description: "Project is actively being worked on",
          color_code: "#10b981",
          sort_order: 2,
          is_active: true,
          organization_id: decodedToken.org_id
        },
        {
          id: "f85e266d-7b75-4b08-b775-2fc17ca4b2a6",
          name: "Planning",
          description: "Project is in planning phase", 
          color_code: "#f59e0b",
          sort_order: 1,
          is_active: true,
          organization_id: decodedToken.org_id
        },
        {
          id: "9e001b85-22f5-435f-a95e-f546621c0ce3",
          name: "On Hold",
          description: "Project is temporarily paused",
          color_code: "#f97316", 
          sort_order: 3,
          is_active: true,
          organization_id: decodedToken.org_id
        },
        {
          id: "af968d18-dfcc-4d69-93d9-9e7932155ccd",
          name: "Review",
          description: "Project is under review",
          color_code: "#3b82f6",
          sort_order: 4,
          is_active: true,
          organization_id: decodedToken.org_id
        },
        {
          id: "66a0ccee-c989-4835-a828-bd9765958cf6",
          name: "Completed", 
          description: "Project has been completed",
          color_code: "#6b7280",
          sort_order: 5,
          is_active: true,
          organization_id: decodedToken.org_id
        },
        {
          id: "df41226f-a012-4f83-95e0-c91b0f25f70a",
          name: "Cancelled",
          description: "Project has been cancelled", 
          color_code: "#ef4444",
          sort_order: 6,
          is_active: true,
          organization_id: decodedToken.org_id
        }
      ];
      console.log('🔧 Fallback statuses created:', statusesToReturn.length, 'statuses');
    }

    console.log('📤 FINAL API RESPONSE:', {
      statusesCount: statusesToReturn?.length || 0,
      statusesToReturn: statusesToReturn,
      projectsCount: enrichedProjects.length
    });

    return NextResponse.json({
      message: "Projects retrieved successfully",
      projects: enrichedProjects,
      statuses: statusesToReturn,
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
