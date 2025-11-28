import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// import { supabase } from '@/app/db/connections';
import { db, projects, organizations, users as usersTable, projectStatuses, eq, and } from '@/lib/db-helper';

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

    // Only admins and managers can edit project details
    if (decodedToken.role !== 'Admin' && decodedToken.role !== 'Manager') {
      return NextResponse.json(
        { error: "Access denied. Only admins and managers can edit project details." }, 
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
    const existingProject = await db.select({ id: projects.id, organizationId: projects.organizationId, name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, decodedToken.org_id)))
      .limit(1)
      .then(rows => rows[0] || null);

    if (!existingProject) {
      return NextResponse.json(
        { error: "Project not found or access denied" }, 
        { status: 404 }
      );
    }

    // Check if status_id is valid (if provided) - now global, no org check needed
    if (status_id) {
      const status = await db.select({ id: projectStatuses.id })
        .from(projectStatuses)
        .where(eq(projectStatuses.id, status_id))
        .limit(1)
        .then(rows => rows[0] || null);

      if (!status) {
        return NextResponse.json(
          { error: "Invalid status selected" }, 
          { status: 400 }
        );
      }
    }

    // Check for duplicate name (excluding current project)
    const duplicateProject = await db.select({ id: projects.id })
      .from(projects)
      .where(and(
        eq(projects.name, name.trim()),
        eq(projects.organizationId, decodedToken.org_id)
      ))
      .limit(2)
      .then(rows => rows.find(p => p.id !== projectId) || null);

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
      updatedBy: decodedToken.sub,
      updatedAt: new Date()
    };

    if (status_id) {
      updateData.statusId = status_id;
    }

    const updatedProjects = await db.update(projects)
      .set(updateData)
      .where(eq(projects.id, projectId))
      .returning();

    const updatedProject = updatedProjects[0];
    if (!updatedProject) {
      console.error('Error updating project: No project returned');
      return NextResponse.json(
        { error: "Failed to update project" }, 
        { status: 500 }
      );
    }

    // Fetch related data
    const [org, creator, status] = await Promise.all([
      db.select().from(organizations).where(eq(organizations.id, updatedProject.organizationId)).limit(1).then(rows => rows[0] || null),
      updatedProject.createdBy ? db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, updatedProject.createdBy)).limit(1).then(rows => rows[0] || null) : Promise.resolve(null),
      updatedProject.statusId ? db.select().from(projectStatuses).where(eq(projectStatuses.id, updatedProject.statusId)).limit(1).then(rows => rows[0] || null) : Promise.resolve(null)
    ]);

    // Format the response
    const formattedProject = {
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description,
      status_id: updatedProject.statusId,
      status: status ? {
        id: status.id,
        name: status.name,
        description: status.description,
        color_code: status.colorCode,
        sort_order: status.sortOrder
      } : null,
      created_at: updatedProject.createdAt?.toISOString() || new Date().toISOString(),
      updated_at: updatedProject.updatedAt?.toISOString() || null,
      created_by: creator,
      organization: org ? { id: org.id, name: org.name, domain: org.domain } : null
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