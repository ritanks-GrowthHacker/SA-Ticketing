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

    // Create the project
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        description: description.trim(),
        organization_id: tokenData.org_id,
        start_date: startDate,
        end_date: endDate,
        priority: priority || 'Medium',
        status: status || 'Planning',
        budget: budget ? parseFloat(budget) : null,
        created_by: tokenData.sub
      })
      .select()
      .single();

    if (projectError) {
      console.error('Error creating project:', projectError);
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