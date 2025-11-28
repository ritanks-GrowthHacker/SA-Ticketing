import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, userProject, projects, globalRoles, eq, and, sql } from '@/lib/db-helper';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const userId = decoded.sub;
    const organizationId = decoded.org_id;

    console.log(`🔍 GET-DEFAULT-PROJECT: Getting first project for user ${userId}`);

    // Get user's projects ordered by creation date (first project in DB hierarchy)
    const userProjects = await db
      .select({
        projectId: userProject.projectId,
        roleId: userProject.roleId,
        projectData: {
          id: projects.id,
          name: projects.name,
          organizationId: projects.organizationId,
          createdAt: projects.createdAt
        },
        roleData: {
          id: globalRoles.id,
          name: globalRoles.name
        }
      })
      .from(userProject)
      .innerJoin(projects, eq(userProject.projectId, projects.id))
      .innerJoin(globalRoles, eq(userProject.roleId, globalRoles.id))
      .where(and(
        eq(userProject.userId, userId),
        eq(projects.organizationId, organizationId)
      ))
      .limit(1);

    if (!userProjects || userProjects.length === 0) {
      console.error('❌ GET-DEFAULT-PROJECT: No projects found for user');
      return NextResponse.json({ error: "No projects found for user" }, { status: 404 });
    }

    // Get the first project (hierarchy order)
    const firstProject = userProjects[0];
    const projectData = firstProject.projectData;
    const roleData = firstProject.roleData;

    console.log('✅ GET-DEFAULT-PROJECT: First project found:', projectData.name, 'with role:', roleData.name);

    // Generate JWT with first project context
    const tokenPayload = {
      sub: userId,
      org_id: organizationId,
      project_id: projectData.id,
      project_name: projectData.name,
      role: roleData.name,
      role_id: roleData.id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    const newToken = jwt.sign(tokenPayload, process.env.JWT_SECRET as string);

    return NextResponse.json({
      success: true,
      token: newToken,
      project: {
        id: projectData.id,
        name: projectData.name
      },
      role: roleData.name,
      allProjects: userProjects.map(up => ({
        id: up.projectData.id,
        name: up.projectData.name,
        role: up.roleData.name
      }))
    });

  } catch (error) {
    console.error('❌ GET-DEFAULT-PROJECT: Error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}