import { NextRequest, NextResponse } from 'next/server';
// NOTE: File storage functionality disabled - Supabase storage removed
// TODO: Implement alternative storage solution (AWS S3, Cloudinary, etc.)
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

    // File storage functionality temporarily disabled
    console.error('❌ File upload disabled - Supabase storage removed');
    console.log('📎 File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      projectId
    });
    
    // TODO: Implement alternative file storage solution
    // Options:
    // 1. AWS S3
    // 2. Cloudinary
    // 3. Local file system with nginx
    // 4. Google Cloud Storage
    // 5. Azure Blob Storage
    
    return NextResponse.json({
      error: 'File upload is temporarily unavailable',
      details: 'File storage needs to be configured. Supabase storage has been removed. Please implement an alternative storage solution.',
      suggestions: [
        'Configure AWS S3 bucket',
        'Setup Cloudinary account',
        'Implement local file storage',
        'Use Google Cloud Storage',
        'Setup Azure Blob Storage'
      ]
    }, { status: 501 });

  } catch (error) {
    console.error('❌ Unexpected error in upload-project-doc-file:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
