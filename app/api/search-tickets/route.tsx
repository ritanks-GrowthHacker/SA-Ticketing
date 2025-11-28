import { NextRequest, NextResponse } from 'next/server';
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, tickets, projects, users, statuses, priorities, userOrganizationRoles, globalRoles, userProject, projectDepartment, eq, and, or, inArray, ilike, sql, desc } from "@/lib/db-helper";

// Helper function to verify JWT token and extract user info
async function verifyToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    
    // Verify the JWT token
    const tokenData = await verifyToken(authHeader);
    if (!tokenData) {
      return NextResponse.json({ error: 'Invalid or missing token' }, { status: 401 });
    }

    const userId = tokenData.sub; // Use 'sub' from JWT token
    const organizationId = tokenData.org_id; // Use 'org_id' from JWT token
    const departmentId = tokenData.department_id; // Get department from JWT
    
    // Get user's organization role using global roles system
    const userOrgRole = await db
      .select({
        roleId: userOrganizationRoles.roleId,
        roleName: globalRoles.name
      })
      .from(userOrganizationRoles)
      .leftJoin(globalRoles, eq(userOrganizationRoles.roleId, globalRoles.id))
      .where(and(
        eq(userOrganizationRoles.userId, userId),
        eq(userOrganizationRoles.organizationId, organizationId)
      ))
      .limit(1)
      .then(rows => rows[0] || null);

    let actualUserRole = tokenData.role || 'Member'; // fallback to JWT role
    if (userOrgRole && userOrgRole.roleName) {
      actualUserRole = userOrgRole.roleName;
    }

    console.log('🔧 Search tickets - User role:', actualUserRole);
    console.log('🔍 JWT token role:', tokenData.role);
    console.log('🔍 JWT token user:', tokenData.sub);
    console.log('🔍 Organization role query result:', userOrgRole);

    // Extract query parameters
    const query = searchParams.get('q') || '';
    const statusFilter = searchParams.get('status');
    const priorityFilter = searchParams.get('priority');
    const projectFilter = searchParams.get('project');
    const roleFilter = searchParams.get('role'); // For users with multiple roles
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;



    // Build base Drizzle query conditions
    let whereConditions: any[] = [];
    let projectIds: string[] = [];

    // Apply RBAC filtering
    if (actualUserRole !== 'Admin') {
      // Get user's project assignments with roles
      const userProjectsData = await db
        .select({
          projectId: userProject.projectId,
          roleId: userProject.roleId,
          roleName: globalRoles.name
        })
        .from(userProject)
        .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
        .where(eq(userProject.userId, userId));

      if (!userProjectsData || userProjectsData.length === 0) {
        return NextResponse.json({
          tickets: [],
          totalCount: 0,
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            hasNextPage: false,
            hasPreviousPage: false
          },
          filters: {
            availableProjects: [],
            availableRoles: []
          }
        });
      }

      projectIds = userProjectsData.map((p: any) => p.projectId);
      
      console.log('🎯 User projects for tickets:', userProjectsData.map((p: any) => ({
        projectId: p.projectId,
        role: p.roleName
      })));
      
      // For Members: Only show tickets assigned to them OR created by them
      if (actualUserRole === 'Member') {
        console.log('👤 Member access: showing only assigned/created tickets');
        whereConditions.push(
          and(
            inArray(tickets.projectId, projectIds),
            or(
              eq(tickets.assignedTo, userId),
              eq(tickets.createdBy, userId)
            )
          )
        );
      } else {
        console.log('👑 Manager/Admin access: showing all tickets in projects:', projectIds);
        // For Managers and other non-Admin roles: Show all tickets in assigned projects
        // Filter by role if specified
        if (roleFilter) {
          const filteredProjects = userProjectsData
            .filter((p: any) => p.roleName === roleFilter)
            .map((p: any) => p.projectId);
          whereConditions.push(inArray(tickets.projectId, filteredProjects));
        } else {
          whereConditions.push(inArray(tickets.projectId, projectIds));
        }
      }
    }

    // Apply search query
    if (query) {
      whereConditions.push(
        or(
          ilike(tickets.title, `%${query}%`),
          ilike(tickets.description, `%${query}%`)
        )
      );
    }

    // Apply filters
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push(eq(tickets.statusId, statusFilter));
    }

    if (priorityFilter && priorityFilter !== 'all') {
      whereConditions.push(eq(tickets.priorityId, priorityFilter));
    }

    if (projectFilter && projectFilter !== 'all') {
      whereConditions.push(eq(tickets.projectId, projectFilter));
    }

    // Get total count for pagination with same conditions
    const combinedWhere = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    // Count total matching tickets
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectId, projects.id))
      .where(and(
        eq(projects.organizationId, organizationId),
        combinedWhere
      ));
    
    const totalCount = countResult[0]?.count || 0;

    // Execute main query with pagination and joins
    const ticketsData = await db
      .select({
        id: tickets.id,
        title: tickets.title,
        description: tickets.description,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        expectedClosingDate: tickets.expectedClosingDate,
        actualClosingDate: tickets.actualClosingDate,
        statusId: tickets.statusId,
        priorityId: tickets.priorityId,
        createdBy: tickets.createdBy,
        assignedTo: tickets.assignedTo,
        projectId: tickets.projectId,
        projectName: projects.name,
        projectOrganizationId: projects.organizationId,
        statusName: statuses.name,
        statusColorCode: statuses.colorCode,
        priorityName: priorities.name,
        priorityColorCode: priorities.colorCode
      })
      .from(tickets)
      .innerJoin(projects, eq(tickets.projectId, projects.id))
      .leftJoin(statuses, eq(tickets.statusId, statuses.id))
      .leftJoin(priorities, eq(tickets.priorityId, priorities.id))
      .where(and(
        eq(projects.organizationId, organizationId),
        combinedWhere
      ))
      .orderBy(desc(tickets.createdAt))
      .limit(limit)
      .offset(offset);

    if (!ticketsData) {
      console.error('Error fetching tickets');
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }

    // Fetch user details separately for creators and assignees
    const creatorIds = [...new Set(ticketsData.map((t: any) => t.createdBy).filter(Boolean))];
    const assigneeIds = [...new Set(ticketsData.map((t: any) => t.assignedTo).filter(Boolean))];
    const allUserIds = [...new Set([...creatorIds, ...assigneeIds])];

    let usersMap: { [key: string]: any } = {};
    if (allUserIds.length > 0) {
      const usersData = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, allUserIds));
      
      usersData.forEach((u: any) => {
        usersMap[u.id] = u;
      });
    }

    // Format tickets to match expected structure
    const formattedTickets = ticketsData.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      created_at: t.createdAt?.toISOString(),
      updated_at: t.updatedAt?.toISOString(),
      expected_closing_date: t.expectedClosingDate,
      actual_closing_date: t.actualClosingDate,
      status_id: t.statusId,
      priority_id: t.priorityId,
      created_by: t.createdBy,
      assigned_to: t.assignedTo,
      project_id: t.projectId,
      projects: { name: t.projectName, organization_id: t.projectOrganizationId },
      creator: usersMap[t.createdBy] || { name: null, email: null },
      assignee: usersMap[t.assignedTo] || { name: null, email: null },
      statuses: { name: t.statusName, color_code: t.statusColorCode },
      priorities: { name: t.priorityName, color_code: t.priorityColorCode }
    }));

    // Get available filter options based on user's access
    let availableRoles: string[] = [];
    let availableProjects: any[] = [];

    if (actualUserRole !== 'Admin') {
      // Get only projects user has access to
      const userProjectsForFilter = await db
        .select({
          projectId: userProject.projectId,
          roleId: userProject.roleId,
          roleName: globalRoles.name,
          projId: projects.id,
          projName: projects.name
        })
        .from(userProject)
        .innerJoin(projects, eq(userProject.projectId, projects.id))
        .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
        .where(eq(userProject.userId, userId));

      availableProjects = userProjectsForFilter?.map((up: any) => ({
        id: up.projId,
        name: up.projName || 'Unknown Project'
      })) || [];

      // Filter by department if selected
      if (departmentId && availableProjects.length > 0) {
        const deptProjectsData = await db
          .select({ projectId: projectDepartment.projectId })
          .from(projectDepartment)
          .where(eq(projectDepartment.departmentId, departmentId));

        const deptProjectIds = deptProjectsData?.map((dp: any) => dp.projectId) || [];
        availableProjects = availableProjects.filter((p: any) => deptProjectIds.includes(p.id));
      }

      // Get available roles for this user
      availableRoles = [...new Set(userProjectsForFilter?.map((p: any) => p.roleName).filter(Boolean) || [])] as string[];

      return NextResponse.json({
        tickets: formattedTickets || [],
        totalCount: totalCount || 0,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((totalCount || 0) / limit),
          totalItems: totalCount || 0,
          hasNextPage: page < Math.ceil((totalCount || 0) / limit),
          hasPreviousPage: page > 1
        },
        filters: {
          availableProjects,
          availableRoles
        },
        userAccess: {
          role: actualUserRole,
          canViewAllTickets: actualUserRole === 'Admin'
        }
      });
    } else {
      // Admin can see all projects - BUT filter by department if selected
      let projectsWhere: any = eq(projects.organizationId, organizationId);
      
      if (departmentId) {
        // Get projects from this department
        const deptProjectsData = await db
          .select({ projectId: projectDepartment.projectId })
          .from(projectDepartment)
          .where(eq(projectDepartment.departmentId, departmentId));

        const deptProjectIds = deptProjectsData?.map((dp: any) => dp.projectId) || [];
        
        if (deptProjectIds.length > 0) {
          projectsWhere = and(
            eq(projects.organizationId, organizationId),
            inArray(projects.id, deptProjectIds)
          );
        }
      }
      
      const availableProjectsData = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(projectsWhere);

      return NextResponse.json({
        tickets: formattedTickets || [],
        totalCount: totalCount || 0,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((totalCount || 0) / limit),
          totalItems: totalCount || 0,
          hasNextPage: page < Math.ceil((totalCount || 0) / limit),
          hasPreviousPage: page > 1
        },
        filters: {
          availableProjects: availableProjectsData || [],
          availableRoles: ['admin', 'manager', 'user'] // All roles for admin
        },
        userAccess: {
          role: actualUserRole,
          canViewAllTickets: true
        }
      });
    }

  } catch (error) {
    console.error('Error in search-tickets API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}