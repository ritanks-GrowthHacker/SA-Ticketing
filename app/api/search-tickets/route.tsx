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
    const departmentId = tokenData.department_id; // Get department from JWT
    
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

    let actualUserRole = tokenData.role || 'Member'; // fallback to JWT role
    if (userOrgRole && userOrgRole.global_roles) {
      actualUserRole = (userOrgRole.global_roles as any).name;
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



    // Build base query with RBAC
    let ticketsQuery = supabase
      .from('tickets')
      .select(`
        id, title, description, created_at, updated_at, 
        status_id, priority_id, created_by, assigned_to, project_id,
        projects!inner(name, organization_id),
        creator:users!tickets_created_by_fkey(name, email),
        assignee:users!tickets_assigned_to_fkey(name, email),
        statuses!tickets_status_id_fkey(name, color_code),
        priorities!tickets_priority_id_fkey(name, color_code)
      `)
      .eq('projects.organization_id', organizationId);

    // Apply RBAC filtering
    if (actualUserRole !== 'Admin') {
      // Get user's project assignments with roles for count query
      const { data: userProjects } = await supabase
        .from('user_project')
        .select(`
          project_id,
          role_id,
          global_roles!user_project_role_id_fkey(name)
        `)
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
      
      console.log('🎯 User projects for tickets:', userProjects.map(p => ({
        projectId: p.project_id,
        role: (p.global_roles as any)?.name
      })));
      
      // For Members: Only show tickets assigned to them OR created by them
      if (actualUserRole === 'Member') {
        console.log('👤 Member access: showing only assigned/created tickets');
        ticketsQuery = ticketsQuery
          .in('project_id', projectIds)
          .or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
      } else {
        console.log('👑 Manager/Admin access: showing all tickets in projects:', projectIds);
        // For Managers and other non-Admin roles: Show all tickets in assigned projects
        // Filter by role if specified
        if (roleFilter) {
          const filteredProjects = userProjects
            .filter(p => (p.global_roles as any)?.name === roleFilter)
            .map(p => p.project_id);
          ticketsQuery = ticketsQuery.in('project_id', filteredProjects);
        } else {
          ticketsQuery = ticketsQuery.in('project_id', projectIds);
        }
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
    if (actualUserRole !== 'Admin') {
      const { data: userProjectsCount } = await supabase
        .from('user_project')
        .select(`
          project_id,
          role_id,
          global_roles!user_project_role_id_fkey(name)
        `)
        .eq('user_id', userId);

      if (userProjectsCount && userProjectsCount.length > 0) {
        const projectIds = userProjectsCount.map(p => p.project_id);
        
        // For Members: Only count tickets assigned to them OR created by them
        if (actualUserRole === 'Member') {
          countQuery = countQuery
            .in('project_id', projectIds)
            .or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
        } else {
          // For Managers and other non-Admin roles: Count all tickets in assigned projects
          const filteredProjectIds = roleFilter 
            ? userProjectsCount.filter(p => (p.global_roles as any)?.name === roleFilter).map(p => p.project_id)
            : projectIds;
          countQuery = countQuery.in('project_id', filteredProjectIds);
        }
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

    if (actualUserRole !== 'Admin') {
      // Get only projects user has access to
      const { data: userProjectsForFilter } = await supabase
        .from('user_project')
        .select(`
          project_id,
          role_id,
          global_roles!user_project_role_id_fkey(name),
          projects!inner(name)
        `)
        .eq('user_id', userId);

      let availableProjects = userProjectsForFilter?.map(up => ({
        id: up.project_id,
        name: (up.projects as any)?.name || 'Unknown Project'
      })) || [];

      // Filter by department if selected
      if (departmentId && availableProjects.length > 0) {
        const { data: deptProjects } = await supabase
          .from('project_department')
          .select('project_id')
          .eq('department_id', departmentId);

        const deptProjectIds = deptProjects?.map(dp => dp.project_id) || [];
        availableProjects = availableProjects.filter(p => deptProjectIds.includes(p.id));
      }

      // Get available roles for this user
      availableRoles = [...new Set(userProjectsForFilter?.map(p => (p.global_roles as any)?.name).filter(Boolean) || [])];

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
          role: actualUserRole,
          canViewAllTickets: actualUserRole === 'Admin'
        }
      });
    } else {
      // Admin can see all projects - BUT filter by department if selected
      if (departmentId) {
        // Get projects from this department
        const { data: deptProjects } = await supabase
          .from('project_department')
          .select('project_id')
          .eq('department_id', departmentId);

        const deptProjectIds = deptProjects?.map(dp => dp.project_id) || [];
        
        // Filter available projects by department
        availableProjectsQuery = availableProjectsQuery.in('id', deptProjectIds);
      }
      
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