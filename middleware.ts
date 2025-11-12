import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if we're in development mode with auth bypass
  const bypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';
  
  if (bypassAuth) {
    console.log('🔓 Development mode: Bypassing all authentication checks');
    // Allow all requests to pass through in development mode
    return NextResponse.next();
  }

  // In production, you can add your authentication logic here
  // For now, allow everything to pass through
  return NextResponse.next();
}

// Configure which routes this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};