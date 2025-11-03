import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

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
    const { data: userProjects, error } = await supabase
      .from('user_project')
      .select(`
        project_id,
        role_id,
        projects!inner(id, name, organization_id, created_at),
        global_roles!user_project_role_id_fkey(id, name)
      `)
      .eq('user_id', userId)
      .eq('projects.organization_id', organizationId)
      .limit(1)

    if (error || !userProjects || userProjects.length === 0) {
      console.error('❌ GET-DEFAULT-PROJECT: No projects found for user:', error);
      return NextResponse.json({ error: "No projects found for user" }, { status: 404 });
    }

    // Get the first project (hierarchy order)
    const firstProject = userProjects[0];
    const projectData = firstProject.projects as any;
    const roleData = firstProject.global_roles as any;

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
        id: (up.projects as any).id,
        name: (up.projects as any).name,
        role: (up.global_roles as any).name
      }))
    });

  } catch (error) {
    console.error('❌ GET-DEFAULT-PROJECT: Error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}