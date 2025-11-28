import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, sql, eq, and, gte, lt, inArray, isNull } from '@/lib/db-helper';
import { 
  tickets, projects, users, statuses, priorities,
  userProject, userOrganizationRoles, userDepartmentRoles,
  projectDepartment, sharedProjects, resourceRequests,
  globalRoles
} from '@/lib/db-helper';

/**
 * DASHBOARD METRICS API - PROJECT-BASED SYSTEM
 * 
 * This API provides dashboard metrics based on the PROJECT-BASED role system.
 * 
 * Role Priority (from JWT):
 * 1. project_role (DOMINANT) - User's role in the current project
 * 2. department_role (Fallback) - User's role in current department
 * 3. org_role (Profile only) - User's organization-level role
 * 
 * Data Filtering:
 * - PRIORITY 1: Filter by project_id from JWT (current project)
 * - PRIORITY 2: Filter by project_id from query params
 * - PRIORITY 3: Fallback to department-based filtering (if no project context)
 * 
 * Supported Roles:
 * - Admin: See organization-wide or project-specific data
 * - Manager: See managed projects or current project data
 * - Member: See assigned projects or current project data
 */

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

// Helper function to calculate percentage change
function calculatePercentageChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}

// Helper function to get date range for comparison
function getDateRanges() {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay());
  currentWeekStart.setHours(0, 0, 0, 0);
  
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(currentWeekStart.getDate() - 7);
  
  const previousWeekEnd = new Date(currentWeekStart);
  previousWeekEnd.setTime(previousWeekEnd.getTime() - 1);

  return {
    currentMonthStart: currentMonthStart.toISOString(),
    previousMonthStart: previousMonthStart.toISOString(),
    previousMonthEnd: previousMonthEnd.toISOString(),
    currentWeekStart: currentWeekStart.toISOString(),
    previousWeekStart: previousWeekStart.toISOString(),
    previousWeekEnd: previousWeekEnd.toISOString()
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    const departmentId = searchParams.get('department_id'); // Get department from URL
    const statusId = searchParams.get('status_id');
    const priorityId = searchParams.get('priority_id');
    const metricType = searchParams.get('type') || 'overview'; // overview, project, team
    const testMode = searchParams.get('test') === 'true'; // Test mode bypass
    
    console.log('📊 ADMIN API: Received parameters:', { 
      projectId, 
      departmentId, 
      statusId, 
      priorityId 
    });
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    // Test mode with mock data for pagination testing
    if (testMode) {
      console.log('🧪 TEST MODE: Returning mock data for pagination testing');
      
      // Generate 15 mock tickets for testing pagination
      const mockTickets = Array.from({ length: 15 }, (_, i) => ({
        id: `test-ticket-${i + 1}`,
        title: `Test Ticket ${i + 1}`,
        created_at: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
        status_id: 'test-status',
        priority_id: 'test-priority',
        created_by: 'test-user',
        assigned_to: 'test-assignee',
        projects: { name: 'Test Project' },
        creator: { name: 'Test Creator' },
        assignee: { name: 'Test Assignee' },
        statuses: { name: 'Open', color_code: '#3b82f6' }
      }));
      
      // Apply pagination to mock data
      const paginatedTickets = mockTickets.slice(offset, offset + limit);
      const totalPages = Math.ceil(mockTickets.length / limit);
      
      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalTickets: { value: 15, change: '+5%', changeType: 'positive' },
            activeProjects: { value: 3, change: '+1', changeType: 'positive' }
          },
          recentActivity: paginatedTickets.map(ticket => ({
            id: ticket.id,
            title: ticket.title,
            status: ticket.statuses.name,
            time: 'just now',
            project: ticket.projects.name,
            priority: 'Medium',
            assignedTo: ticket.assignee.name
          })),
          pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalItems: mockTickets.length,
            itemsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          },
          chartData: { weekly: [] },
          quickStats: {}
        }
      });
    }
    
    // Verify authentication for normal mode
    const authHeader = req.headers.get('authorization');
    const tokenData = await verifyToken(authHeader);
    
    if (!tokenData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = tokenData.org_id;
    const userId = tokenData.sub; // User ID from token
    const currentProjectId = tokenData.project_id; // CURRENT PROJECT from JWT (DOMINANT)
    const projectRole = tokenData.project_role; // PROJECT ROLE from JWT (DOMINANT)
    const currentDepartmentId = tokenData.department_id; // Current department from JWT (fallback)
    const departmentRole = tokenData.department_role; // Department role from JWT (fallback)
    const orgRole = tokenData.org_role; // Org role (for profile only)
    
    console.log('🔍 DASHBOARD METRICS - JWT Data:', {
      project_id: currentProjectId,
      project_role: projectRole,
      department_id: currentDepartmentId,
      department_role: departmentRole,
      org_role: orgRole
    });
    
    // Get user's organization role using global roles system
    const userOrgRoleResult = await db.execute<{
      role_id: string;
      role_name: string;
    }>(sql`
      SELECT uor.role_id, gr.name as role_name
      FROM user_organization_roles uor
      INNER JOIN global_roles gr ON uor.role_id = gr.id
      WHERE uor.user_id = ${userId}
      AND uor.organization_id = ${organizationId}
      LIMIT 1
    `);
    const userOrgRole = userOrgRoleResult.rows[0] ? {
      role_id: userOrgRoleResult.rows[0].role_id,
      global_roles: { name: userOrgRoleResult.rows[0].role_name }
    } : null;
    const orgRoleError = null;

    // Check if user has department roles
    const userDeptRolesResult = await db.execute<{
      role_id: string;
      department_id: string;
      role_name: string;
    }>(sql`
      SELECT udr.role_id, udr.department_id, gr.name as role_name
      FROM user_department_roles udr
      INNER JOIN global_roles gr ON udr.role_id = gr.id
      WHERE udr.user_id = ${userId}
      AND udr.organization_id = ${organizationId}
    `);
    const userDeptRoles = userDeptRolesResult.rows.map((row: any) => ({
      role_id: row.role_id,
      department_id: row.department_id,
      global_roles: { name: row.role_name }
    }));

    // Use current department from JWT if available, then URL parameter, then fallback to users table
    let userDepartmentId = departmentId || currentDepartmentId; // Prioritize URL parameter
    if (!userDepartmentId) {
      const userDataResult = await db.select({ departmentId: users.departmentId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      userDepartmentId = userDataResult[0]?.departmentId;
    }
    
    console.log('🔍 ADMIN API: Department resolution:', {
      fromURL: departmentId,
      fromJWT: currentDepartmentId,
      final: userDepartmentId
    });

    // ROLE PRIORITY: project role (if project assigned) > department role > org role (PROJECT-BASED SYSTEM)
    // Only use project role if user is actually in a project context
    let actualUserRole = (currentProjectId ? projectRole : null) || departmentRole || orgRole || tokenData.role || 'Member';
    
    console.log('🎯 DASHBOARD METRICS - Effective Role:', actualUserRole);
    
    // Only use global org role as fallback if no project or department role
    if (!projectRole && !departmentRole && !orgRole && userOrgRole && userOrgRole.global_roles) {
      actualUserRole = (userOrgRole.global_roles as any).name;
    } else if (!projectRole && !departmentRole && !orgRole && !userOrgRole && userDeptRoles && userDeptRoles.length > 0) {
      actualUserRole = (userDeptRoles[0].global_roles as any)?.name || 'Member';
    }

    // Check if user is dept-only admin
    const isDeptOnlyAdmin = !userOrgRole && userDeptRoles && userDeptRoles.length > 0;

    const isAdmin = actualUserRole === 'Admin';
    const isManager = actualUserRole === 'Manager';
    const isMember = actualUserRole === 'Member' || actualUserRole === 'Viewer';

    console.log('🔧 Dashboard metrics - Department role (JWT):', departmentRole);
    console.log('🔧 Dashboard metrics - Project role (JWT):', tokenData.role);
    console.log('🔧 Dashboard metrics - Global org role:', userOrgRole?.global_roles ? (userOrgRole.global_roles as any).name : 'none');
    console.log('🔧 Dashboard metrics - Final role:', actualUserRole);
    console.log('🔧 Dashboard metrics - Current department:', currentDepartmentId);

    const dateRanges = getDateRanges();

    // Define types for metrics
    interface MetricValue {
      value: number | string;
      change: string;
      changeType: 'positive' | 'negative' | 'neutral';
    }

    interface ActivityItem {
      id: any;
      title: string;
      status: string;
      time: string;
      project?: string;
      priority: string;
      assignedTo: string;
      createdBy?: string;
      assigned_to?: string; // Alternative field name
      created_by?: string;  // Alternative field name
    }

    interface ChartDataPoint {
      day: string;
      tickets: number;
    }

    // Base metrics for all users
    let metrics: {
      overview: Record<string, MetricValue>;
      recentActivity: ActivityItem[];
      chartData: { weekly?: ChartDataPoint[] };
      quickStats: Record<string, any>;
      pagination?: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    } = {
      overview: {},
      recentActivity: [],
      chartData: {},
      quickStats: {}
    };

    if (isAdmin) {
      // ADMIN METRICS - Project-specific if JWT has project_id, else organization-wide
      
      console.log('📊 ADMIN METRICS - Filtering strategy:', {
        hasProjectId: !!currentProjectId,
        projectId: currentProjectId,
        projectRole: projectRole
      });
      
      // Build ticket queries with project filter (PROJECT-BASED SYSTEM)
      let currentTicketsConditions = sql`
        SELECT t.id, t.created_at, t.status_id, t.priority_id, t.project_id
        FROM tickets t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE p.organization_id = ${organizationId}
        AND t.created_at >= ${dateRanges.currentMonthStart}
      `;
      let previousTicketsConditions = sql`
        SELECT t.id, t.project_id
        FROM tickets t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE p.organization_id = ${organizationId}
        AND t.created_at >= ${dateRanges.previousMonthStart}
        AND t.created_at < ${dateRanges.currentMonthStart}
      `;

      // PRIORITY 1: Filter by current project from JWT (if available)
      if (currentProjectId) {
        console.log('✅ Filtering by current project from JWT:', currentProjectId);
        currentTicketsConditions = sql`
          SELECT t.id, t.created_at, t.status_id, t.priority_id, t.project_id
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          WHERE p.organization_id = ${organizationId}
          AND t.created_at >= ${dateRanges.currentMonthStart}
          AND t.project_id = ${currentProjectId}
        `;
        previousTicketsConditions = sql`
          SELECT t.id, t.project_id
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          WHERE p.organization_id = ${organizationId}
          AND t.created_at >= ${dateRanges.previousMonthStart}
          AND t.created_at < ${dateRanges.currentMonthStart}
          AND t.project_id = ${currentProjectId}
        `;
      }
      // PRIORITY 2: Filter by project query parameter (if provided and no JWT project)
      else if (projectId) {
        console.log('✅ Filtering by project from query param:', projectId);
        currentTicketsConditions = sql`
          SELECT t.id, t.created_at, t.status_id, t.priority_id, t.project_id
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          WHERE p.organization_id = ${organizationId}
          AND t.created_at >= ${dateRanges.currentMonthStart}
          AND t.project_id = ${projectId}
        `;
        previousTicketsConditions = sql`
          SELECT t.id, t.project_id
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          WHERE p.organization_id = ${organizationId}
          AND t.created_at >= ${dateRanges.previousMonthStart}
          AND t.created_at < ${dateRanges.currentMonthStart}
          AND t.project_id = ${projectId}
        `;
      }
      // PRIORITY 3: Department fallback (only if no project context)
      else if ((isDeptOnlyAdmin || departmentRole === 'Admin') && userDepartmentId) {
        console.log('✅ Fallback: Filtering by department:', userDepartmentId);
        const deptProjectIdsResult = await db.execute<{ project_id: string }>(sql`
          SELECT project_id FROM project_department
          WHERE department_id = ${userDepartmentId}
        `);
        
        const projectIds = deptProjectIdsResult.rows.map((p: any) => p.project_id) || [];
        
        if (projectIds.length > 0) {
          currentTicketsConditions = sql`
            SELECT t.id, t.created_at, t.status_id, t.priority_id, t.project_id
            FROM tickets t
            INNER JOIN projects p ON t.project_id = p.id
            WHERE p.organization_id = ${organizationId}
            AND t.created_at >= ${dateRanges.currentMonthStart}
            AND t.project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          `;
          previousTicketsConditions = sql`
            SELECT t.id, t.project_id
            FROM tickets t
            INNER JOIN projects p ON t.project_id = p.id
            WHERE p.organization_id = ${organizationId}
            AND t.created_at >= ${dateRanges.previousMonthStart}
            AND t.created_at < ${dateRanges.currentMonthStart}
            AND t.project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          `;
        } else {
          // No projects, no tickets
          currentTicketsConditions = sql`
            SELECT t.id, t.created_at, t.status_id, t.priority_id, t.project_id
            FROM tickets t WHERE t.project_id = '00000000-0000-0000-0000-000000000000'
          `;
          previousTicketsConditions = sql`
            SELECT t.id, t.project_id
            FROM tickets t WHERE t.project_id = '00000000-0000-0000-0000-000000000000'
          `;
        }
      }

      const currentTicketsResult = await db.execute<{ id: string; created_at: string; status_id: string; priority_id: string; project_id: string }>(currentTicketsConditions);
      const currentTickets = currentTicketsResult.rows;
      const previousTicketsResult = await db.execute<{ id: string; project_id: string }>(previousTicketsConditions);
      const previousTickets = previousTicketsResult.rows;

      // Active Projects - PROJECT-BASED SYSTEM
      let activeProjectsConditions = sql`
        SELECT id, name, created_at
        FROM projects
        WHERE organization_id = ${organizationId}
      `;
      
      // If user has specific project in JWT, show only that project
      if (currentProjectId) {
        console.log('✅ Active Projects: Filtering by current project from JWT');
        activeProjectsConditions = sql`
          SELECT id, name, created_at
          FROM projects
          WHERE organization_id = ${organizationId}
          AND id = ${currentProjectId}
        `;
      }
      // Department-level admin: filter by department (fallback only)
      else if ((isDeptOnlyAdmin || departmentRole === 'Admin') && userDepartmentId) {
        console.log('✅ Active Projects: Filtering by department (fallback)');
        // Get projects owned by current department OR shared with current department
        const ownedProjectIdsResult = await db.execute<{ project_id: string }>(sql`
          SELECT project_id FROM project_department
          WHERE department_id = ${userDepartmentId}
        `);
        
        const sharedProjectIdsResult = await db.execute<{ project_id: string }>(sql`
          SELECT project_id FROM shared_projects
          WHERE department_id = ${userDepartmentId}
        `);
        
        const projectIds = [
          ...(ownedProjectIdsResult.rows.map((p: any) => p.project_id) || []),
          ...(sharedProjectIdsResult.rows.map((p: any) => p.project_id) || [])
        ];
        
        if (projectIds.length > 0) {
          activeProjectsConditions = sql`
            SELECT id, name, created_at
            FROM projects
            WHERE organization_id = ${organizationId}
            AND id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          `;
        } else {
          // No projects for this department
          activeProjectsConditions = sql`
            SELECT id, name, created_at
            FROM projects
            WHERE id = '00000000-0000-0000-0000-000000000000'
          `;
        }
      }
      
      // If project filter is applied, get only that specific project
      if (projectId) {
        activeProjectsConditions = sql`
          SELECT id, name, created_at
          FROM projects
          WHERE organization_id = ${organizationId}
          AND id = ${projectId}
        `;
      }

      const activeProjectsResult = await db.execute<{ id: string; name: string; created_at: string }>(activeProjectsConditions);
      const activeProjects = activeProjectsResult.rows;

      // Team Members
      let currentMembersResult, previousMembersResult;
      
      console.log('👥 TEAM MEMBERS QUERY - Parameters:', {
        hasProjectFilter: !!projectId,
        projectId,
        organizationId
      });
      
      if (projectId) {
        // If project filter is applied, get only members of that project
        currentMembersResult = await db.execute<{
          user_id: string;
          id: string;
          name: string;
          email: string;
          created_at: string;
        }>(sql`
          SELECT up.user_id, u.id, u.name, u.email, u.created_at
          FROM user_project up
          INNER JOIN users u ON up.user_id = u.id
          WHERE up.project_id = ${projectId}
        `);

        previousMembersResult = await db.execute<{
          user_id: string;
          created_at: string;
        }>(sql`
          SELECT up.user_id, u.created_at
          FROM user_project up
          INNER JOIN users u ON up.user_id = u.id
          WHERE up.project_id = ${projectId}
          AND u.created_at < ${dateRanges.currentMonthStart}
        `);
      } else {
        // For department admins, get members from department projects only
        // For org admins, get all organization members
        let projectIdsToQuery = [];
        
        if ((isDeptOnlyAdmin || departmentRole === 'Admin') && userDepartmentId) {
          // Department admin - get only department projects
          const deptProjectsResult = await db.execute<{ id: string }>(sql`
            SELECT project_id as id FROM project_department
            WHERE department_id = ${userDepartmentId}
          `);
          projectIdsToQuery = deptProjectsResult.rows.map((p: any) => p.id) || [];
        } else {
          // Organization admin - get all projects in the organization
          const orgProjectsResult = await db.execute<{ id: string }>(sql`
            SELECT id FROM projects
            WHERE organization_id = ${organizationId}
          `);
          projectIdsToQuery = orgProjectsResult.rows.map((p: any) => p.id) || [];
        }
        
        if (projectIdsToQuery.length > 0) {
          currentMembersResult = await db.execute<{
            user_id: string;
            id: string;
            name: string;
            email: string;
            created_at: string;
          }>(sql`
            SELECT up.user_id, u.id, u.name, u.email, u.created_at
            FROM user_project up
            INNER JOIN users u ON up.user_id = u.id
            WHERE up.project_id = ANY(ARRAY[${sql.join(projectIdsToQuery.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          `);

          previousMembersResult = await db.execute<{
            user_id: string;
            created_at: string;
          }>(sql`
            SELECT up.user_id, u.created_at
            FROM user_project up
            INNER JOIN users u ON up.user_id = u.id
            WHERE up.project_id = ANY(ARRAY[${sql.join(projectIdsToQuery.map((id: any) => sql`${id}::uuid`), sql`, `)}])
            AND u.created_at < ${dateRanges.currentMonthStart}
          `);
        } else {
          // No projects - return empty
          currentMembersResult = { rows: [] };
          previousMembersResult = { rows: [] };
        }
      }

      const currentMembers = currentMembersResult.rows;
      const currentMembersError = null;
      const previousMembers = previousMembersResult.rows;

      // Deduplicate members by user_id (in case user is in multiple projects)
      const uniqueCurrentMembers = currentMembers ? 
        Array.from(new Map(currentMembers.map((m: any) => [m.user_id, m])).values()) : [];
      const uniquePreviousMembers = previousMembers ?
        Array.from(new Map(previousMembers.map((m: any) => [m.user_id, m])).values()) : [];

      if (currentMembersError) {
        console.error('❌ Error fetching current members:', currentMembersError);
      }
      
      console.log('👥 TEAM MEMBERS RESULT:', {
        rawCount: currentMembers?.length || 0,
        uniqueCount: uniqueCurrentMembers.length,
        currentMembers,
        uniqueCurrentMembers,
        error: currentMembersError
      });

      // Average Resolution Time (simplified calculation)
      let resolvedTicketsConditions = sql`
        SELECT t.created_at, t.updated_at
        FROM tickets t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE p.organization_id = ${organizationId}
        AND t.created_at >= ${dateRanges.currentMonthStart}
        AND t.updated_at IS NOT NULL
      `;
      
      // Filter by department if department admin
      if ((isDeptOnlyAdmin || departmentRole === 'Admin') && userDepartmentId) {
        const deptProjectIdsResult = await db.execute<{ project_id: string }>(sql`
          SELECT project_id FROM project_department
          WHERE department_id = ${userDepartmentId}
        `);
        
        const projectIds = deptProjectIdsResult.rows.map((p: any) => p.project_id) || [];
        if (projectIds.length > 0) {
          resolvedTicketsConditions = sql`
            SELECT t.created_at, t.updated_at
            FROM tickets t
            INNER JOIN projects p ON t.project_id = p.id
            WHERE p.organization_id = ${organizationId}
            AND t.created_at >= ${dateRanges.currentMonthStart}
            AND t.updated_at IS NOT NULL
            AND t.project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          `;
        }
      }
      
      // Apply project filter if specified
      if (projectId) {
        resolvedTicketsConditions = sql`
          SELECT t.created_at, t.updated_at
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          WHERE p.organization_id = ${organizationId}
          AND t.created_at >= ${dateRanges.currentMonthStart}
          AND t.updated_at IS NOT NULL
          AND t.project_id = ${projectId}
        `;
      }

      const resolvedTicketsResult = await db.execute<{ created_at: string; updated_at: string }>(resolvedTicketsConditions);
      const resolvedTickets = resolvedTicketsResult.rows;

      // Calculate average resolution time
      let avgResolutionHours = 0;
      if (resolvedTickets && resolvedTickets.length > 0) {
        const totalHours = resolvedTickets.reduce((sum: any, ticket: any) => {
          const created = new Date(ticket.created_at).getTime();
          const updated = new Date(ticket.updated_at).getTime();
          return sum + ((updated - created) / (1000 * 60 * 60)); // Convert to hours
        }, 0);
        avgResolutionHours = totalHours / resolvedTickets.length;
      }

      // Recent Activity - First get total count for pagination
      let countConditions = sql`
        SELECT COUNT(*) as count
        FROM tickets t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE p.organization_id = ${organizationId}
      `;
      
      // Filter by department if department admin
      if ((isDeptOnlyAdmin || departmentRole === 'Admin') && userDepartmentId) {
        const deptProjectIdsResult = await db.execute<{ project_id: string }>(sql`
          SELECT project_id FROM project_department
          WHERE department_id = ${userDepartmentId}
        `);
        
        const projectIds = deptProjectIdsResult.rows.map((p: any) => p.project_id) || [];
        if (projectIds.length > 0) {
          countConditions = sql`
            SELECT COUNT(*) as count
            FROM tickets t
            INNER JOIN projects p ON t.project_id = p.id
            WHERE p.organization_id = ${organizationId}
            AND t.project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          `;
        } else {
          // Department admin with no projects - return 0
          countConditions = sql`
            SELECT COUNT(*) as count
            FROM tickets t
            WHERE t.project_id = '00000000-0000-0000-0000-000000000000'
          `;
        }
      }
      
      if (projectId) {
        countConditions = sql`
          SELECT COUNT(*) as count
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          WHERE p.organization_id = ${organizationId}
          AND t.project_id = ${projectId}
        `;
      }
      if (statusId) {
        // Add status filter to existing conditions - need to rebuild query
        const baseWhere = projectId ? `p.organization_id = '${organizationId}' AND t.project_id = '${projectId}'` : `p.organization_id = '${organizationId}'`;
        countConditions = sql.raw(`
          SELECT COUNT(*) as count
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          WHERE ${baseWhere}
          AND t.status_id = '${statusId}'
        `);
      }
      if (priorityId) {
        // Add priority filter - need to rebuild query
        const baseWhere = projectId ? `p.organization_id = '${organizationId}' AND t.project_id = '${projectId}'` : `p.organization_id = '${organizationId}'`;
        const statusWhere = statusId ? `AND t.status_id = '${statusId}'` : '';
        countConditions = sql.raw(`
          SELECT COUNT(*) as count
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          WHERE ${baseWhere}
          ${statusWhere}
          AND t.priority_id = '${priorityId}'
        `);
      }
      
      const countResult = await db.execute<{ count: number }>(countConditions);
      const totalTickets = countResult.rows[0]?.count || 0;
      console.log('🔢 COUNT DEBUG:', { totalTickets, page, limit, offset, organizationId, userDepartmentId });
      
      // Then get paginated results
      let recentTicketsConditions = sql`
        SELECT 
          t.id, t.title, t.created_at, t.status_id, t.priority_id,
          t.created_by, t.assigned_to,
          p.name as project_name,
          creator.name as creator_name,
          assignee.name as assignee_name,
          s.name as status_name, s.color_code as status_color,
          pr.name as priority_name, pr.color_code as priority_color
        FROM tickets t
        INNER JOIN projects p ON t.project_id = p.id
        LEFT JOIN users creator ON t.created_by = creator.id
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        LEFT JOIN statuses s ON t.status_id = s.id
        LEFT JOIN priorities pr ON t.priority_id = pr.id
        WHERE p.organization_id = ${organizationId}
        ORDER BY t.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      
      // Filter by department if department admin
      if ((isDeptOnlyAdmin || departmentRole === 'Admin') && userDepartmentId) {
        const deptProjectIdsResult = await db.execute<{ project_id: string }>(sql`
          SELECT project_id FROM project_department
          WHERE department_id = ${userDepartmentId}
        `);
        
        const projectIds = deptProjectIdsResult.rows.map((p: any) => p.project_id) || [];
        if (projectIds.length > 0) {
          recentTicketsConditions = sql`
            SELECT 
              t.id, t.title, t.created_at, t.status_id, t.priority_id,
              t.created_by, t.assigned_to,
              p.name as project_name,
              creator.name as creator_name,
              assignee.name as assignee_name,
              s.name as status_name, s.color_code as status_color,
              pr.name as priority_name, pr.color_code as priority_color
            FROM tickets t
            INNER JOIN projects p ON t.project_id = p.id
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN users assignee ON t.assigned_to = assignee.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN priorities pr ON t.priority_id = pr.id
            WHERE p.organization_id = ${organizationId}
            AND t.project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
            ORDER BY t.created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `;
        } else {
          // Department admin with no projects - return empty result
          recentTicketsConditions = sql`
            SELECT 
              t.id, t.title, t.created_at, t.status_id, t.priority_id,
              t.created_by, t.assigned_to,
              p.name as project_name,
              creator.name as creator_name,
              assignee.name as assignee_name,
              s.name as status_name, s.color_code as status_color,
              pr.name as priority_name, pr.color_code as priority_color
            FROM tickets t
            INNER JOIN projects p ON t.project_id = p.id
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN users assignee ON t.assigned_to = assignee.id
            LEFT JOIN statuses s ON t.status_id = s.id
            LEFT JOIN priorities pr ON t.priority_id = pr.id
            WHERE t.project_id = '00000000-0000-0000-0000-000000000000'
            ORDER BY t.created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `;
        }
      }
      
      // Apply filters if specified
      if (projectId) {
        recentTicketsConditions = sql`
          SELECT 
            t.id, t.title, t.created_at, t.status_id, t.priority_id,
            t.created_by, t.assigned_to,
            p.name as project_name,
            creator.name as creator_name,
            assignee.name as assignee_name,
            s.name as status_name, s.color_code as status_color,
            pr.name as priority_name, pr.color_code as priority_color
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          LEFT JOIN users creator ON t.created_by = creator.id
          LEFT JOIN users assignee ON t.assigned_to = assignee.id
          LEFT JOIN statuses s ON t.status_id = s.id
          LEFT JOIN priorities pr ON t.priority_id = pr.id
          WHERE p.organization_id = ${organizationId}
          AND t.project_id = ${projectId}
          ORDER BY t.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      }
      if (statusId && projectId) {
        recentTicketsConditions = sql`
          SELECT 
            t.id, t.title, t.created_at, t.status_id, t.priority_id,
            t.created_by, t.assigned_to,
            p.name as project_name,
            creator.name as creator_name,
            assignee.name as assignee_name,
            s.name as status_name, s.color_code as status_color,
            pr.name as priority_name, pr.color_code as priority_color
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          LEFT JOIN users creator ON t.created_by = creator.id
          LEFT JOIN users assignee ON t.assigned_to = assignee.id
          LEFT JOIN statuses s ON t.status_id = s.id
          LEFT JOIN priorities pr ON t.priority_id = pr.id
          WHERE p.organization_id = ${organizationId}
          AND t.project_id = ${projectId}
          AND t.status_id = ${statusId}
          ORDER BY t.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      }
      if (priorityId && projectId) {
        const statusFilter = statusId ? sql`AND t.status_id = ${statusId}` : sql``;
        recentTicketsConditions = sql`
          SELECT 
            t.id, t.title, t.created_at, t.status_id, t.priority_id,
            t.created_by, t.assigned_to,
            p.name as project_name,
            creator.name as creator_name,
            assignee.name as assignee_name,
            s.name as status_name, s.color_code as status_color,
            pr.name as priority_name, pr.color_code as priority_color
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          LEFT JOIN users creator ON t.created_by = creator.id
          LEFT JOIN users assignee ON t.assigned_to = assignee.id
          LEFT JOIN statuses s ON t.status_id = s.id
          LEFT JOIN priorities pr ON t.priority_id = pr.id
          WHERE p.organization_id = ${organizationId}
          AND t.project_id = ${projectId}
          ${statusFilter}
          AND t.priority_id = ${priorityId}
          ORDER BY t.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      }

      const recentTicketsResult = await db.execute<{
        id: string;
        title: string;
        created_at: string;
        status_id: string;
        priority_id: string;
        created_by: string;
        assigned_to: string;
        project_name: string;
        creator_name: string;
        assignee_name: string;
        status_name: string;
        status_color: string;
        priority_name: string;
        priority_color: string;
      }>(recentTicketsConditions);
      const recentTickets = recentTicketsResult.rows;
      
      // Calculate pagination metadata
      const totalPages = Math.ceil((totalTickets || 0) / limit);
      metrics.pagination = {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalTickets || 0,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

      metrics.overview = {
        totalTickets: {
          value: totalTickets || 0,
          change: calculatePercentageChange(
            currentTickets?.length || 0,
            previousTickets?.length || 0
          ),
          changeType: (currentTickets?.length || 0) >= (previousTickets?.length || 0) ? 'positive' : 'negative'
        },
        activeProjects: {
          value: activeProjects?.length || 0,
          change: '+5%', // Simplified - could be calculated based on creation dates
          changeType: 'positive'
        },
        teamMembers: {
          value: uniqueCurrentMembers.length,
          change: calculatePercentageChange(
            uniqueCurrentMembers.length,
            uniquePreviousMembers.length
          ),
          changeType: uniqueCurrentMembers.length >= uniquePreviousMembers.length ? 'positive' : 'negative'
        },
        avgResolutionTime: {
          value: `${avgResolutionHours.toFixed(1)}h`,
          change: '-15%', // Simplified - could be calculated based on previous period
          changeType: 'positive' // Lower resolution time is better
        }
      };

      // Add shared projects count for department admins
      if (isDeptOnlyAdmin && userDepartmentId) {
        const sharedProjectsResult = await db.execute<{ project_id: string }>(sql`
          SELECT project_id FROM shared_projects
          WHERE department_id = ${userDepartmentId}
        `);
        const sharedProjectsData = sharedProjectsResult.rows;

        metrics.overview.sharedProjects = {
          value: sharedProjectsData?.length || 0,
          change: '0%',
          changeType: 'neutral' as const
        };

        // Get pending requests count
        const pendingRequestsResult = await db.execute<{ id: string }>(sql`
          SELECT id FROM resource_requests
          WHERE user_department_id = ${userDepartmentId}
          AND status = 'pending'
        `);
        const pendingRequests = pendingRequestsResult.rows;

        metrics.overview.pendingRequests = {
          value: pendingRequests?.length || 0,
          change: '0%',
          changeType: 'neutral' as const
        };
      }

      metrics.recentActivity = recentTickets?.map((ticket: any) => ({
        id: ticket.id,
        title: ticket.title,
        status: ticket.status_name || 'Unknown',
        time: formatTimeAgo(ticket.created_at),
        project: ticket.project_name || 'Unknown Project',
        priority: ticket.priority_name || 'Medium',
        priorityColor: ticket.priority_color || '#6B7280',
        assignedTo: ticket.assignee_name || 'Unassigned',
        createdBy: ticket.creator_name || 'Unknown',
        assigned_to: ticket.assignee_name || 'Unassigned', // Alternative field name
        created_by: ticket.creator_name || 'Unknown' // Alternative field name
      })) || [];

    } else if (isManager) {
      // MANAGER METRICS - PROJECT-BASED SYSTEM
      // Prioritize current project from JWT, fallback to all managed projects
      
      console.log('📊 MANAGER METRICS - Filtering strategy:', {
        hasProjectId: !!currentProjectId,
        projectId: currentProjectId,
        projectRole: projectRole,
        queryProjectId: projectId
      });
      
      // Get projects managed by this user
      let managedProjectsConditions = sql`
        SELECT 
          up.project_id, up.role_id,
          p.id as project_id, p.name as project_name, p.organization_id,
          pd.department_id,
          gr.name as role_name
        FROM user_project up
        INNER JOIN projects p ON up.project_id = p.id
        LEFT JOIN project_department pd ON p.id = pd.project_id
        LEFT JOIN global_roles gr ON up.role_id = gr.id
        WHERE up.user_id = ${tokenData.sub}
        AND p.organization_id = ${organizationId}
        ORDER BY p.created_at ASC
      `;

      // PRIORITY 1: If JWT has current project, show only that project
      if (currentProjectId) {
        console.log('✅ Manager: Filtering by current project from JWT');
        managedProjectsConditions = sql`
          SELECT 
            up.project_id, up.role_id,
            p.id as project_id, p.name as project_name, p.organization_id,
            pd.department_id,
            gr.name as role_name
          FROM user_project up
          INNER JOIN projects p ON up.project_id = p.id
          LEFT JOIN project_department pd ON p.id = pd.project_id
          LEFT JOIN global_roles gr ON up.role_id = gr.id
          WHERE up.user_id = ${tokenData.sub}
          AND p.organization_id = ${organizationId}
          AND up.project_id = ${currentProjectId}
          ORDER BY p.created_at ASC
        `;
      }
      // PRIORITY 2: Department filter (fallback only if no project in JWT)
      else if (currentDepartmentId) {
        console.log('✅ Manager: Filtering by department (fallback)');
        // Limit manager's project list to projects within the current department
        managedProjectsConditions = sql`
          SELECT 
            up.project_id, up.role_id,
            p.id as project_id, p.name as project_name, p.organization_id,
            pd.department_id,
            gr.name as role_name
          FROM user_project up
          INNER JOIN projects p ON up.project_id = p.id
          LEFT JOIN project_department pd ON p.id = pd.project_id
          LEFT JOIN global_roles gr ON up.role_id = gr.id
          WHERE up.user_id = ${tokenData.sub}
          AND p.organization_id = ${organizationId}
          AND pd.department_id = ${currentDepartmentId}
          ORDER BY p.created_at ASC
        `;
      }

      const managedProjectsResult = await db.execute<{
        project_id: string;
        role_id: string;
        project_name: string;
        organization_id: string;
        department_id: string;
        role_name: string;
      }>(managedProjectsConditions);
      const managedProjects = managedProjectsResult.rows;
      const managedProjectsError = null;

      console.log('🔧 MANAGER PROJECTS QUERY:', { managedProjects, managedProjectsError, userId: tokenData.sub, organizationId });

      const projectIds = managedProjects?.map((mp: any) => mp.project_id) || [];
      console.log('🔧 MANAGER DEBUG: Managed projects:', projectIds, 'Selected project:', projectId);

      // Determine target project: JWT project > query param > first managed project
      const targetProjectId = currentProjectId || projectId || (projectIds.length > 0 ? projectIds[0] : null);
      
      if (targetProjectId && targetProjectId !== 'all') {
        console.log('✅ Manager: Using project ID:', targetProjectId);
        // SPECIFIC PROJECT METRICS
        // Project Tickets - Get all tickets for the project (not filtered by date for total count)
        const projectTicketsResult = await db.execute<{
          id: string;
          created_at: string;
          status_id: string;
          priority_id: string;
        }>(sql`
          SELECT id, created_at, status_id, priority_id
          FROM tickets
          WHERE project_id = ${targetProjectId}
        `);
        const projectTickets = projectTicketsResult.rows;
        
        // Project Tickets for current month (for comparison metrics)
        const currentMonthTicketsResult = await db.execute<{
          id: string;
          created_at: string;
          status_id: string;
          priority_id: string;
        }>(sql`
          SELECT id, created_at, status_id, priority_id
          FROM tickets
          WHERE project_id = ${targetProjectId}
          AND created_at >= ${dateRanges.currentMonthStart}
        `);
        const currentMonthTickets = currentMonthTicketsResult.rows;

        const previousProjectTicketsResult = await db.execute<{ id: string }>(sql`
          SELECT id
          FROM tickets
          WHERE project_id = ${targetProjectId}
          AND created_at >= ${dateRanges.previousMonthStart}
          AND created_at < ${dateRanges.currentMonthStart}
        `);
        const previousProjectTickets = previousProjectTicketsResult.rows;

        // Team Members in Project
        const projectTeamMembersResult = await db.execute<{
          user_id: string;
          role_id: string;
          id: string;
          name: string;
          email: string;
          role_name: string;
        }>(sql`
          SELECT 
            up.user_id, up.role_id,
            u.id, u.name, u.email,
            gr.name as role_name
          FROM user_project up
          INNER JOIN users u ON up.user_id = u.id
          LEFT JOIN global_roles gr ON up.role_id = gr.id
          WHERE up.project_id = ${targetProjectId}
        `);
        const projectTeamMembers = projectTeamMembersResult.rows;
        const teamMembersError = null;

        if (teamMembersError) {
          console.error('❌ Error fetching project team members:', teamMembersError);
        }
        
        console.log('👥 DASHBOARD METRICS - Team Members Query Result:', {
          projectId: targetProjectId,
          count: projectTeamMembers?.length || 0,
          members: projectTeamMembers,
          error: teamMembersError
        });

        // Completion Rate (tickets with 'completed' status) - for all project tickets
        const completedTicketsResult = await db.execute<{
          id: string;
          status_name: string;
        }>(sql`
          SELECT t.id, s.name as status_name
          FROM tickets t
          INNER JOIN statuses s ON t.status_id = s.id
          WHERE t.project_id = ${targetProjectId}
        `);
        const completedTickets = completedTicketsResult.rows;

        const completionRate = projectTickets?.length ? 
          ((completedTickets?.filter((t: any) => t.status_name?.toLowerCase().includes('complete') || 
                                            t.status_name?.toLowerCase().includes('done')).length || 0) / 
           projectTickets.length * 100).toFixed(0) : 0;

        // Recent Project Activity - First get count for pagination
        const totalProjectTicketsCountResult = await db.execute<{ count: number }>(sql`
          SELECT COUNT(*) as count
          FROM tickets
          WHERE project_id = ${targetProjectId}
        `);
        const totalProjectTickets = totalProjectTicketsCountResult.rows[0]?.count || 0;
        console.log('🔢 MANAGER COUNT DEBUG:', { totalProjectTickets, targetProjectId, page, limit });
        
        // Then get paginated results
        const recentProjectTicketsResult = await db.execute<{
          id: string;
          title: string;
          created_at: string;
          status_id: string;
          created_by: string;
          assigned_to: string;
          creator_name: string;
          assignee_name: string;
          status_name: string;
          status_color: string;
          priority_name: string;
          priority_color: string;
        }>(sql`
          SELECT 
            t.id, t.title, t.created_at, t.status_id,
            t.created_by, t.assigned_to,
            creator.name as creator_name,
            assignee.name as assignee_name,
            s.name as status_name, s.color_code as status_color,
            pr.name as priority_name, pr.color_code as priority_color
          FROM tickets t
          LEFT JOIN users creator ON t.created_by = creator.id
          LEFT JOIN users assignee ON t.assigned_to = assignee.id
          LEFT JOIN statuses s ON t.status_id = s.id
          LEFT JOIN priorities pr ON t.priority_id = pr.id
          WHERE t.project_id = ${targetProjectId}
          ORDER BY t.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `);
        const recentProjectTickets = recentProjectTicketsResult.rows;
        
        // Calculate pagination metadata for manager
        const totalPages = Math.ceil((totalProjectTickets || 0) / limit);
        metrics.pagination = {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalProjectTickets || 0,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        };

        metrics.overview = {
          projectTickets: {
            value: projectTickets?.length || 0, // Total tickets in project (all time)
            change: calculatePercentageChange(
              currentMonthTickets?.length || 0,    // Current month tickets
              previousProjectTickets?.length || 0  // Previous month tickets
            ),
            changeType: (currentMonthTickets?.length || 0) >= (previousProjectTickets?.length || 0) ? 'positive' : 'neutral'
          },
          teamMembers: {
            value: projectTeamMembers?.length || 0,
            change: '+1', // Could be calculated based on historical data
            changeType: 'positive'
          },
          completionRate: {
            value: `${completionRate}%`,
            change: '+12%', // Could be calculated based on previous period
            changeType: 'positive'
          },
          avgResolutionTime: {
            value: '2.1h', // Could be calculated from actual data
            change: '-0.5h',
            changeType: 'positive'
          }
        };

        metrics.recentActivity = recentProjectTickets?.map((ticket: any) => ({
          id: ticket.id,
          title: ticket.title,
          status: ticket.status_name || 'Unknown',
          time: formatTimeAgo(ticket.created_at),
          assignedTo: ticket.assignee_name || 'Unassigned',
          createdBy: ticket.creator_name || 'Unknown',
          assigned_to: ticket.assignee_name || 'Unassigned', // Alternative field name
          created_by: ticket.creator_name || 'Unknown', // Alternative field name
          priority: ticket.priority_name || 'Medium',
          priorityColor: ticket.priority_color || '#6B7280'
        })) || [];

        // Add project-specific data
        metrics.quickStats = {
          projectInfo: managedProjects?.find((mp: any) => mp.project_id === targetProjectId),
          availableProjects: managedProjects?.map((mp: any) => ({
            id: mp.project_id,
            name: mp.project_name,
            role: mp.role_name
          })) || []
        };

        // Get ticket counts for each team member
        const teamMemberTicketCounts = projectTeamMembers ? await Promise.all(
          projectTeamMembers.map(async (member: any) => {
            const countResult = await db.execute<{ count: number }>(sql`
              SELECT COUNT(*) as count
              FROM tickets
              WHERE project_id = ${targetProjectId}
              AND assigned_to = ${member.id}
            `);
            return { userId: member.id, ticketCount: countResult.rows[0]?.count || 0 };
          })
        ) : [];

        // Add team members data with ticket counts
        (metrics as any).teamMembers = projectTeamMembers?.map((member: any) => {
          const ticketCount = teamMemberTicketCounts.find((tc: any) => tc.userId === member.id)?.ticketCount || 0;
          return {
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role_name,
            tickets: ticketCount,
            status: 'Active' // Default status
          };
        }) || [];
      } else if (projectIds.length > 0) {
        // ALL PROJECTS METRICS FOR MANAGER - Aggregate across all managed projects
        console.log('🔧 MANAGER ALL PROJECTS: Aggregating metrics for projects:', projectIds);

        // Get all tickets from managed projects (all time for total count)
        const allProjectTicketsResult = await db.execute<{
          id: string;
          created_at: string;
          status_id: string;
          priority_id: string;
          project_id: string;
        }>(sql`
          SELECT id, created_at, status_id, priority_id, project_id
          FROM tickets
          WHERE project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
        `);
        const allProjectTickets = allProjectTicketsResult.rows;
        
        // Get current month tickets for comparison metrics
        const currentMonthAllTicketsResult = await db.execute<{
          id: string;
          created_at: string;
          status_id: string;
          priority_id: string;
          project_id: string;
        }>(sql`
          SELECT id, created_at, status_id, priority_id, project_id
          FROM tickets
          WHERE project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          AND created_at >= ${dateRanges.currentMonthStart}
        `);
        const currentMonthAllTickets = currentMonthAllTicketsResult.rows;

        const previousAllProjectTicketsResult = await db.execute<{ id: string }>(sql`
          SELECT id
          FROM tickets
          WHERE project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          AND created_at >= ${dateRanges.previousMonthStart}
          AND created_at < ${dateRanges.currentMonthStart}
        `);
        const previousAllProjectTickets = previousAllProjectTicketsResult.rows;

        // Get all team members across managed projects
        const allProjectTeamMembersResult = await db.execute<{
          user_id: string;
          role_id: string;
          project_id: string;
          id: string;
          name: string;
          email: string;
          project_name: string;
          role_name: string;
        }>(sql`
          SELECT 
            up.user_id, up.role_id, up.project_id,
            u.id, u.name, u.email,
            p.name as project_name,
            gr.name as role_name
          FROM user_project up
          INNER JOIN users u ON up.user_id = u.id
          INNER JOIN projects p ON up.project_id = p.id
          LEFT JOIN global_roles gr ON up.role_id = gr.id
          WHERE up.project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
        `);
        const allProjectTeamMembers = allProjectTeamMembersResult.rows;
        const allTeamMembersError = null;

        if (allTeamMembersError) {
          console.error('❌ Error fetching all team members:', allTeamMembersError);
        }
        
        console.log('👥 DASHBOARD METRICS (Admin) - All Team Members Query Result:', {
          projectIds,
          count: allProjectTeamMembers?.length || 0,
          members: allProjectTeamMembers,
          error: allTeamMembersError
        });

        // Get completed tickets across all projects (all time)
        const allCompletedTicketsResult = await db.execute<{
          id: string;
          status_name: string;
        }>(sql`
          SELECT t.id, s.name as status_name
          FROM tickets t
          INNER JOIN statuses s ON t.status_id = s.id
          WHERE t.project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
        `);
        const allCompletedTickets = allCompletedTicketsResult.rows;

        const completionRate = allProjectTickets?.length ? 
          ((allCompletedTickets?.filter((t: any) => t.status_name?.toLowerCase().includes('complete') || 
                                             t.status_name?.toLowerCase().includes('done')).length || 0) / 
           allProjectTickets.length * 100).toFixed(0) : 0;

        // Get recent activity across all managed projects with pagination
        const totalAllProjectTicketsResult = await db.execute<{ count: number }>(sql`
          SELECT COUNT(*) as count
          FROM tickets
          WHERE project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
        `);
        const totalAllProjectTickets = totalAllProjectTicketsResult.rows[0]?.count || 0;

        console.log('🔢 MANAGER ALL PROJECTS COUNT DEBUG:', { totalAllProjectTickets, projectIds, page, limit });
        
        const recentAllProjectTicketsResult = await db.execute<{
          id: string;
          title: string;
          created_at: string;
          status_id: string;
          project_id: string;
          created_by: string;
          assigned_to: string;
          creator_name: string;
          assignee_name: string;
          status_name: string;
          status_color: string;
          project_name: string;
        }>(sql`
          SELECT 
            t.id, t.title, t.created_at, t.status_id, t.project_id,
            t.created_by, t.assigned_to,
            creator.name as creator_name,
            assignee.name as assignee_name,
            s.name as status_name, s.color_code as status_color,
            p.name as project_name
          FROM tickets t
          LEFT JOIN users creator ON t.created_by = creator.id
          LEFT JOIN users assignee ON t.assigned_to = assignee.id
          LEFT JOIN statuses s ON t.status_id = s.id
          INNER JOIN projects p ON t.project_id = p.id
          WHERE t.project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          ORDER BY t.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `);
        const recentAllProjectTickets = recentAllProjectTicketsResult.rows;
        
        // Calculate pagination metadata for all projects
        const totalPages = Math.ceil((totalAllProjectTickets || 0) / limit);
        metrics.pagination = {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalAllProjectTickets || 0,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        };

        // Unique team members count (remove duplicates)
        const uniqueTeamMembers = allProjectTeamMembers ? 
          Array.from(new Set(allProjectTeamMembers.map((tm: any) => tm.user_id))) : [];

        metrics.overview = {
          totalTickets: {
            value: allProjectTickets?.length || 0, // Total tickets across all projects (all time)
            change: calculatePercentageChange(
              currentMonthAllTickets?.length || 0,    // Current month tickets
              previousAllProjectTickets?.length || 0  // Previous month tickets
            ),
            changeType: (currentMonthAllTickets?.length || 0) >= (previousAllProjectTickets?.length || 0) ? 'positive' : 'neutral'
          },
          activeProjects: {
            value: projectIds.length,
            change: '+0',
            changeType: 'neutral'
          },
          teamMembers: {
            value: uniqueTeamMembers.length,
            change: '+1',
            changeType: 'positive'
          },
          completionRate: {
            value: `${completionRate}%`,
            change: '+8%',
            changeType: 'positive'
          }
        };

        metrics.recentActivity = recentAllProjectTickets?.map((ticket: any) => ({
          id: ticket.id,
          title: ticket.title,
          status: ticket.status_name || 'Unknown',
          time: formatTimeAgo(ticket.created_at),
          assignedTo: ticket.assignee_name || 'Unassigned',
          createdBy: ticket.creator_name || 'Unknown',
          assigned_to: ticket.assignee_name || 'Unassigned',
          created_by: ticket.creator_name || 'Unknown',
          projectName: ticket.project_name || 'Unknown Project',
          priority: 'Normal'
        })) || [];

        // Add aggregated project data
        metrics.quickStats = {
          projectInfo: null, // No specific project when viewing all
          availableProjects: managedProjects?.map((mp: any) => ({
            id: mp.project_id,
            name: mp.project_name,
            role: mp.role_name
          })) || []
        };

        // Get ticket counts for each team member across all projects
        const allTeamMemberTicketCounts = allProjectTeamMembers ? await Promise.all(
          allProjectTeamMembers.map(async (member: any) => {
            const countResult = await db.execute<{ count: number }>(sql`
              SELECT COUNT(*) as count
              FROM tickets
              WHERE project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
              AND assigned_to = ${member.id}
            `);
            return { userId: member.id, ticketCount: countResult.rows[0]?.count || 0 };
          })
        ) : [];

        // Add aggregated team members data with ticket counts
        (metrics as any).teamMembers = allProjectTeamMembers?.map((member: any) => {
          const ticketCount = allTeamMemberTicketCounts.find((tc: any) => tc.userId === member.id)?.ticketCount || 0;
          return {
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role_name,
            projectId: member.project_id,
            projectName: member.project_name || 'Unknown Project',
            tickets: ticketCount,
            status: 'Active' // Default status
          };
        }) || [];
      } else {
        // No managed projects - empty state
        console.log('⚠️ MANAGER: No managed projects found');
        metrics.overview = {
          totalTickets: { value: 0, change: '0%', changeType: 'neutral' },
          activeProjects: { value: 0, change: '0', changeType: 'neutral' },
          teamMembers: { value: 0, change: '0', changeType: 'neutral' },
          completionRate: { value: '0%', change: '0%', changeType: 'neutral' }
        };
        metrics.recentActivity = [];
        metrics.pagination = {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
          hasNextPage: false,
          hasPreviousPage: false
        };
      }
    } else if (isMember) {
      // MEMBER METRICS - PROJECT-BASED SYSTEM
      // Show data from current project in JWT, or all assigned projects
      
      console.log('📊 MEMBER METRICS - Filtering strategy:', {
        hasProjectId: !!currentProjectId,
        projectId: currentProjectId,
        projectRole: projectRole
      });
      
      // Get projects where user is assigned as member
      let memberProjectsConditions = sql`
        SELECT 
          up.project_id, up.role_id,
          p.id as project_id, p.name as project_name, p.organization_id,
          pd.department_id,
          gr.name as role_name
        FROM user_project up
        INNER JOIN projects p ON up.project_id = p.id
        LEFT JOIN project_department pd ON p.id = pd.project_id
        LEFT JOIN global_roles gr ON up.role_id = gr.id
        WHERE up.user_id = ${userId}
        AND p.organization_id = ${organizationId}
        ORDER BY p.created_at ASC
      `;

      // PRIORITY 1: If JWT has current project, show only that project
      if (currentProjectId) {
        console.log('✅ Member: Filtering by current project from JWT');
        memberProjectsConditions = sql`
          SELECT 
            up.project_id, up.role_id,
            p.id as project_id, p.name as project_name, p.organization_id,
            pd.department_id,
            gr.name as role_name
          FROM user_project up
          INNER JOIN projects p ON up.project_id = p.id
          LEFT JOIN project_department pd ON p.id = pd.project_id
          LEFT JOIN global_roles gr ON up.role_id = gr.id
          WHERE up.user_id = ${userId}
          AND p.organization_id = ${organizationId}
          AND up.project_id = ${currentProjectId}
          ORDER BY p.created_at ASC
        `;
      }
      // PRIORITY 2: Department filter (fallback only if no project in JWT)
      else if (userDepartmentId) {
        console.log('✅ Member: Filtering by department (fallback)');
        memberProjectsConditions = sql`
          SELECT 
            up.project_id, up.role_id,
            p.id as project_id, p.name as project_name, p.organization_id,
            pd.department_id,
            gr.name as role_name
          FROM user_project up
          INNER JOIN projects p ON up.project_id = p.id
          LEFT JOIN project_department pd ON p.id = pd.project_id
          LEFT JOIN global_roles gr ON up.role_id = gr.id
          WHERE up.user_id = ${userId}
          AND p.organization_id = ${organizationId}
          AND pd.department_id = ${userDepartmentId}
          ORDER BY p.created_at ASC
        `;
      }

      const memberProjectsResult = await db.execute<{
        project_id: string;
        role_id: string;
        project_name: string;
        organization_id: string;
        department_id: string;
        role_name: string;
      }>(memberProjectsConditions);
      const memberProjects = memberProjectsResult.rows;
      const memberProjectsError = null;

      console.log('🔧 MEMBER PROJECTS QUERY:', { memberProjects, memberProjectsError, userId, organizationId });

      const projectIds = memberProjects?.map((mp: any) => mp.project_id) || [];
      console.log('🔧 MEMBER DEBUG: Assigned projects:', projectIds, 'Selected project:', projectId);

      // Determine project IDs to show: JWT project > query param > all assigned
      const filteredProjectIds = currentProjectId 
        ? [currentProjectId]
        : (projectId && projectId !== 'all' 
          ? projectIds.filter((id: any) => id === projectId)
          : projectIds);

      console.log('🔧 MEMBER DEBUG: Filtered project IDs:', filteredProjectIds);

      if (filteredProjectIds.length > 0) {
        // MEMBER-SPECIFIC METRICS - Only from assigned/filtered projects
        
        // Get tickets from assigned/filtered projects only
        console.log('🎯 MEMBER: Checking all tickets in projects:', filteredProjectIds);
        
      const memberTicketsResult = await db.execute<{
  id: string;
  created_at: string;
  status_id: string;
  priority_id: string;
}>(sql`
  SELECT id, created_at, status_id, priority_id
  FROM tickets
  WHERE project_id = ANY(ARRAY[${sql.join(filteredProjectIds.map((id: string) => sql`${id}::uuid`), sql`, `)}])
`);
        const memberTickets = memberTicketsResult.rows;
        const memberTicketsError = null;

        console.log('🎯 MEMBER: All tickets in projects result:', { memberTickets, memberTicketsError, count: memberTickets?.length });
        
        // Current month tickets from assigned/filtered projects
        const currentMonthMemberTicketsResult = await db.execute<{
          id: string;
          created_at: string;
          status_id: string;
          priority_id: string;
        }>(sql`
          SELECT id, created_at, status_id, priority_id
          FROM tickets
          WHERE project_id = ANY(ARRAY[${sql.join(filteredProjectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          AND created_at >= ${dateRanges.currentMonthStart}
        `);
        const currentMonthMemberTickets = currentMonthMemberTicketsResult.rows;

        // Previous month tickets for comparison
        const previousMemberTicketsResult = await db.execute<{ id: string }>(sql`
          SELECT id
          FROM tickets
          WHERE project_id = ANY(ARRAY[${sql.join(filteredProjectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          AND created_at >= ${dateRanges.previousMonthStart}
          AND created_at < ${dateRanges.currentMonthStart}
        `);
        const previousMemberTickets = previousMemberTicketsResult.rows;

        // My assigned tickets
        const myAssignedTicketsResult = await db.execute<{
          id: string;
          created_at: string;
          status_id: string;
          priority_id: string;
        }>(sql`
          SELECT id, created_at, status_id, priority_id
          FROM tickets
          WHERE project_id = ANY(ARRAY[${sql.join(filteredProjectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          AND assigned_to = ${userId}
        `);
        const myAssignedTickets = myAssignedTicketsResult.rows;

        // My created tickets  
        const myCreatedTicketsResult = await db.execute<{
          id: string;
          created_at: string;
          status_id: string;
          priority_id: string;
        }>(sql`
          SELECT id, created_at, status_id, priority_id
          FROM tickets
          WHERE project_id = ANY(ARRAY[${sql.join(filteredProjectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          AND created_by = ${userId}
        `);
        const myCreatedTickets = myCreatedTicketsResult.rows;

        // Recent tickets from my projects with details
        console.log('🎯 MEMBER: Querying tickets for projects:', filteredProjectIds, 'offset:', offset, 'limit:', limit);
        
        const recentMemberTicketsResult = await db.execute<{
          id: string;
          title: string;
          created_at: string;
          status_id: string;
          priority_id: string;
          assigned_to: string;
          created_by: string;
          project_name: string;
          creator_name: string;
          creator_email: string;
          assignee_name: string;
          assignee_email: string;
          status_name: string;
          status_color: string;
          priority_name: string;
          priority_color: string;
        }>(sql`
          SELECT 
            t.id, t.title, t.created_at, t.status_id, t.priority_id,
            t.assigned_to, t.created_by,
            p.name as project_name,
            creator.name as creator_name, creator.email as creator_email,
            assignee.name as assignee_name, assignee.email as assignee_email,
            s.name as status_name, s.color_code as status_color,
            pr.name as priority_name, pr.color_code as priority_color
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          LEFT JOIN users creator ON t.created_by = creator.id
          LEFT JOIN users assignee ON t.assigned_to = assignee.id
          LEFT JOIN statuses s ON t.status_id = s.id
          LEFT JOIN priorities pr ON t.priority_id = pr.id
          WHERE t.project_id = ANY(ARRAY[${sql.join(filteredProjectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          ORDER BY t.created_at DESC
          LIMIT ${limit}
        `);
        const recentMemberTickets = recentMemberTicketsResult.rows;
        const recentTicketsError = null;

        console.log('🎯 MEMBER: Recent tickets query result:', { recentMemberTickets, recentTicketsError });

        // Calculate completion rate for member's tickets
        const completedMemberTickets = myAssignedTickets?.filter((ticket: any) => {
          // Assuming status_id check - you might need to adjust based on your statuses
          return (ticket as any).statuses?.name === 'Completed' || (ticket as any).statuses?.name === 'Closed';
        }) || [];
        
        const completionRate = myAssignedTickets?.length ? 
          Math.round((completedMemberTickets.length / myAssignedTickets.length) * 100) : 0;

        // Build member overview
        metrics.overview = {
          myAssignedTickets: {
            value: myAssignedTickets?.length || 0,
            change: '0', // Could compare with previous period
            changeType: 'neutral'
          },
          myCreatedTickets: {
            value: myCreatedTickets?.length || 0,
            change: '0', // Could compare with previous period
            changeType: 'neutral'
          },
          projectsInvolved: {
            value: projectIds.length,
            change: '+0',
            changeType: 'neutral'
          },
          myCompletionRate: {
            value: `${completionRate}%`,
            change: '+0%', // Could be calculated based on previous period
            changeType: 'neutral'
          }
        };

        console.log('🎯 MEMBER: recentMemberTickets raw data:', recentMemberTickets);

        metrics.recentActivity = recentMemberTickets?.map((ticket: any) => ({
          id: ticket.id,
          title: ticket.title,
          status: ticket.status_name || 'Unknown',
          time: formatTimeAgo(ticket.created_at),
          project: ticket.project_name || 'Unknown Project',
          assignedTo: ticket.assignee_name || 'Unassigned',
          createdBy: ticket.creator_name || 'Unknown',
          assigned_to: ticket.assignee_name || 'Unassigned',
          created_by: ticket.creator_name || 'Unknown',
          priority: ticket.priority_name || 'Medium',
          priorityColor: ticket.priority_color || '#6B7280'
        })) || [];

        console.log('🎯 MEMBER: Formatted recentActivity:', metrics.recentActivity);

        // Add member-specific data
        metrics.quickStats = {
          memberInfo: {
            assignedProjects: memberProjects?.map((mp: any) => ({
              id: mp.project_id,
              name: mp.project_name,
              role: mp.role_name
            })) || [],
            totalProjectTickets: memberTickets?.length || 0,
            myTicketRatio: myAssignedTickets?.length ? 
              Math.round(((myAssignedTickets.length) / (memberTickets?.length || 1)) * 100) : 0
          }
        };

        // Pagination for member tickets
        const totalMemberTickets = memberTickets?.length || 0;
        const totalPages = Math.ceil(totalMemberTickets / limit);
        
        metrics.pagination = {
          currentPage: page,
          totalPages,
          totalItems: totalMemberTickets,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        };

      } else {
        // No assigned projects - empty state for member
        console.log('⚠️ MEMBER: No assigned projects found');
        metrics.overview = {
          myAssignedTickets: { value: 0, change: '0%', changeType: 'neutral' },
          myCreatedTickets: { value: 0, change: '0%', changeType: 'neutral' },
          projectsInvolved: { value: 0, change: '0', changeType: 'neutral' },
          myCompletionRate: { value: '0%', change: '0%', changeType: 'neutral' }
        };
        metrics.recentActivity = [];
        metrics.pagination = {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
          hasNextPage: false,
          hasPreviousPage: false
        };
      }
    } else {
      // Unauthorized role
      return NextResponse.json({ 
        error: "Access denied. User role not recognized" 
      }, { status: 403 });
    }

    // Chart data (simplified - could be more sophisticated)
    let weeklyTicketsConditions = sql`
      SELECT t.created_at
      FROM tickets t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = ${organizationId}
      AND t.created_at >= ${dateRanges.currentWeekStart}
      ORDER BY t.created_at
    `;
    
    // Filter by department if department admin
    if ((isDeptOnlyAdmin || departmentRole === 'Admin') && userDepartmentId && !currentProjectId && !projectId) {
      const deptProjectIdsResult = await db.execute<{ project_id: string }>(sql`
        SELECT project_id FROM project_department
        WHERE department_id = ${userDepartmentId}
      `);
      
      const projectIds = deptProjectIdsResult.rows.map((p: any) => p.project_id) || [];
      if (projectIds.length > 0) {
        weeklyTicketsConditions = sql`
          SELECT t.created_at
          FROM tickets t
          INNER JOIN projects p ON t.project_id = p.id
          WHERE p.organization_id = ${organizationId}
          AND t.project_id = ANY(ARRAY[${sql.join(projectIds.map((id: any) => sql`${id}::uuid`), sql`, `)}])
          AND t.created_at >= ${dateRanges.currentWeekStart}
          ORDER BY t.created_at
        `;
      } else {
        // Department admin with no projects - return empty
        weeklyTicketsConditions = sql`
          SELECT t.created_at
          FROM tickets t
          WHERE t.project_id = '00000000-0000-0000-0000-000000000000'
          AND t.created_at >= ${dateRanges.currentWeekStart}
          ORDER BY t.created_at
        `;
      }
    }
    
    const weeklyTicketsResult = await db.execute<{
      created_at: string;
    }>(weeklyTicketsConditions);
    const weeklyTickets = weeklyTicketsResult.rows;

    // Group by day for chart
    const chartData = weeklyTickets?.reduce((acc: any, ticket: any) => {
      const day = new Date(ticket.created_at).toLocaleDateString('en-US', { weekday: 'short' });
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {}) || {};

    metrics.chartData = {
      weekly: Object.entries(chartData).map(([day, count]) => ({ 
        day, 
        tickets: Number(count) 
      }))
    };

    return NextResponse.json({
      success: true,
      data: metrics,
      userRole: actualUserRole.toLowerCase(),
      organizationId
    }, { status: 200 });

  } catch (error) {
    console.error("Dashboard metrics error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Helper function to format time ago
function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
}
