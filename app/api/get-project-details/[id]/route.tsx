import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// import { supabase } from '@/app/db/connections';
import { db, projects, organizations, users, projectStatuses, userProject, tickets, statuses, eq, and, sql } from '@/lib/db-helper';

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

    // Get project details with joins using raw SQL
    const projectResults = await db.execute<{
      id: string;
      name: string;
      description: string;
      status_id: string;
      created_at: Date;
      updated_at: Date;
      organization_id: string;
      created_by: string;
      org_id: string;
      org_name: string;
      org_domain: string;
      creator_id: string;
      creator_name: string;
      creator_email: string;
      ps_id: string;
      ps_name: string;
      ps_description: string;
      ps_color_code: string;
      ps_sort_order: number;
    }>(sql`
      SELECT 
        p.id, p.name, p.description, p.status_id, p.created_at, p.updated_at,
        p.organization_id, p.created_by,
        o.id as org_id, o.name as org_name, o.domain as org_domain,
        u.id as creator_id, u.name as creator_name, u.email as creator_email,
        ps.id as ps_id, ps.name as ps_name, ps.description as ps_description,
        ps.color_code as ps_color_code, ps.sort_order as ps_sort_order
      FROM projects p
      LEFT JOIN organizations o ON p.organization_id = o.id
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN project_statuses ps ON p.status_id = ps.id
      WHERE p.id = ${projectId}
      AND p.organization_id = ${decodedToken.org_id}
      LIMIT 1
    `);

    const project = projectResults.rows[0];

    if (!project) {
      console.error('Project not found');
      return NextResponse.json(
        { error: "Project not found or access denied" }, 
        { status: 404 }
      );
    }

    // Check if user has access to this project
    const userRole = decodedToken.role;
    
    if (userRole !== 'Admin') {
      // For non-admins, check if they're assigned to this project
      const userProjectResults = await db.select({
        userId: userProject.userId,
        projectId: userProject.projectId
      })
        .from(userProject)
        .where(and(
          eq(userProject.userId, decodedToken.sub),
          eq(userProject.projectId, projectId)
        ))
        .limit(1);

      if (userProjectResults.length === 0) {
        return NextResponse.json(
          { error: "Access denied. You are not assigned to this project." }, 
          { status: 403 }
        );
      }
    }

    // Get all tickets with their statuses for proper counting
    console.log('🔧 Querying tickets for project:', projectId);
    const allProjectTickets = await db.execute<{
      id: string;
      status_id: string;
      status_name: string;
      status_type: string;
    }>(sql`
      SELECT 
        t.id, t.status_id,
        s.name as status_name, s.type as status_type
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.project_id = ${projectId}
    `);

    console.log('🔧 Tickets query result:', { 
      ticketsFound: allProjectTickets.rows?.length || 0,
      firstTicket: allProjectTickets.rows?.[0]
    });

    // Get team members count
    const teamCountResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM user_project
      WHERE project_id = ${projectId}
    `);
    const teamMembersCount = teamCountResult.rows[0]?.count || 0;

    // Calculate stats using dynamic status detection
    const totalCount = allProjectTickets.rows?.length || 0;
    const completedTickets = allProjectTickets.rows?.filter((t: any) => {
      const statusName = t.status_name?.toLowerCase() || '';
      const statusType = t.status_type?.toLowerCase() || '';
      return statusName.includes('complete') || 
             statusName.includes('done') || 
             statusName.includes('closed') ||
             statusType === 'completed';
    }) || [];
    const completedCount = completedTickets.length;
    const openCount = totalCount - completedCount;
    
    // Create detailed status breakdown for debugging
    const statusBreakdown: { [key: string]: number } = {};
    allProjectTickets.rows?.forEach((t: any) => {
      const statusName = t.status_name || 'No Status';
      statusBreakdown[statusName] = (statusBreakdown[statusName] || 0) + 1;
    });
    
    console.log('📊 Stats Debug:', {
      totalTickets: totalCount,
      openTickets: openCount,
      completedTickets: completedCount,
      teamMembers: teamMembersCount || 0,
      statusBreakdown,
      allTicketsInProject: allProjectTickets.rows?.map((t: any) => ({ 
        id: t.id, 
        status: t.status_name || 'No Status',
        isCompleted: (t.status_name?.toLowerCase().includes('complete') || 
                     t.status_name?.toLowerCase().includes('done') ||
                     t.status_name?.toLowerCase().includes('closed'))
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
      status: {
        id: project.ps_id,
        name: project.ps_name,
        description: project.ps_description,
        color_code: project.ps_color_code,
        sort_order: project.ps_sort_order
      },
      created_at: project.created_at,
      updated_at: project.updated_at,
      created_by: {
        id: project.creator_id,
        name: project.creator_name,
        email: project.creator_email
      },
      organization: {
        id: project.org_id,
        name: project.org_name,
        domain: project.org_domain
      },
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