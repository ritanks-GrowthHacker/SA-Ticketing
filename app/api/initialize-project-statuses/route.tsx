import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// import { supabase, supabaseAdmin } from '@/app/db/connections';
import { db, projectStatuses, eq } from '@/lib/db-helper';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
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

    console.log('🔧 Initializing project statuses for org:', decodedToken.org_id);

    // Check if statuses already exist
    const existingStatuses = await db.select({ id: projectStatuses.id })
      .from(projectStatuses)
      .where(eq(projectStatuses.organizationId, decodedToken.org_id));

    if (existingStatuses && existingStatuses.length > 0) {
      return NextResponse.json({
        message: "Project statuses already exist",
        count: existingStatuses.length
      });
    }

    // Create default project statuses
    const defaultStatuses = [
      {
        id: "f85e266d-7b75-4b08-b775-2fc17ca4b2a6",
        name: "Planning",
        description: "Project is in planning phase",
        colorCode: "#f59e0b",
        sortOrder: 1,
        isActive: true,
        organizationId: decodedToken.org_id,
        createdBy: decodedToken.sub
      },
      {
        id: "d05ef4b9-63be-42e2-b4a2-3d85537b9b7d", 
        name: "Active",
        description: "Project is actively being worked on",
        colorCode: "#10b981",
        sortOrder: 2,
        isActive: true,
        organizationId: decodedToken.org_id,
        createdBy: decodedToken.sub
      },
      {
        id: "9e001b85-22f5-435f-a95e-f546621c0ce3",
        name: "On Hold",
        description: "Project is temporarily paused",
        colorCode: "#f97316",
        sortOrder: 3,
        isActive: true,
        organizationId: decodedToken.org_id,
        createdBy: decodedToken.sub
      },
      {
        id: "af968d18-dfcc-4d69-93d9-9e7932155ccd",
        name: "Review", 
        description: "Project is under review",
        colorCode: "#3b82f6",
        sortOrder: 4,
        isActive: true,
        organizationId: decodedToken.org_id,
        createdBy: decodedToken.sub
      },
      {
        id: "66a0ccee-c989-4835-a828-bd9765958cf6",
        name: "Completed",
        description: "Project has been completed",
        colorCode: "#6b7280", 
        sortOrder: 5,
        isActive: true,
        organizationId: decodedToken.org_id,
        createdBy: decodedToken.sub
      },
      {
        id: "df41226f-a012-4f83-95e0-c91b0f25f70a",
        name: "Cancelled",
        description: "Project has been cancelled",
        colorCode: "#ef4444",
        sortOrder: 6,
        isActive: true,
        organizationId: decodedToken.org_id,
        createdBy: decodedToken.sub
      }
    ];

    let insertedStatuses;
    try {
      insertedStatuses = await db.insert(projectStatuses)
        .values(defaultStatuses)
        .returning();
    } catch (insertError) {
      console.error('Error inserting project statuses:', insertError);
      return NextResponse.json(
        { error: "Failed to create project statuses", details: insertError }, 
        { status: 500 }
      );
    }

    console.log('✅ Project statuses created successfully:', insertedStatuses?.length);

    return NextResponse.json({
      success: true,
      message: `Successfully created ${defaultStatuses.length} project statuses`,
      statuses: insertedStatuses
    });

  } catch (error) {
    console.error('Error in initialize-project-statuses API:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}