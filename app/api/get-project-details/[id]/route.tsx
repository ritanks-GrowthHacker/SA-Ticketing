import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/app/db/connections';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    console.log('🔍 API params received:', resolvedParams);
    console.log('🔍 Project ID from params:', resolvedParams.id);
    
    const projectId = resolvedParams.id;
    
    if (!projectId || projectId === 'undefined') {
      console.error('❌ Invalid project ID:', projectId);
      return NextResponse.json(
        { error: "Invalid project ID" }, 
        { status: 400 }
      );
    }
    
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

    console.log('🔍 Fetching project details for ID:', projectId);

    // Get project details with joins
    const { data: project, error: projectError } = await supabase
      .from('projects')
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
          sort_order
        )
      `)
      .eq('id', projectId)
      .eq('organization_id', decodedToken.org_id)
      .single();

    if (projectError || !project) {
      console.error('Project not found:', projectError);
      return NextResponse.json(
        { error: "Project not found or access denied" }, 
        { status: 404 }
      );
    }

    // Check if user has access to this project
    const userRole = decodedToken.role;
    
    if (userRole !== 'Admin') {
      // For non-admins, check if they're assigned to this project
      const { data: userProject } = await supabase
        .from('user_project')
        .select('user_id, project_id')
        .eq('user_id', decodedToken.sub)
        .eq('project_id', projectId)
        .single();

      if (!userProject) {
        return NextResponse.json(
          { error: "Access denied. You are not assigned to this project." }, 
          { status: 403 }
        );
      }
    }

    // Get all tickets with their statuses for proper counting
    console.log('🔧 Querying tickets for project:', projectId);
    const { data: allProjectTickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, status_id, statuses!tickets_status_id_fkey(name, type)')
      .eq('project_id', projectId);

    console.log('🔧 Tickets query result:', { 
      ticketsFound: allProjectTickets?.length || 0, 
      error: ticketsError,
      firstTicket: allProjectTickets?.[0]
    });

    // Get team members count
    const { count: teamMembersCount } = await supabase
      .from('user_project')
      .select('user_id', { count: 'exact' })
      .eq('project_id', projectId);

    // Calculate stats using dynamic status detection
    const totalCount = allProjectTickets?.length || 0;
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
      teamMembers: teamMembersCount || 0,
      statusBreakdown,
      allTicketsInProject: allProjectTickets?.map((t: any) => ({ 
        id: t.id, 
        status: t.statuses?.name || 'No Status',
        isCompleted: (t.statuses?.name?.toLowerCase().includes('complete') || 
                     t.statuses?.name?.toLowerCase().includes('done') ||
                     t.statuses?.name?.toLowerCase().includes('closed'))
      })) || []
    });
    
    const projectStats = {
      totalTickets: totalCount,
      openTickets: openCount,
      completedTickets: completedCount,
      teamMembers: teamMembersCount || 0,
      completionRate: totalCount > 0 
        ? Math.round((completedCount / totalCount) * 100)
        : 0,
      statusBreakdown
    };

    // Format the response
    const formattedProject = {
      id: project.id,
      name: project.name,
      description: project.description,
      status_id: project.status_id,
      status: project.project_statuses,
      created_at: project.created_at,
      updated_at: project.updated_at,
      created_by: project.users,
      organization: project.organizations,
      stats: projectStats
    };

    console.log('✅ Project details fetched successfully');

    return NextResponse.json({
      message: "Project details retrieved successfully",
      project: formattedProject
    });

  } catch (error) {
    console.error('Error fetching project details:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}