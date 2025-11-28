import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// import { supabase } from "@/app/db/connections";
import { db, projects, userProject, globalRoles, tickets, users as usersTable, statuses, priorities, projectDepartment, eq, and, or, inArray, ilike, desc, sql } from '@/lib/db-helper';

// Helper function to format time ago
const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks}w ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
};

export async function GET(request: NextRequest) {
    console.log('🔧 User Dashboard Metrics - API called (v4) - PRIORITIES FIX');  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No authorization token' }, { status: 401 });
    }

    // Verify JWT token
    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    console.log('🔧 Full JWT decoded token:', JSON.stringify(decoded, null, 2));
    
    const userId = decoded.sub; // Use 'sub' from JWT token
    const userRole = decoded.role; // org-level role (may be null for dept-only users)
    const organization_id = decoded.org_id; // Use 'org_id' from JWT token
    const department_role = decoded.department_role || null; // department role from JWT

    console.log('🔧 User Dashboard Metrics - Decoded JWT values:', {
      userId: decoded.sub,
      orgRole: userRole,
      orgId: decoded.org_id,
      department_role: department_role
    });

    // Allow Members, Managers and Department Admins to access this endpoint
    const normalizedRole = (department_role || userRole || '').toLowerCase();
    if (!normalizedRole || (normalizedRole !== 'member' && normalizedRole !== 'manager' && normalizedRole !== 'admin')) {
      console.log('🔧 REJECTED: Role not allowed:', { orgRole: userRole, deptRole: department_role });
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied. This endpoint is only for Members, Managers and Department Admins.' 
      }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const project_id = searchParams.get('project_id');
    const department_id = searchParams.get('department_id'); // GET FROM URL, NOT JWT
    const offset = (page - 1) * limit;

    console.log('🔧 MEMBER: Query params - page:', page, 'limit:', limit, 'project_id:', project_id, 'department_id:', department_id);

    // Determine applicable projects based on department/project context
    let memberProjects: any[] = [];
    let memberProjectsError: any = null;

    if (department_role === 'Admin' && department_id) {
      // Department Admin: can see all projects within the SELECTED department
      console.log('🔧 MEMBER: Dept Admin mode - filtering by department:', department_id);
      const deptProjects = await db.select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        departmentId: projectDepartment.departmentId
      })
      .from(projects)
      .innerJoin(projectDepartment, eq(projects.id, projectDepartment.projectId))
      .where(and(
        eq(projects.organizationId, organization_id),
        eq(projectDepartment.departmentId, department_id)
      ))
      .orderBy(projects.createdAt);

      memberProjects = (deptProjects || []).map((p: any) => ({ 
        project_id: p.id, 
        projects: { id: p.id, name: p.name, description: p.description }, 
        global_roles: { name: 'Admin' } 
      }));
      memberProjectsError = null;
    } else {
      // Department Manager or Regular Member: Get assigned projects, filtered by selected department
      let assignedProjectsQuery = db.select({
        projectId: userProject.projectId,
        roleId: userProject.roleId,
        projectsId: projects.id,
        projectsName: projects.name,
        projectsDescription: projects.description,
        departmentId: projectDepartment.departmentId,
        globalRolesId: globalRoles.id,
        globalRolesName: globalRoles.name
      })
      .from(userProject)
      .innerJoin(projects, eq(userProject.projectId, projects.id))
      .innerJoin(projectDepartment, eq(projects.id, projectDepartment.projectId))
      .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(and(
        eq(userProject.userId, userId),
        eq(projects.organizationId, organization_id)
      ));

      // Filter by department if selected in UI
      if (department_id) {
        assignedProjectsQuery = db.select({
          projectId: userProject.projectId,
          roleId: userProject.roleId,
          projectsId: projects.id,
          projectsName: projects.name,
          projectsDescription: projects.description,
          departmentId: projectDepartment.departmentId,
          globalRolesId: globalRoles.id,
          globalRolesName: globalRoles.name
        })
        .from(userProject)
        .innerJoin(projects, eq(userProject.projectId, projects.id))
        .innerJoin(projectDepartment, eq(projects.id, projectDepartment.projectId))
        .leftJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
        .where(and(
          eq(userProject.userId, userId),
          eq(projects.organizationId, organization_id),
          eq(projectDepartment.departmentId, department_id)
        ));
        console.log('🔧 MEMBER: Filtering projects by selected department:', department_id);
      }

      const assignedProjects = await assignedProjectsQuery;
      memberProjects = (assignedProjects || []).map((ap: any) => ({
        project_id: ap.projectId,
        projects: { id: ap.projectsId, name: ap.projectsName, description: ap.projectsDescription },
        global_roles: { id: ap.globalRolesId, name: ap.globalRolesName }
      }));
      memberProjectsError = null;
    }

    if (memberProjectsError) {
      console.error('❌ MEMBER: Error fetching member projects:', memberProjectsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch projects' }, { status: 500 });
    }

    console.log('🔧 MEMBER PROJECTS:', { 
      memberProjectsCount: memberProjects.length,
      userId, 
      organizationId: organization_id
    });

    const assignedProjectIds = memberProjects.map((mp: any) => mp.project_id);
    
    console.log('🔧 ASSIGNED PROJECT IDS:', assignedProjectIds);
    console.log('🔧 REQUESTED PROJECT ID:', project_id);
    
    if (assignedProjectIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overview: {
            myAssignedTickets: { value: 0, change: '0', changeType: 'neutral' },
            myCreatedTickets: { value: 0, change: '0', changeType: 'neutral' },
            inProgressTickets: { value: 0, change: '0', changeType: 'neutral' },
            completedTickets: { value: 0, change: '0', changeType: 'neutral' }
          },
          recentActivity: [],
          quickStats: {
            memberInfo: {
              assignedProjects: []
            }
          },
          chartData: { weekly: [] }
        }
      });
    }

    // Filter projects if specific project requested
    const targetProjectIds = project_id && project_id !== 'all' 
      ? assignedProjectIds.filter(id => id === project_id)
      : assignedProjectIds;

    console.log('🔧 MEMBER: Target project IDs:', targetProjectIds);
    console.log('🔧 MEMBER: Filtering logic - project_id param:', project_id, 'is not "all":', project_id !== 'all', 'filter applied:', project_id && project_id !== 'all');
    
    if (targetProjectIds.length === 0) {
      console.log('⚠️ MEMBER: No target projects found after filtering!');
    }

    // Get tickets assigned to this member in their projects
    const memberTicketsData = await db.select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      statusId: tickets.statusId,
      priorityId: tickets.priorityId,
      createdBy: tickets.createdBy,
      assignedTo: tickets.assignedTo,
      projectId: tickets.projectId,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      projectsId: projects.id,
      projectsName: projects.name,
      creatorId: sql<string>`${usersTable.id}`.as('creator_id'),
      creatorName: sql<string>`${usersTable.name}`.as('creator_name'),
      creatorEmail: sql<string>`${usersTable.email}`.as('creator_email'),
      assigneeId: sql<string>`assignee.id`.as('assignee_id'),
      assigneeName: sql<string>`assignee.name`.as('assignee_name'),
      assigneeEmail: sql<string>`assignee.email`.as('assignee_email'),
      statusesId: statuses.id,
      statusesName: statuses.name,
      statusesColorCode: statuses.colorCode
    })
    .from(tickets)
    .innerJoin(projects, eq(tickets.projectId, projects.id))
    .leftJoin(usersTable, eq(tickets.createdBy, usersTable.id))
    .leftJoin(sql`users as assignee`, sql`tickets.assigned_to = assignee.id`)
    .leftJoin(statuses, eq(tickets.statusId, statuses.id))
    .where(and(
      inArray(tickets.projectId, targetProjectIds),
      or(
        eq(tickets.assignedTo, userId),
        eq(tickets.createdBy, userId)
      )
    ))
    .orderBy(desc(tickets.createdAt))
    .limit(limit)
    .offset(offset);

    const memberTickets = memberTicketsData.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status_id: t.statusId,
      priority_id: t.priorityId,
      created_by: t.createdBy,
      assigned_to: t.assignedTo,
      project_id: t.projectId,
      created_at: t.createdAt?.toISOString(),
      updated_at: t.updatedAt?.toISOString(),
      projects: { id: t.projectsId, name: t.projectsName },
      creator: { id: t.creatorId, name: t.creatorName, email: t.creatorEmail },
      assignee: { id: t.assigneeId, name: t.assigneeName, email: t.assigneeEmail },
      statuses: { id: t.statusesId, name: t.statusesName, color_code: t.statusesColorCode }
    }));

    console.log('🔧 MEMBER: Retrieved tickets:', memberTickets?.length || 0);

    // Fetch priorities separately and attach to tickets
    if (memberTickets && memberTickets.length > 0) {
      // Try priorities table first, then fall back to statuses table with type='priority'
      let prioritiesData = await db.select({
        id: priorities.id,
        name: priorities.name,
        colorCode: priorities.colorCode
      })
      .from(priorities)
      .where(eq(priorities.organizationId, organization_id));

      // If no priorities found, try statuses table with type='priority'
      if (!prioritiesData || prioritiesData.length === 0) {
        const priorityStatuses = await db.select({
          id: statuses.id,
          name: statuses.name,
          colorCode: statuses.colorCode
        })
        .from(statuses)
        .where(and(
          eq(statuses.type, 'priority'),
          eq(statuses.organizationId, organization_id)
        ));
        prioritiesData = priorityStatuses;
      }

      // Attach priorities to tickets
      if (prioritiesData && prioritiesData.length > 0) {
        memberTickets.forEach((ticket: any) => {
          const priority = prioritiesData.find((p: any) => p.id === ticket.priority_id);
          if (priority) {
            (ticket as any).priorities = { id: priority.id, name: priority.name, color_code: priority.colorCode };
          }
        });
      }
    }

    // Get total count for pagination (tickets assigned to or created by user)
    const totalAccessibleTicketsData = await db.select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(and(
        inArray(tickets.projectId, targetProjectIds),
        or(
          eq(tickets.assignedTo, userId),
          eq(tickets.createdBy, userId)
        )
      ));
    const totalAccessibleTickets = totalAccessibleTicketsData[0]?.count || 0;

    // Get created tickets count
    const totalCreatedTicketsData = await db.select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(and(
        inArray(tickets.projectId, targetProjectIds),
        eq(tickets.createdBy, userId)
      ));
    const totalCreatedTickets = totalCreatedTicketsData[0]?.count || 0;

    // Get in-progress tickets count (assuming status names like 'In Progress', 'Working', etc.)
    const inProgressStatuses = await db.select({ id: statuses.id })
      .from(statuses)
      .where(and(
        ilike(statuses.name, '%progress%'),
        eq(statuses.type, 'ticket')
      ));

    const inProgressStatusIds = inProgressStatuses?.map((s: any) => s.id) || [];
    let inProgressCount = 0;
    if (inProgressStatusIds.length > 0) {
      const inProgressCountData = await db.select({ count: sql<number>`count(*)` })
        .from(tickets)
        .where(and(
          inArray(tickets.projectId, targetProjectIds),
          or(
            eq(tickets.assignedTo, userId),
            eq(tickets.createdBy, userId)
          ),
          inArray(tickets.statusId, inProgressStatusIds)
        ));
      inProgressCount = inProgressCountData[0]?.count || 0;
    }

    // Get completed tickets count (assuming status names like 'Completed', 'Done', 'Closed')
    const completedStatuses = await db.select({ id: statuses.id })
      .from(statuses)
      .where(and(
        or(
          ilike(statuses.name, '%complete%'),
          ilike(statuses.name, '%done%'),
          ilike(statuses.name, '%closed%'),
          ilike(statuses.name, '%resolved%')
        ),
        eq(statuses.type, 'ticket')
      ));

    const completedStatusIds = completedStatuses?.map((s: any) => s.id) || [];
    let completedCount = 0;
    if (completedStatusIds.length > 0) {
      const completedCountData = await db.select({ count: sql<number>`count(*)` })
        .from(tickets)
        .where(and(
          inArray(tickets.projectId, targetProjectIds),
          or(
            eq(tickets.assignedTo, userId),
            eq(tickets.createdBy, userId)
          ),
          inArray(tickets.statusId, completedStatusIds)
        ));
      completedCount = completedCountData[0]?.count || 0;
    }

    // Format tickets for dashboard display
    const recentActivity = (memberTickets || []).map((ticket: any) => ({
      id: ticket.id,
      title: ticket.title,
      status: ticket.statuses?.name || 'Unknown',
      time: formatTimeAgo(ticket.created_at),
      project: ticket.projects?.name || 'Unknown Project',
      priority: ticket.priorities?.name || 'Normal',
      assignedTo: ticket.assignee?.name || 'Unassigned',
      assigned_to: ticket.assignee?.name || 'Unassigned',
      createdBy: ticket.creator?.name || 'Unknown',
      created_by: ticket.creator?.name || 'Unknown'
    }));

    // Format projects for dropdown
    const assignedProjects = memberProjects.map((mp: any) => ({
      id: mp.projects.id,
      name: mp.projects.name,
      role: mp.global_roles.name
    }));

    // Calculate pagination
    const totalPages = Math.ceil((totalAccessibleTickets || 0) / limit);

    const responseData = {
      overview: {
        myAssignedTickets: { 
          value: totalAccessibleTickets || 0, 
          change: '0', 
          changeType: 'neutral' as const 
        },
        myCreatedTickets: { 
          value: totalCreatedTickets || 0, 
          change: '0', 
          changeType: 'neutral' as const 
        },
        inProgressTickets: { 
          value: inProgressCount || 0, 
          change: '0', 
          changeType: 'neutral' as const 
        },
        completedTickets: { 
          value: completedCount || 0, 
          change: '0', 
          changeType: 'neutral' as const 
        }
      },
      recentActivity,
      quickStats: {
        memberInfo: {
          assignedProjects,
          totalProjects: assignedProjects.length
        }
      },
      chartData: { weekly: [] }, // TODO: Implement chart data if needed
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalAccessibleTickets || 0,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };

    console.log('✅ MEMBER: Dashboard metrics compiled successfully');
    console.log('✅ MEMBER: Recent activity count:', recentActivity.length);

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ MEMBER: Unexpected error in user-dashboard-metrics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}