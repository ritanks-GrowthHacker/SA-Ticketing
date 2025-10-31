import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/app/db/connections';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    
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

    // Only admins can edit project details
    if (decodedToken.role !== 'Admin') {
      return NextResponse.json(
        { error: "Access denied. Only admins can edit project details." }, 
        { status: 403 }
      );
    }

    // Parse request body
    const { name, description, status_id } = await req.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Project name is required" }, 
        { status: 400 }
      );
    }

    console.log('🔄 Updating project:', projectId);

    // Verify project exists and belongs to user's organization
    const { data: existingProject } = await supabase
      .from('projects')
      .select('id, organization_id, name')
      .eq('id', projectId)
      .eq('organization_id', decodedToken.org_id)
      .single();

    if (!existingProject) {
      return NextResponse.json(
        { error: "Project not found or access denied" }, 
        { status: 404 }
      );
    }

    // Check if status_id is valid (if provided) - now global, no org check needed
    if (status_id) {
      const { data: status } = await supabase
        .from('project_statuses')
        .select('id')
        .eq('id', status_id)
        .single();

      if (!status) {
        return NextResponse.json(
          { error: "Invalid status selected" }, 
          { status: 400 }
        );
      }
    }

    // Check for duplicate name (excluding current project)
    const { data: duplicateProject } = await supabase
      .from('projects')
      .select('id')
      .eq('name', name.trim())
      .eq('organization_id', decodedToken.org_id)
      .neq('id', projectId)
      .single();

    if (duplicateProject) {
      return NextResponse.json(
        { error: "A project with this name already exists" }, 
        { status: 409 }
      );
    }

    // Update the project
    const updateData: any = {
      name: name.trim(),
      description: description?.trim() || null,
      updated_by: decodedToken.sub,
      updated_at: new Date().toISOString()
    };

    if (status_id) {
      updateData.status_id = status_id;
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
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
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return NextResponse.json(
        { error: "Failed to update project" }, 
        { status: 500 }
      );
    }

    // Format the response
    const formattedProject = {
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description,
      status_id: updatedProject.status_id,
      status: updatedProject.project_statuses,
      created_at: updatedProject.created_at,
      updated_at: updatedProject.updated_at,
      created_by: updatedProject.users,
      organization: updatedProject.organizations
    };

    console.log('✅ Project updated successfully');

    return NextResponse.json({
      message: "Project updated successfully",
      project: formattedProject
    });

  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}