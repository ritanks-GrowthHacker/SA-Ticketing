import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase, supabaseAdmin } from "@/app/db/connections";

interface JWTPayload {
  sub: string;        // user ID
  org_id: string;     // organization ID
  org_name: string;   // organization name
  org_domain: string; // organization domain
  org_role?: string;  // organization role (for profile display only)
  project_id?: string;    // current project ID (DOMINANT)
  project_name?: string;  // current project name
  project_role?: string;  // current project role (DOMINANT)
  role: string;       // active role (project role if available)
  roles: string[];    // all user roles
  department_id?: string;   // current department ID
  department_role?: string; // current department role
  departments?: Array<{ id: string; name: string; role: string }>; // all user departments
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
    const filterDepartmentId = url.searchParams.get("department_id"); // Filter by specific department

    // Check if user belongs to the organization - check both org and department roles
    const { data: userOrgRoles, error: orgRoleError } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq('user_id', decodedToken.sub)
      .eq('organization_id', decodedToken.org_id);

    const { data: userDeptRoles, error: deptRoleError } = await supabase
      .from('user_department_roles')
      .select(`
        role_id,
        department_id,
        global_roles(name)
      `)
      .eq('user_id', decodedToken.sub)
      .eq('organization_id', decodedToken.org_id);

    // User must have either org role or department role
    if ((!userOrgRoles || userOrgRoles.length === 0) && (!userDeptRoles || userDeptRoles.length === 0)) {
      console.error("User organization validation error - no org or dept roles found");
      return NextResponse.json(
        { error: "User not found or unauthorized" }, 
        { status: 403 }
      );
    }

    // Prioritize JWT role, then org role, then department role
    let actualUserRole = decodedToken.project_role || decodedToken.department_role || decodedToken.org_role || decodedToken.role || 'Member';
    
    console.log('🔍 GET-ALL-PROJECTS - JWT Data:', {
      project_id: decodedToken.project_id,
      project_role: decodedToken.project_role,
      department_id: decodedToken.department_id,
      org_role: decodedToken.org_role,
      actualUserRole
    });
    
    if (!decodedToken.role && !decodedToken.project_role && !decodedToken.department_role) {
      if (userOrgRoles && userOrgRoles.length > 0) {
        actualUserRole = (userOrgRoles[0].global_roles as any)?.name || 'Member';
      } else if (userDeptRoles && userDeptRoles.length > 0) {
        actualUserRole = (userDeptRoles[0].global_roles as any)?.name || 'Member';
      }
    }

    const userRole = actualUserRole;

    console.log("🔍 GET PROJECTS - User check (Project-Based System):", {
      userId: decodedToken.sub,
      project_role: decodedToken.project_role,
      org_role: decodedToken.org_role,
      userRole,
      hasOrgRoles: userOrgRoles?.length || 0,
      hasDeptRoles: userDeptRoles?.length || 0
    });

    // **PROJECT-BASED SYSTEM**: Get ALL projects user is assigned to from user_project table
    const { data: userProjects, error: userProjectsError } = await supabase
      .from("user_project")
      .select(`
        project_id,
        role_id,
        projects!inner(
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
        ),
        global_roles!user_project_role_id_fkey(id, name)
      `)
      .eq("user_id", decodedToken.sub)
      .eq("projects.organization_id", decodedToken.org_id);

    if (userProjectsError) {
      console.error("User projects retrieval error:", userProjectsError);
      return NextResponse.json(
        { error: "Failed to retrieve projects" }, 
        { status: 500 }
      );
    }

    console.log(`✅ Found ${userProjects?.length || 0} directly assigned projects from user_project table`);
    console.log(`📋 Assigned projects:`, userProjects?.map((up: any) => ({
      id: up.project_id,
      name: up.projects?.name,
      role: up.global_roles?.name
    })));

    // Get additional projects based on role
    let additionalProjects: any[] = [];
    const isOrgAdmin = userOrgRoles?.some((r: any) => r.global_roles?.name === 'Admin');
    const isDeptAdmin = userDeptRoles?.some((r: any) => r.global_roles?.name === 'Admin');
    const isDeptManager = userDeptRoles?.some((r: any) => r.global_roles?.name === 'Manager');
    
