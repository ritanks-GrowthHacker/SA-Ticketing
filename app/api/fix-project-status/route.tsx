import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// import { supabase } from '@/app/db/connections';
import { db, projectStatuses, projects, eq, and, isNull } from '@/lib/db-helper';

interface JWTPayload {
  sub: string;        // user ID
  org_id: string;     // organization ID
  org_name: string;   // organization name
  org_domain: string; // organization domain
  role: string;       // user role
  roles: string[];    // all user roles
  iat?: number;
  exp?: number;
}

export async function POST(req: NextRequest) {
  try {
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

    // Only admins can run this migration
    if (decodedToken.role !== 'Admin') {
      return NextResponse.json(
        { error: "Only administrators can run this migration" }, 
        { status: 403 }
      );
    }

    console.log('🚀 Starting project status migration for org:', decodedToken.org_id);

    // First, let's check all statuses for debugging
    const allStatuses = await db.select()
      .from(projectStatuses)
      .where(eq(projectStatuses.organizationId, decodedToken.org_id));

    console.log('🔍 All project statuses for org:', {
      orgId: decodedToken.org_id,
      statusCount: allStatuses?.length || 0,
      statuses: allStatuses
    });

    // Try to get the "Active" status for this organization
    const activeStatusResults = await db.select({
      id: projectStatuses.id,
      name: projectStatuses.name,
      organizationId: projectStatuses.organizationId
    })
      .from(projectStatuses)
      .where(and(
        eq(projectStatuses.organizationId, decodedToken.org_id),
        eq(projectStatuses.name, 'Active')
      ))
      .limit(1);
    
    const activeStatus = activeStatusResults[0] || null;

    console.log('🔍 Active status query result:', {
      activeStatus,
      searchingForOrg: decodedToken.org_id
    });

    if (!activeStatus) {
      // Try to find any "Active" status and show available options
      const anyActiveStatus = await db.select({
        id: projectStatuses.id,
        name: projectStatuses.name,
        organizationId: projectStatuses.organizationId
      })
        .from(projectStatuses)
        .where(eq(projectStatuses.name, 'Active'));

      console.error('❌ Active status not found for this org. Available Active statuses:', anyActiveStatus);
      
      // If no Active status found, use the first available status
      const firstStatus = allStatuses?.[0];
      if (firstStatus) {
        console.log('⚠️ Using first available status as fallback:', firstStatus);
        
        return NextResponse.json({
          success: true,
          message: `No Active status found. Using ${firstStatus.name} status instead.`,
          fallback_used: true,
          status_used: firstStatus,
          available_statuses: allStatuses
        });
      }
      
      return NextResponse.json(
        { 
          error: "No project statuses found for this organization",
          debug: {
            orgId: decodedToken.org_id,
            availableStatuses: allStatuses,
            anyActiveStatuses: anyActiveStatus
          }
        }, 
        { status: 400 }
      );
    }

    console.log('✅ Found Active status:', activeStatus);

    // Get all projects without status_id in this organization
    const projectsToUpdate = await db.select({
      id: projects.id,
      name: projects.name,
      statusId: projects.statusId,
      organizationId: projects.organizationId
    })
      .from(projects)
      .where(and(
        eq(projects.organizationId, decodedToken.org_id),
        isNull(projects.statusId)
      ));

    console.log('📊 Projects query result:', {
      orgId: decodedToken.org_id,
      projectCount: projectsToUpdate?.length || 0,
      projects: projectsToUpdate
    });

    console.log(`📊 Found ${projectsToUpdate?.length || 0} projects without status`);

    if (!projectsToUpdate || projectsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No projects need status updates. All projects already have status assigned.",
        updated_count: 0
      });
    }

    // Update all projects to have Active status
    const currentTime = new Date();
    const updatedProjects = await db.update(projects)
      .set({ 
        statusId: activeStatus.id,
        updatedAt: currentTime
      })
      .where(and(
        eq(projects.organizationId, decodedToken.org_id),
        isNull(projects.statusId)
      ))
      .returning({ id: projects.id, name: projects.name, statusId: projects.statusId });

    console.log(`✅ Updated ${updatedProjects?.length || 0} projects to Active status`);

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedProjects?.length || 0} projects to Active status`,
      updated_count: updatedProjects?.length || 0,
      active_status: activeStatus,
      updated_projects: updatedProjects
    });

  } catch (error) {
    console.error('❌ Error in fix-project-status migration:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}