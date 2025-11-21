import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { supabase } from "@/app/db/connections";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const userId = decoded.sub;
    const organizationId = decoded.org_id;

    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    console.log(`🔄 SWITCH-PROJECT: User ${userId} switching to project ${projectId}`);

    // Verify user has access to this project and get their role
    const { data: userProjectRole, error } = await supabase
      .from('user_project')
      .select(`
        role_id,
        projects!inner(id, name, organization_id),
        global_roles!user_project_role_id_fkey(id, name)
      `)
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .eq('projects.organization_id', organizationId)
      .single();

    if (error || !userProjectRole) {
      console.error('❌ SWITCH-PROJECT: User does not have access to project:', error);
      return NextResponse.json({ error: "Access denied to this project" }, { status: 403 });
    }

    const projectData = userProjectRole.projects as any;
    const roleData = userProjectRole.global_roles as any;

    console.log('✅ SWITCH-PROJECT: User has access with role:', roleData.name);

    // Generate new JWT with project context (preserving org_role from old token)
    const newTokenPayload = {
      sub: userId,
      email: decoded.email,
      name: decoded.name,
      org_id: organizationId,
      org_name: decoded.org_name,
      org_domain: decoded.org_domain,
      org_role: decoded.org_role || decoded.role, // Preserve org role for profile
      project_id: projectId,
      project_name: projectData.name,
      project_role: roleData.name, // THIS IS THE DOMINANT ROLE
      role: roleData.name, // Alias for compatibility
      roles: [roleData.name],
      role_id: roleData.id,
      departments: decoded.departments || [], // Preserve departments
      department_id: decoded.department_id, // Preserve current department
      department_name: decoded.department_name,
      department_role: decoded.department_role,
      iss: process.env.JWT_ISSUER,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days to match login
    };

    const newToken = jwt.sign(newTokenPayload, process.env.JWT_SECRET as string);

    console.log('🔐 SWITCH-PROJECT: Generated new JWT for project:', projectData.name, 'with role:', roleData.name);

    return NextResponse.json({
      success: true,
      token: newToken,
      project: {
        id: projectId,
        name: projectData.name
      },
      role: roleData.name,
      message: `Switched to project: ${projectData.name} as ${roleData.name}`
    });

  } catch (error) {
    console.error('❌ SWITCH-PROJECT: Error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}