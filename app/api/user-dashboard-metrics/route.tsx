import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from "@/app/db/connections";

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
    const userRole = decoded.role;
    const organization_id = decoded.org_id; // Use 'org_id' from JWT token
    
    console.log('🔧 User Dashboard Metrics - User role:', userRole);
    console.log('🔧 User Dashboard Metrics - userId:', userId);
    console.log('🔧 User Dashboard Metrics - organization_id:', organization_id);

    // Allow Members and Managers to access this endpoint
    const normalizedRole = userRole?.toLowerCase();
    if (!normalizedRole || (normalizedRole !== 'member' && normalizedRole !== 'manager')) {
      console.log('🔧 REJECTED: Role not allowed:', userRole, 'normalized:', normalizedRole);
      return NextResponse.json({ 
        success: false, 
        error: 'Access denied. This endpoint is only for Members and Managers.' 
      }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const project_id = searchParams.get('project_id');
    const offset = (page - 1) * limit;

    console.log('🔧 MEMBER: Query params - page:', page, 'limit:', limit, 'project_id:', project_id);

    // Get member's assigned projects
    const { data: memberProjects, error: memberProjectsError } = await supabase
      .from('user_project')
      .select(`
        project_id,
        role_id,
        projects!inner(id, name, description),
        global_roles!user_project_global_role_id_fkey(id, name)
      `)
      .eq('user_id', userId)
      .eq('projects.organization_id', organization_id);

    if (memberProjectsError) {
      console.error('❌ MEMBER: Error fetching member projects:', memberProjectsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch projects' }, { status: 500 });
    }

    console.log('🔧 MEMBER PROJECTS:', { memberProjects, userId, organizationId: organization_id });

    const assignedProjectIds = memberProjects.map((mp: any) => mp.project_id);
    
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

    // Get tickets assigned to this member in their projects
    const { data: memberTickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        id,
        title,
        description,
        status_id,
        priority_id,
        created_by,
        assigned_to,
        project_id,
        created_at,
        updated_at,
        projects!inner(id, name),
        creator:users!created_by(id, name, email),
        assignee:users!assigned_to(id, name, email),
        statuses!tickets_status_id_fkey(id, name, color_code)
      `)
      .in('project_id', targetProjectIds)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ticketsError) {
      console.error('❌ MEMBER: Error fetching tickets:', ticketsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch tickets' }, { status: 500 });
    }

    console.log('🔧 MEMBER: Retrieved tickets:', memberTickets?.length || 0);

    // Fetch priorities separately and attach to tickets
    if (memberTickets && memberTickets.length > 0) {
      // Try priorities table first, then fall back to statuses table with type='priority'
      let { data: priorities } = await supabase
        .from('priorities')
        .select('id, name, color_code')
        .eq('organization_id', organization_id);

      // If no priorities found, try statuses table with type='priority'
      if (!priorities || priorities.length === 0) {
        const { data: priorityStatuses } = await supabase
          .from('statuses')
          .select('id, name, color_code')
          .eq('type', 'priority')
          .eq('organization_id', organization_id);
        priorities = priorityStatuses;
      }

      // Attach priorities to tickets
      if (priorities && priorities.length > 0) {
        memberTickets.forEach(ticket => {
          const priority = priorities.find(p => p.id === ticket.priority_id);
          if (priority) {
            (ticket as any).priorities = priority;
          }
        });
      }
    }

    // Get total count for pagination (tickets assigned to or created by user)
    const { count: totalAccessibleTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('project_id', targetProjectIds)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`);

    // Get created tickets count
    const { count: totalCreatedTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('project_id', targetProjectIds)
      .eq('created_by', userId);

    // Get in-progress tickets count (assuming status names like 'In Progress', 'Working', etc.)
    const { data: inProgressStatuses } = await supabase
      .from('statuses')
      .select('id')
      .ilike('name', '%progress%')
      .eq('type', 'ticket');

    const inProgressStatusIds = inProgressStatuses?.map(s => s.id) || [];
    const { count: inProgressCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('project_id', targetProjectIds)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .in('status_id', inProgressStatusIds);

    // Get completed tickets count (assuming status names like 'Completed', 'Done', 'Closed')
    const { data: completedStatuses } = await supabase
      .from('statuses')
      .select('id')
      .or('name.ilike.%complete%,name.ilike.%done%,name.ilike.%closed%,name.ilike.%resolved%')
      .eq('type', 'ticket');

    const completedStatusIds = completedStatuses?.map(s => s.id) || [];
    const { count: completedCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('project_id', targetProjectIds)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .in('status_id', completedStatusIds);

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