import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

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
    const statusId = searchParams.get('status_id');
    const priorityId = searchParams.get('priority_id');
    const metricType = searchParams.get('type') || 'overview'; // overview, project, team
    const testMode = searchParams.get('test') === 'true'; // Test mode bypass
    
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
    
    // Get user's organization role using global roles system
    const { data: userOrgRole, error: orgRoleError } = await supabase
      .from('user_organization_roles')
      .select(`
        role_id,
        global_roles!user_organization_roles_role_id_fkey(name)
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    // Check if user has department roles
    const { data: userDeptRoles } = await supabase
      .from('user_department_roles')
      .select(`
        role_id,
        department_id,
        global_roles(name)
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    // Get user's primary department
    const { data: userData } = await supabase
      .from('users')
      .select('department_id')
      .eq('id', userId)
      .maybeSingle();

    const userDepartmentId = userData?.department_id;

    // Prioritize JWT role (project-specific) over global org role
    let actualUserRole = tokenData.role || 'Member';
    
    // Only use global org role as fallback if no JWT role is provided
    if (!tokenData.role && userOrgRole && userOrgRole.global_roles) {
      actualUserRole = (userOrgRole.global_roles as any).name;
    } else if (!tokenData.role && !userOrgRole && userDeptRoles && userDeptRoles.length > 0) {
      actualUserRole = (userDeptRoles[0].global_roles as any)?.name || 'Member';
    }

    // Check if user is dept-only admin
    const isDeptOnlyAdmin = !userOrgRole && userDeptRoles && userDeptRoles.length > 0;

    const isAdmin = actualUserRole === 'Admin';
    const isManager = actualUserRole === 'Manager';
    const isMember = actualUserRole === 'Member' || actualUserRole === 'Viewer';

    console.log('🔧 Dashboard metrics - JWT role:', tokenData.role);
    console.log('🔧 Dashboard metrics - Global org role:', userOrgRole?.global_roles ? (userOrgRole.global_roles as any).name : 'none');
    console.log('🔧 Dashboard metrics - Final role:', actualUserRole);

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
      // ADMIN METRICS - Organization-wide data or project-specific if filtered
      
      // Build ticket queries with optional project filter
      let currentTicketsQuery = supabase
        .from('tickets')
        .select('id, created_at, status_id, priority_id, projects!inner(organization_id)')
        .eq('projects.organization_id', organizationId)
        .gte('created_at', dateRanges.currentMonthStart);

      let previousTicketsQuery = supabase
        .from('tickets')
        .select('id, projects!inner(organization_id)')
        .eq('projects.organization_id', organizationId)
        .gte('created_at', dateRanges.previousMonthStart)
        .lt('created_at', dateRanges.currentMonthStart);

      // Apply project filter if specified
      if (projectId) {
        currentTicketsQuery = currentTicketsQuery.eq('project_id', projectId);
        previousTicketsQuery = previousTicketsQuery.eq('project_id', projectId);
      }

      const { data: currentTickets } = await currentTicketsQuery;
      const { data: previousTickets } = await previousTicketsQuery;

      // Active Projects
      let activeProjectsQuery = supabase
        .from('projects')
        .select('id, name, created_at')
        .eq('organization_id', organizationId);
      
      // Department-level admin: filter by department
      if (isDeptOnlyAdmin && userDepartmentId) {
        // Get projects owned by department OR shared with department
        const { data: ownedProjectIds } = await supabase
          .from('project_department')
          .select('project_id')
          .eq('department_id', userDepartmentId);
        
        const { data: sharedProjectIds } = await supabase
          .from('shared_projects')
          .select('project_id')
          .eq('department_id', userDepartmentId);
        
        const projectIds = [
          ...(ownedProjectIds?.map(p => p.project_id) || []),
          ...(sharedProjectIds?.map(p => p.project_id) || [])
        ];
        
        if (projectIds.length > 0) {
          activeProjectsQuery = activeProjectsQuery.in('id', projectIds);
        } else {
          // No projects for this department
          activeProjectsQuery = activeProjectsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
      
      // If project filter is applied, get only that specific project
      if (projectId) {
        activeProjectsQuery = activeProjectsQuery.eq('id', projectId);
      }

      const { data: activeProjects } = await activeProjectsQuery;

      // Team Members
      let currentMembersQuery, previousMembersQuery;
      
      if (projectId) {
        // If project filter is applied, get only members of that project
        currentMembersQuery = supabase
          .from('user_project')
          .select('user_id, users!inner(id, name, email, created_at)')
          .eq('project_id', projectId);

        previousMembersQuery = supabase
          .from('user_project')
          .select('user_id, users!inner(created_at)')
          .eq('project_id', projectId)
          .lt('users.created_at', dateRanges.currentMonthStart);
      } else {
        // Organization-wide members
        currentMembersQuery = supabase
          .from('user_organization_roles')
          .select('user_id, users!inner(id, name, email, created_at)')
          .eq('organization_id', organizationId);

        previousMembersQuery = supabase
          .from('user_organization_roles')
          .select('user_id, users!inner(created_at)')
          .eq('organization_id', organizationId)
          .lt('users.created_at', dateRanges.currentMonthStart);
      }

      const { data: currentMembers } = await currentMembersQuery;
      const { data: previousMembers } = await previousMembersQuery;

      // Average Resolution Time (simplified calculation)
      let resolvedTicketsQuery = supabase
        .from('tickets')
        .select('created_at, updated_at, projects!inner(organization_id)')
        .eq('projects.organization_id', organizationId)
        .gte('created_at', dateRanges.currentMonthStart)
        .not('updated_at', 'is', null);
      
      // Apply project filter if specified
      if (projectId) {
        resolvedTicketsQuery = resolvedTicketsQuery.eq('project_id', projectId);
      }

      const { data: resolvedTickets } = await resolvedTicketsQuery;

      // Calculate average resolution time
      let avgResolutionHours = 0;
      if (resolvedTickets && resolvedTickets.length > 0) {
        const totalHours = resolvedTickets.reduce((sum, ticket) => {
          const created = new Date(ticket.created_at).getTime();
          const updated = new Date(ticket.updated_at).getTime();
          return sum + ((updated - created) / (1000 * 60 * 60)); // Convert to hours
        }, 0);
        avgResolutionHours = totalHours / resolvedTickets.length;
      }

      // Recent Activity - First get total count for pagination
      let countQuery = supabase
        .from('tickets')
        .select('*, projects!inner(*)', { count: 'exact', head: true })
        .eq('projects.organization_id', organizationId);
      
      if (projectId) {
        countQuery = countQuery.eq('project_id', projectId);
      }
      if (statusId) {
        countQuery = countQuery.eq('status_id', statusId);
      }
      if (priorityId) {
        countQuery = countQuery.eq('priority_id', priorityId);
      }
      
      const { count: totalTickets } = await countQuery;
      console.log('🔢 COUNT DEBUG:', { totalTickets, page, limit, offset, organizationId });
      
      // Then get paginated results
      let recentTicketsQuery = supabase
        .from('tickets')
        .select(`
          id, title, created_at, status_id, priority_id, 
          created_by, assigned_to,
          projects!inner(name, organization_id),
          creator:users!tickets_created_by_fkey(name),
          assignee:users!tickets_assigned_to_fkey(name),
          statuses!tickets_status_id_fkey(name, color_code)
        `)
        .eq('projects.organization_id', organizationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      // Apply filters if specified
      if (projectId) {
        recentTicketsQuery = recentTicketsQuery.eq('project_id', projectId);
      }
      if (statusId) {
        recentTicketsQuery = recentTicketsQuery.eq('status_id', statusId);
      }
      if (priorityId) {
        recentTicketsQuery = recentTicketsQuery.eq('priority_id', priorityId);
      }

      const { data: recentTickets } = await recentTicketsQuery;
      
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
          value: currentMembers?.length || 0,
          change: calculatePercentageChange(
            currentMembers?.length || 0,
            previousMembers?.length || 0
          ),
          changeType: (currentMembers?.length || 0) >= (previousMembers?.length || 0) ? 'positive' : 'negative'
        },
        avgResolutionTime: {
          value: `${avgResolutionHours.toFixed(1)}h`,
          change: '-15%', // Simplified - could be calculated based on previous period
          changeType: 'positive' // Lower resolution time is better
        }
      };

      // Add shared projects count for department admins
      if (isDeptOnlyAdmin && userDepartmentId) {
        const { data: sharedProjectsData } = await supabase
          .from('shared_projects')
          .select('project_id', { count: 'exact' })
          .eq('department_id', userDepartmentId);

        metrics.overview.sharedProjects = {
          value: sharedProjectsData?.length || 0,
          change: '0%',
          changeType: 'neutral' as const
        };

        // Get pending requests count
        const { data: pendingRequests } = await supabase
          .from('resource_requests')
          .select('id', { count: 'exact' })
          .eq('user_department_id', userDepartmentId)
          .eq('status', 'pending');

        metrics.overview.pendingRequests = {
          value: pendingRequests?.length || 0,
          change: '0%',
          changeType: 'neutral' as const
        };
      }

      metrics.recentActivity = recentTickets?.map(ticket => ({
        id: ticket.id,
        title: ticket.title,
        status: (ticket as any).statuses?.name || 'Unknown',
        time: formatTimeAgo(ticket.created_at),
        project: (ticket as any).projects?.name || 'Unknown Project',
        priority: ticket.priority_id ? 'High' : 'Normal', // Simplified
        assignedTo: (ticket as any).assignee?.name || 'Unassigned',
        createdBy: (ticket as any).creator?.name || 'Unknown',
        assigned_to: (ticket as any).assignee?.name || 'Unassigned', // Alternative field name
        created_by: (ticket as any).creator?.name || 'Unknown' // Alternative field name
      })) || [];

    } else if (isManager) {
      // MANAGER METRICS - Project-specific data or aggregated across all managed projects
      
      // Get projects managed by this user
      const { data: managedProjects, error: managedProjectsError } = await supabase
        .from('user_project')
        .select(`
          project_id, role_id,
          projects!inner(id, name, organization_id),
          global_roles!user_project_role_id_fkey(name)
        `)
        .eq('user_id', tokenData.sub)
        .eq('projects.organization_id', organizationId);

      console.log('🔧 MANAGER PROJECTS QUERY:', { managedProjects, managedProjectsError, userId: tokenData.sub, organizationId });

      const projectIds = managedProjects?.map(mp => mp.project_id) || [];
      console.log('🔧 MANAGER DEBUG: Managed projects:', projectIds, 'Selected project:', projectId);

      if (projectId && projectId !== 'all') {
        // SPECIFIC PROJECT METRICS
        const targetProjectId = projectId;
        // Project Tickets - Get all tickets for the project (not filtered by date for total count)
        const { data: projectTickets } = await supabase
          .from('tickets')
          .select('id, created_at, status_id, priority_id')
          .eq('project_id', targetProjectId);
        
        // Project Tickets for current month (for comparison metrics)
        const { data: currentMonthTickets } = await supabase
          .from('tickets')
          .select('id, created_at, status_id, priority_id')
          .eq('project_id', targetProjectId)
          .gte('created_at', dateRanges.currentMonthStart);

        const { data: previousProjectTickets } = await supabase
          .from('tickets')
          .select('id')
          .eq('project_id', targetProjectId)
          .gte('created_at', dateRanges.previousMonthStart)
          .lt('created_at', dateRanges.currentMonthStart);

        // Team Members in Project
        const { data: projectTeamMembers } = await supabase
          .from('user_project')
          .select(`
            user_id, role_id,
            users!inner(id, name, email),
            global_roles!user_project_role_id_fkey(name)
          `)
          .eq('project_id', targetProjectId);

        // Completion Rate (tickets with 'completed' status) - for all project tickets
        const { data: completedTickets } = await supabase
          .from('tickets')
          .select('id, statuses!inner(name)')
          .eq('project_id', targetProjectId);

        const completionRate = projectTickets?.length ? 
          ((completedTickets?.filter(t => (t as any).statuses?.name?.toLowerCase().includes('complete') || 
                                            (t as any).statuses?.name?.toLowerCase().includes('done')).length || 0) / 
           projectTickets.length * 100).toFixed(0) : 0;

        // Recent Project Activity - First get count for pagination
        const { count: totalProjectTickets } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', targetProjectId);
        console.log('🔢 MANAGER COUNT DEBUG:', { totalProjectTickets, targetProjectId, page, limit });
        
        // Then get paginated results
        const { data: recentProjectTickets } = await supabase
          .from('tickets')
          .select(`
            id, title, created_at, status_id, 
            created_by, assigned_to,
            creator:users!tickets_created_by_fkey(name),
            assignee:users!tickets_assigned_to_fkey(name),
            statuses!tickets_status_id_fkey(name, color_code)
          `)
          .eq('project_id', targetProjectId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
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

        metrics.recentActivity = recentProjectTickets?.map(ticket => ({
          id: ticket.id,
          title: ticket.title,
          status: (ticket as any).statuses?.name || 'Unknown',
          time: formatTimeAgo(ticket.created_at),
          assignedTo: (ticket as any).assignee?.name || 'Unassigned',
          createdBy: (ticket as any).creator?.name || 'Unknown',
          assigned_to: (ticket as any).assignee?.name || 'Unassigned', // Alternative field name
          created_by: (ticket as any).creator?.name || 'Unknown', // Alternative field name
          priority: 'Normal' // Simplified
        })) || [];

        // Add project-specific data
        metrics.quickStats = {
          projectInfo: managedProjects?.find(mp => mp.project_id === targetProjectId),
          availableProjects: managedProjects?.map(mp => ({
            id: mp.project_id,
            name: (mp as any).projects?.name,
            role: (mp as any).global_roles?.name
          })) || []
        };

        // Get ticket counts for each team member
        const teamMemberTicketCounts = projectTeamMembers ? await Promise.all(
          projectTeamMembers.map(async (member) => {
            const { count } = await supabase
              .from('tickets')
              .select('id', { count: 'exact', head: true })
              .eq('project_id', targetProjectId)
              .eq('assigned_to', (member as any).users?.id);
            return { userId: (member as any).users?.id, ticketCount: count || 0 };
          })
        ) : [];

        // Add team members data with ticket counts
        (metrics as any).teamMembers = projectTeamMembers?.map(member => {
          const ticketCount = teamMemberTicketCounts.find(tc => tc.userId === (member as any).users?.id)?.ticketCount || 0;
          return {
            id: (member as any).users?.id,
            name: (member as any).users?.name,
            email: (member as any).users?.email,
            role: (member as any).global_roles?.name,
            tickets: ticketCount,
            status: 'Active' // Default status
          };
        }) || [];
      } else if (projectIds.length > 0) {
        // ALL PROJECTS METRICS FOR MANAGER - Aggregate across all managed projects
        console.log('🔧 MANAGER ALL PROJECTS: Aggregating metrics for projects:', projectIds);

        // Get all tickets from managed projects (all time for total count)
        const { data: allProjectTickets } = await supabase
          .from('tickets')
          .select('id, created_at, status_id, priority_id, project_id')
          .in('project_id', projectIds);
        
        // Get current month tickets for comparison metrics
        const { data: currentMonthAllTickets } = await supabase
          .from('tickets')
          .select('id, created_at, status_id, priority_id, project_id')
          .in('project_id', projectIds)
          .gte('created_at', dateRanges.currentMonthStart);

        const { data: previousAllProjectTickets } = await supabase
          .from('tickets')
          .select('id')
          .in('project_id', projectIds)
          .gte('created_at', dateRanges.previousMonthStart)
          .lt('created_at', dateRanges.currentMonthStart);

        // Get all team members across managed projects
        const { data: allProjectTeamMembers } = await supabase
          .from('user_project')
          .select(`
            user_id, role_id, project_id,
            users!inner(id, name, email),
            projects!inner(id, name),
            global_roles!user_project_role_id_fkey(name)
          `)
          .in('project_id', projectIds);

        // Get completed tickets across all projects (all time)
        const { data: allCompletedTickets } = await supabase
          .from('tickets')
          .select('id, statuses!inner(name)')
          .in('project_id', projectIds);

        const completionRate = allProjectTickets?.length ? 
          ((allCompletedTickets?.filter(t => (t as any).statuses?.name?.toLowerCase().includes('complete') || 
                                             (t as any).statuses?.name?.toLowerCase().includes('done')).length || 0) / 
           allProjectTickets.length * 100).toFixed(0) : 0;

        // Get recent activity across all managed projects with pagination
        const { count: totalAllProjectTickets } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds);

        console.log('🔢 MANAGER ALL PROJECTS COUNT DEBUG:', { totalAllProjectTickets, projectIds, page, limit });
        
        const { data: recentAllProjectTickets } = await supabase
          .from('tickets')
          .select(`
            id, title, created_at, status_id, project_id,
            created_by, assigned_to,
            creator:users!tickets_created_by_fkey(name),
            assignee:users!tickets_assigned_to_fkey(name),
            statuses!tickets_status_id_fkey(name, color_code),
            projects!inner(name)
          `)
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
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
          Array.from(new Set(allProjectTeamMembers.map(tm => tm.user_id))) : [];

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

        metrics.recentActivity = recentAllProjectTickets?.map(ticket => ({
          id: ticket.id,
          title: ticket.title,
          status: (ticket as any).statuses?.name || 'Unknown',
          time: formatTimeAgo(ticket.created_at),
          assignedTo: (ticket as any).assignee?.name || 'Unassigned',
          createdBy: (ticket as any).creator?.name || 'Unknown',
          assigned_to: (ticket as any).assignee?.name || 'Unassigned',
          created_by: (ticket as any).creator?.name || 'Unknown',
          projectName: (ticket as any).projects?.name || 'Unknown Project',
          priority: 'Normal'
        })) || [];

        // Add aggregated project data
        metrics.quickStats = {
          projectInfo: null, // No specific project when viewing all
          availableProjects: managedProjects?.map(mp => ({
            id: mp.project_id,
            name: (mp as any).projects?.name,
            role: (mp as any).global_roles?.name
          })) || []
        };

        // Get ticket counts for each team member across all projects
        const allTeamMemberTicketCounts = allProjectTeamMembers ? await Promise.all(
          allProjectTeamMembers.map(async (member) => {
            const { count } = await supabase
              .from('tickets')
              .select('id', { count: 'exact', head: true })
              .in('project_id', projectIds)
              .eq('assigned_to', (member as any).users?.id);
            return { userId: (member as any).users?.id, ticketCount: count || 0 };
          })
        ) : [];

        // Add aggregated team members data with ticket counts
        (metrics as any).teamMembers = allProjectTeamMembers?.map(member => {
          const ticketCount = allTeamMemberTicketCounts.find(tc => tc.userId === (member as any).users?.id)?.ticketCount || 0;
          return {
            id: (member as any).users?.id,
            name: (member as any).users?.name,
            email: (member as any).users?.email,
            role: (member as any).global_roles?.name,
            projectId: member.project_id,
            projectName: (member as any).projects?.name || 'Unknown Project',
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
      // MEMBER METRICS - Only show data from projects where member is assigned
      
      // Get projects where user is assigned as member
      const { data: memberProjects, error: memberProjectsError } = await supabase
        .from('user_project')
        .select(`
          project_id, role_id,
          projects!inner(id, name, organization_id),
          global_roles!user_project_role_id_fkey(name)
        `)
        .eq('user_id', userId)
        .eq('projects.organization_id', organizationId);

      console.log('🔧 MEMBER PROJECTS QUERY:', { memberProjects, memberProjectsError, userId, organizationId });

      const projectIds = memberProjects?.map(mp => mp.project_id) || [];
      console.log('🔧 MEMBER DEBUG: Assigned projects:', projectIds, 'Selected project:', projectId);

      // Apply project filtering if specific project selected
      const filteredProjectIds = projectId && projectId !== 'all' 
        ? projectIds.filter(id => id === projectId)
        : projectIds;

      console.log('🔧 MEMBER DEBUG: Filtered project IDs:', filteredProjectIds);

      if (filteredProjectIds.length > 0) {
        // MEMBER-SPECIFIC METRICS - Only from assigned/filtered projects
        
        // Get tickets from assigned/filtered projects only
        console.log('🎯 MEMBER: Checking all tickets in projects:', filteredProjectIds);
        
        const { data: memberTickets, error: memberTicketsError } = await supabase
          .from('tickets')
          .select('id, created_at, status_id, priority_id')
          .in('project_id', filteredProjectIds);

        console.log('🎯 MEMBER: All tickets in projects result:', { memberTickets, memberTicketsError, count: memberTickets?.length });
        
        // Current month tickets from assigned/filtered projects
        const { data: currentMonthMemberTickets } = await supabase
          .from('tickets')
          .select('id, created_at, status_id, priority_id')
          .in('project_id', filteredProjectIds)
          .gte('created_at', dateRanges.currentMonthStart);

        // Previous month tickets for comparison
        const { data: previousMemberTickets } = await supabase
          .from('tickets')
          .select('id')
          .in('project_id', filteredProjectIds)
          .gte('created_at', dateRanges.previousMonthStart)
          .lt('created_at', dateRanges.currentMonthStart);

        // My assigned tickets
        const { data: myAssignedTickets } = await supabase
          .from('tickets')
          .select('id, created_at, status_id, priority_id')
          .in('project_id', filteredProjectIds)
          .eq('assigned_to', userId);

        // My created tickets  
        const { data: myCreatedTickets } = await supabase
          .from('tickets')
          .select('id, created_at, status_id, priority_id')
          .in('project_id', filteredProjectIds)
          .eq('created_by', userId);

        // Recent tickets from my projects with details
        console.log('🎯 MEMBER: Querying tickets for projects:', filteredProjectIds, 'offset:', offset, 'limit:', limit);
        
        const { data: recentMemberTickets, error: recentTicketsError } = await supabase
          .from('tickets')
          .select(`
            id, title, created_at, status_id, priority_id, assigned_to, created_by,
            projects(name),
            creator:users!tickets_created_by_fkey(name, email),
            assignee:users!tickets_assigned_to_fkey(name, email),
            statuses!tickets_status_id_fkey(name, color_code)
          `)
          .in('project_id', filteredProjectIds)
          .order('created_at', { ascending: false })
          .limit(limit);

        console.log('🎯 MEMBER: Recent tickets query result:', { recentMemberTickets, recentTicketsError });

        // Calculate completion rate for member's tickets
        const completedMemberTickets = myAssignedTickets?.filter(ticket => {
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

        metrics.recentActivity = recentMemberTickets?.map(ticket => ({
          id: ticket.id,
          title: ticket.title,
          status: (ticket as any).statuses?.name || 'Unknown',
          time: formatTimeAgo(ticket.created_at),
          project: (ticket as any).projects?.name || 'Unknown Project',
          assignedTo: (ticket as any).assignee?.name || 'Unassigned',
          createdBy: (ticket as any).creator?.name || 'Unknown',
          assigned_to: (ticket as any).assignee?.name || 'Unassigned',
          created_by: (ticket as any).creator?.name || 'Unknown',
          priority: 'Normal' // Simplified
        })) || [];

        console.log('🎯 MEMBER: Formatted recentActivity:', metrics.recentActivity);

        // Add member-specific data
        metrics.quickStats = {
          memberInfo: {
            assignedProjects: memberProjects?.map(mp => ({
              id: mp.project_id,
              name: (mp as any).projects?.name,
              role: (mp as any).global_roles?.name
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
    const { data: weeklyTickets } = await supabase
      .from('tickets')
      .select('created_at, projects!inner(organization_id)')
      .eq('projects.organization_id', organizationId)
      .gte('created_at', dateRanges.currentWeekStart)
      .order('created_at');

    // Group by day for chart
    const chartData = weeklyTickets?.reduce((acc: any, ticket) => {
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
      userRole: isAdmin ? 'admin' : 'manager',
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
