import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // This is just to help you see what headers are being sent
  const authHeader = request.headers.get('authorization');
  
  return NextResponse.json({
    authHeader,
    allHeaders: Object.fromEntries(request.headers.entries())
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const authHeader = request.headers.get('authorization');
  
  return NextResponse.json({
    message: 'Token received',
    authHeader,
    body,
    hasToken: !!authHeader
  });
}