    console.log(`🎭 Role Flags:`, { isOrgAdmin, isDeptAdmin, isDeptManager });
    console.log(`📊 User Dept Roles:`, userDeptRoles?.map((dr: any) => ({
      dept_id: dr.department_id,
      role: dr.global_roles?.name
    })));
    
    if (isOrgAdmin) {
      // Org Admin: Get ALL organization projects
      const { data: allOrgProjects, error: orgProjectsError } = await supabase
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

      if (!orgProjectsError && allOrgProjects) {
        additionalProjects = allOrgProjects;
        console.log(`✅ Org Admin: Added ${allOrgProjects.length} org projects`);
      }
    } else if (isDeptAdmin || isDeptManager) {
      // Department Admin/Manager: Get all projects from their departments
      const deptIds = userDeptRoles?.map((r: any) => r.department_id) || [];
      
      if (deptIds.length > 0) {
        const { data: deptProjectLinks, error: deptProjError } = await supabase
          .from("project_department")
          .select("project_id")
          .in("department_id", deptIds);

        if (!deptProjError && deptProjectLinks) {
          const deptProjectIds = deptProjectLinks.map(dp => dp.project_id);
          
          if (deptProjectIds.length > 0) {
            const { data: deptProjects, error: fetchError } = await supabase
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
              .in("id", deptProjectIds)
              .eq("organization_id", decodedToken.org_id);

            if (!fetchError && deptProjects) {
              additionalProjects = deptProjects;
              console.log(`✅ Dept Admin/Manager: Added ${deptProjects.length} department projects`);
            }
          }
        }
      }
    }

    // MERGE: Assigned projects + Department/Org projects (deduplicate by project ID)
    const projectMap = new Map();
    
    // First add user-assigned projects with their ACTUAL roles
    (userProjects || []).forEach((up: any) => {
      projectMap.set(up.project_id, {
        ...up.projects,
        userRole: up.global_roles?.name || 'Member',
        isDirectlyAssigned: true
      });
    });
    
    // Then add additional projects (department/org projects) with default role if not already present
    additionalProjects.forEach((proj: any) => {
      if (!projectMap.has(proj.id)) {
        projectMap.set(proj.id, {
          ...proj,
          userRole: isDeptAdmin || isOrgAdmin ? 'Admin' : 'Manager',
          isDirectlyAssigned: false
        });
      }
    });
    
    let allProjects = Array.from(projectMap.values());
    console.log(`✅ TOTAL MERGED PROJECTS: ${allProjects.length} (${userProjects?.length || 0} assigned + ${additionalProjects.length} from dept/org)`);
    console.log(`📦 Final merged projects:`, allProjects.map((p: any) => ({
      id: p.id,
      name: p.name,
      userRole: p.userRole,
      isDirectlyAssigned: p.isDirectlyAssigned
    })));


