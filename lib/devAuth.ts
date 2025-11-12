// Development mode helper for API authentication bypass

export const isDevelopmentMode = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';

export const devMockUser = {
  sub: 'dev-user-id',
  email: 'dev@example.com',
  name: 'Developer',
  org_id: 'dev-org-id',
  org_name: 'Development Organization',
  org_domain: 'dev.local',
  role: 'Admin',
  roles: ['Admin'],
  iss: 'dev-mode',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
};

export function bypassAuthInDev(authHeader: string | null) {
  if (isDevelopmentMode) {
    console.log('🔓 Development mode: Bypassing JWT verification');
    return {
      success: true,
      data: devMockUser
    };
  }
  
  return null; // Continue with normal auth flow
}

export function getDevAuthHeader() {
  if (isDevelopmentMode) {
    return 'Bearer dev-token-123';
  }
  return null;
}