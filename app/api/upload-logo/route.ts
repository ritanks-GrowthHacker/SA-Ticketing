import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('logo') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and SVG are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum 5MB allowed.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/\s+/g, '-').toLowerCase();
    const extension = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, extension);
    const uniqueFilename = `${nameWithoutExt}-${timestamp}${extension}`;

    // Define upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos');

    // Create directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save file
    const filePath = path.join(uploadDir, uniqueFilename);
    await writeFile(filePath, buffer);

    // Return public URL
    const logoUrl = `/uploads/logos/${uniqueFilename}`;

    console.log('✅ Logo uploaded successfully:', logoUrl);

    return NextResponse.json({
      success: true,
      logoUrl,
      filename: uniqueFilename,
      size: file.size,
      type: file.type
    });

  } catch (error: any) {
    console.error('Logo upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo', details: error.message },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check upload status or list logos
export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Logo upload endpoint',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    maxSize: '5MB',
    method: 'POST'
  });
}
