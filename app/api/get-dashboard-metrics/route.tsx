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
    const userRoles = tokenData.roles || [];
    const isAdmin = userRoles.includes('Admin');
    const isManager = userRoles.includes('Manager') || userRoles.includes('Team Lead');

    if (!isAdmin && !isManager) {
      return NextResponse.json({ 
        error: "Access denied. Only Admin, Manager, or Team Lead can access metrics" 
      }, { status: 403 });
    }

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
          .from('user_organization')
          .select('user_id, users!inner(id, name, email, created_at)')
          .eq('organization_id', organizationId);

        previousMembersQuery = supabase
          .from('user_organization')
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
      // MANAGER METRICS - Project-specific data
      
      // Get projects managed by this user
      const { data: managedProjects } = await supabase
        .from('user_project')
        .select(`
          project_id, role_id,
          projects!inner(id, name, organization_id),
          roles!inner(name)
        `)
        .eq('user_id', tokenData.sub)
        .eq('projects.organization_id', organizationId);

      const projectIds = managedProjects?.map(mp => mp.project_id) || [];
      const targetProjectId = projectId || (projectIds.length > 0 ? projectIds[0] : null);

      if (targetProjectId) {
        // Project Tickets
        const { data: projectTickets } = await supabase
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
            roles(name)
          `)
          .eq('project_id', targetProjectId);

        // Completion Rate (tickets with 'completed' status)
        const { data: completedTickets } = await supabase
          .from('tickets')
          .select('id, statuses!inner(name)')
          .eq('project_id', targetProjectId)
          .gte('created_at', dateRanges.currentMonthStart);

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
            value: projectTickets?.length || 0,
            change: calculatePercentageChange(
              projectTickets?.length || 0,
              previousProjectTickets?.length || 0
            ),
            changeType: (projectTickets?.length || 0) >= (previousProjectTickets?.length || 0) ? 'positive' : 'neutral'
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
            role: (mp as any).roles?.name
          })) || []
        };
      }
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