    // Apply search filter if provided
    if (search) {
      allProjects = allProjects.filter((proj: any) => 
        proj.name?.toLowerCase().includes(search.toLowerCase()) ||
        proj.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply department filter if provided - PROPERLY filter by project_department table
    if (filterDepartmentId) {
      console.log(`🔍 GET-ALL-PROJECTS: Filtering projects by department ${filterDepartmentId}`);
      
      // Get projects that belong to this department from project_department table
      const { data: deptProjects, error: deptProjectsError } = await supabase
        .from('project_department')
        .select('project_id')
        .eq('department_id', filterDepartmentId);

      if (deptProjectsError) {
        console.error('Error fetching department projects:', deptProjectsError);
      } else if (deptProjects) {
        const deptProjectIds = deptProjects.map(dp => dp.project_id);
        console.log(`   Found ${deptProjectIds.length} projects in department`);
        
        // Filter to only show projects that belong to this department
        allProjects = allProjects.filter((proj: any) => deptProjectIds.includes(proj.id));
        console.log(`   After filtering: ${allProjects.length} projects`);
      }
    } else {
      // When no department filter is applied (e.g., "All Projects" view)
      // Include shared projects from shared_projects table
      console.log(`🔍 GET-ALL-PROJECTS: Including shared projects for user's departments`);
      
      // Get all departments user belongs to
      const userDepartmentIds = userDeptRoles?.map((dr: any) => dr.department_id) || [];
      
      if (userDepartmentIds.length > 0) {
        const { data: sharedProjects, error: sharedError } = await supabase
          .from('shared_projects')
          .select(`
            project_id,
            department_id,
            projects!inner(
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
            )
          `)
          .in('department_id', userDepartmentIds);

        if (!sharedError && sharedProjects) {
          // Add shared projects that aren't already in the list
          const existingProjectIds = new Set(allProjects.map((p: any) => p.id));
          const newSharedProjects = sharedProjects
            .filter((sp: any) => !existingProjectIds.has(sp.project_id))
            .map((sp: any) => ({
              ...sp.projects,
              userRole: 'Viewer', // Shared projects default to Viewer role
              is_shared: true
            }));
          
          allProjects = [...allProjects, ...newSharedProjects];
          console.log(`   Added ${newSharedProjects.length} shared projects`);
        }
      }
    }

    // Sort by created_at
    allProjects.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    console.log(`✅ GET PROJECTS - Found ${allProjects.length} projects for user (project-based)`);

    // For backward compatibility, create a fake result structure
    const ownedResult = { data: allProjects, error: null };
    const sharedResult = { data: [], error: null };

    if (false) { // Skip the old logic entirely
      if (ownedResult.error) {
        console.error("Owned projects retrieval error:", ownedResult.error);
        return NextResponse.json(
          { error: "Failed to retrieve projects" }, 
          { status: 500 }
        );
      }

      if (sharedResult.error) {
        console.error("Shared projects retrieval error:", sharedResult.error);
        return NextResponse.json(
          { error: "Failed to retrieve shared projects" }, 
          { status: 500 }
        );
      }

      // Combine and deduplicate projects
      const ownedProjects = ownedResult.data || [];
      const sharedProjects = sharedResult.data || [];
      const allProjectIds = new Set<string>();
      const combinedProjects: any[] = [];

      // Add owned projects
      ownedProjects.forEach((project: any) => {
        if (!allProjectIds.has(project.id)) {
          allProjectIds.add(project.id);
          combinedProjects.push({ ...project, is_shared: false });
        }
      });

      // Handle dropdown format
      if (format === "dropdown") {
        const dropdownProjects = allProjects.map((project: any) => ({
          id: project.id,
          name: project.name,
          value: project.id,
          label: project.name,
          userRole: project.userRole // Include user's role in this project
        }));

        return NextResponse.json({
          success: true,
          projects: dropdownProjects,
          totalCount: dropdownProjects.length
        });
      }

      // Return full project data with user roles
      const enrichedProjects = allProjects.map((project: any) => ({
        ...project,
        userRole: project.userRole || 'Member'
      }));

      return NextResponse.json({
        message: "Projects retrieved successfully (project-based)",
        projects: enrichedProjects,
        totalCount: enrichedProjects.length,
        userRole: userRole,
        filters: {
          search
        }
      });
    }

    // If format is dropdown, return simple format
    if (format === "dropdown") {
      const dropdownProjects = (allProjects || []).map((project: any) => ({
        id: project.id,
        name: project.name,
        value: project.id,
        label: project.name,
        userRole: project.userRole
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
      (allProjects || []).map(async (project: any) => {
        let projectStats = null;

        if (includeStats) {
          // Get all tickets for this project with their status information
          const { data: allProjectTickets } = await supabase
            .from('tickets')
            .select('id, status_id, statuses!tickets_status_id_fkey(name, type)')
            .eq('project_id', project.id);

          // Get team members count
          const { data: teamMembers, error: teamMembersError } = await supabase
            .from('user_project')
            .select(`
              user_id,
              users!inner(id, name, email),
              global_roles!user_project_role_id_fkey(name)
            `, { count: 'exact' })
            .eq('project_id', project.id);

          if (teamMembersError) {
            console.error(`❌ Error fetching team members for project ${project.id}:`, teamMembersError);
          }

          console.log(`👥 Team Members for project ${project.name}:`, {
            count: teamMembers?.length || 0,
            members: teamMembers,
            query: 'user_project with project_id =' + project.id
          });

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
            // Include the actual team member list so frontend can render members
            teamMembersData: (teamMembers || []).map((m: any) => ({
              id: m.user_id,
              name: (m.users as any)?.name || null,
              email: (m.users as any)?.email || null,
              role: (m.global_roles as any)?.name || null
            })),
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
          user_role_in_project: project.userRole || 'Member', // From project-based system
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
