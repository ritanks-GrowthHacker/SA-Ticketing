import { NextRequest, NextResponse } from 'next/server';
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
    const userRole = tokenData.roles?.[0] || 'user'; // Get first role or default to 'user'

    // Extract query parameters
    const query = searchParams.get('q') || '';
    const statusFilter = searchParams.get('status');
    const priorityFilter = searchParams.get('priority');
    const projectFilter = searchParams.get('project');
    const roleFilter = searchParams.get('role'); // For users with multiple roles
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;



    // Build base query with RBAC
    let ticketsQuery = supabase
      .from('tickets')
      .select(`
        id, title, description, created_at, updated_at, 
        status_id, priority_id, created_by, assigned_to, project_id,
        projects!inner(name, organization_id),
        creator:users!tickets_created_by_fkey(name, email),
        assignee:users!tickets_assigned_to_fkey(name, email),
        statuses!tickets_status_id_fkey(name, color_code)
      `)
      .eq('projects.organization_id', organizationId);

    // Apply RBAC filtering
    if (userRole === 'user' || userRole === 'manager') {
      // Get user's project assignments with roles for count query
      const { data: userProjects } = await supabase
        .from('project_user_relations')
        .select('project_id, role')
        .eq('user_id', userId);

      if (!userProjects || userProjects.length === 0) {
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

      const projectIds = userProjects.map(p => p.project_id);
      
      // Filter by role if specified
      if (roleFilter) {
        const filteredProjects = userProjects
          .filter(p => p.role === roleFilter)
          .map(p => p.project_id);
        ticketsQuery = ticketsQuery.in('project_id', filteredProjects);
      } else {
        ticketsQuery = ticketsQuery.in('project_id', projectIds);
      }
    }

    // Apply search query
    if (query) {
      ticketsQuery = ticketsQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }

    // Apply filters
    if (statusFilter && statusFilter !== 'all') {
      ticketsQuery = ticketsQuery.eq('status_id', statusFilter);
    }

    if (priorityFilter && priorityFilter !== 'all') {
      ticketsQuery = ticketsQuery.eq('priority_id', priorityFilter);
    }

    if (projectFilter && projectFilter !== 'all') {
      ticketsQuery = ticketsQuery.eq('project_id', projectFilter);
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('tickets')
      .select('*, projects!inner(organization_id)', { count: 'exact', head: true })
      .eq('projects.organization_id', organizationId);

    // Apply same RBAC to count query
    if (userRole === 'user' || userRole === 'manager') {
      const { data: userProjects } = await supabase
        .from('project_user_relations')
        .select('project_id, role')
        .eq('user_id', userId);

      if (userProjects && userProjects.length > 0) {
        const projectIds = roleFilter 
          ? userProjects.filter(p => p.role === roleFilter).map(p => p.project_id)
          : userProjects.map(p => p.project_id);
        countQuery = countQuery.in('project_id', projectIds);
      }
    }

    // Apply same filters to count query
    if (query) {
      countQuery = countQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }
    if (statusFilter && statusFilter !== 'all') {
      countQuery = countQuery.eq('status_id', statusFilter);
    }
    if (priorityFilter && priorityFilter !== 'all') {
      countQuery = countQuery.eq('priority_id', priorityFilter);
    }
    if (projectFilter && projectFilter !== 'all') {
      countQuery = countQuery.eq('project_id', projectFilter);
    }

    // Execute count query
    const { count: totalCount } = await countQuery;

    // Execute main query with pagination
    const { data: tickets, error } = await ticketsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching tickets:', error);
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }

    // Manually fetch priorities and add to tickets
    if (tickets && tickets.length > 0) {
      const priorityIds = [...new Set(tickets.map(t => t.priority_id).filter(Boolean))];
      
      if (priorityIds.length > 0) {
        // Try priorities table first, then fall back to statuses table with type='priority'
        let { data: priorities } = await supabase
          .from('priorities')
          .select('id, name, color_code')
          .in('id', priorityIds);

        // If no priorities found, try statuses table with type='priority'
        if (!priorities || priorities.length === 0) {
          const { data: priorityStatuses } = await supabase
            .from('statuses')
            .select('id, name, color_code')
            .eq('type', 'priority')
            .in('id', priorityIds);
          priorities = priorityStatuses;
        }

        // Add priority info to tickets
        if (priorities && priorities.length > 0) {
          tickets.forEach(ticket => {
            const priority = priorities.find(p => p.id === ticket.priority_id);
            if (priority) {
              (ticket as any).priorities = priority;
            }
          });
        }
      }
    }

    // Get available filter options based on user's access
    let availableProjectsQuery = supabase
      .from('projects')
      .select('id, name')
      .eq('organization_id', organizationId);

    let availableRoles: string[] = [];

    if (userRole === 'user' || userRole === 'manager') {
      // Get only projects user has access to
      const { data: userProjects } = await supabase
        .from('project_user_relations')
        .select('project_id, role, projects!inner(name)')
        .eq('user_id', userId);

      const availableProjects = userProjects?.map(up => ({
        id: up.project_id,
        name: up.projects[0]?.name || 'Unknown Project'
      })) || [];

      // Get available roles for this user
      availableRoles = [...new Set(userProjects?.map(p => p.role) || [])];

      return NextResponse.json({
        tickets: tickets || [],
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
          role: userRole,
          canViewAllTickets: userRole === 'admin'
        }
      });
    } else {
      // Admin can see all projects
      const { data: availableProjects } = await availableProjectsQuery;

      return NextResponse.json({
        tickets: tickets || [],
        totalCount: totalCount || 0,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((totalCount || 0) / limit),
          totalItems: totalCount || 0,
          hasNextPage: page < Math.ceil((totalCount || 0) / limit),
          hasPreviousPage: page > 1
        },
        filters: {
          availableProjects: availableProjects || [],
          availableRoles: ['admin', 'manager', 'user'] // All roles for admin
        },
        userAccess: {
          role: userRole,
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