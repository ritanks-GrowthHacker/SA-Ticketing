import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/db/connections'; // Keep for Storage only
import { db, projects, eq } from '@/lib/db-helper';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  sub: string;
  org_id: string;
  role: string;
  userId: string;
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    console.log('📎 Upload Project Doc File API called');
    
    // Verify JWT token
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" }, 
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

    const userId = decodedToken.sub || decodedToken.userId;
    const orgId = decodedToken.org_id;

    console.log('🔍 User info:', { userId, orgId });

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('project_id') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: PDF, Word documents, and images (JPEG, PNG, GIF, WebP)` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    console.log('📎 File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      projectId
    });

    // Verify project access using Drizzle
    const projectResults = await db.select({
      id: projects.id,
      organizationId: projects.organizationId,
      name: projects.name
    })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    const project = projectResults[0];

    console.log('🔍 Project verification:', { 
      project,
      expectedOrgId: orgId,
      projectOrgId: project?.organizationId
    });

    if (!project) {
      console.error('❌ Project access denied');
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 403 }
      );
    }

    // Check organization match
    if (orgId && project.organizationId !== orgId) {
      console.error('❌ Organization mismatch:', { 
        userOrgId: orgId, 
        projectOrgId: project.organizationId
      });
      return NextResponse.json(
        { error: 'Project belongs to different organization' },
        { status: 403 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${projectId}/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const bucketName = 'project_ticket_module';

    console.log('📎 Uploading to Supabase Storage:', { bucketName, fileName });

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage using admin client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    console.log('✅ File uploaded successfully:', publicUrl);

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
        path: fileName
      }
    });

  } catch (error) {
    console.error('❌ Unexpected error in upload-project-doc-file:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
