import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// import { supabase } from "@/app/db/connections";
import { db, projectStatuses, projects, eq, and } from '@/lib/db-helper';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenData = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    if (!tokenData.roles?.includes('Admin')) {
      return NextResponse.json({ 
        error: "Access denied. Only Admin can create projects" 
      }, { status: 403 });
    }

    const {
      name,
      description,
      startDate,
      endDate,
      priority,
      status,
      budget,
      teamLeadId,
      managerIds
    } = await req.json();

    // Validate required fields
    if (!name || !description || !startDate || !endDate) {
      return NextResponse.json({ 
        error: "Missing required fields" 
      }, { status: 400 });
    }

    // Get the "Active" status for this organization
    const activeStatusResults = await db.select({ id: projectStatuses.id })
      .from(projectStatuses)
      .where(and(
        eq(projectStatuses.organizationId, tokenData.org_id),
        eq(projectStatuses.name, "Active"),
        eq(projectStatuses.isActive, true)
      ))
      .limit(1);
    
    const activeStatus = activeStatusResults[0] || null;

    if (!activeStatus) {
      console.error("Active status not found");
      return NextResponse.json({
        error: "Active project status not found. Please ensure project statuses are configured."
      }, { status: 400 });
    }

    // Create the project
    const newProjects = await db.insert(projects)
      .values({
        name: name.trim(),
        description: description.trim(),
        organizationId: tokenData.org_id,
        statusId: activeStatus.id,
        createdBy: tokenData.sub
      })
      .returning();
    
    const newProject = newProjects[0];

    if (!newProject) {
      console.error('Error creating project: No data returned');
      return NextResponse.json({ 
        error: "Failed to create project" 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Project created successfully",
      project: newProject
    }, { status: 201 });

  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}