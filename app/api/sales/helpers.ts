// Helper to extract user_id and organization_id from JWT
// Handles both old format (user_id, organization_id) and new format (sub, org_id)
export interface DecodedToken {
  sub?: string;
  user_id?: string;
  org_id?: string;
  organization_id?: string;
  email?: string;
  department_role?: string;
  departments?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export function extractUserAndOrgId(decoded: DecodedToken): {
  userId: string;
  organizationId: string;
} {
  const userId = decoded.sub || decoded.user_id || '';
  const organizationId = decoded.org_id || decoded.organization_id || '';
  
  if (!userId || !organizationId) {
    throw new Error('Missing user_id or organization_id in token');
  }
  
  return { userId, organizationId };
}
