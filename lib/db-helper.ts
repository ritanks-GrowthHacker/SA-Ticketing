import { db } from '@/db';
import { eq, and, or, desc, asc, inArray, sql, isNull, gt, lt, gte, lte, ne, notInArray, ilike } from 'drizzle-orm';
import * as schema from '@/db/schema';

// Export database instance and schema
export { db };
export const {
  users,
  organizations,
  departments,
  projects,
  tickets,
  ticketComments,
  notifications,
  statuses,
  priorities,
  projectStatuses,
  globalRoles,
  userDepartmentRoles,
  userOrganizationRoles,
  userProject,
  userDepartment,
  projectDocs,
  projectDepartment,
  sharedProjects,
  meetings,
  meetingParticipants,
  meetingMoms,
  tags,
  entityTags,
  attachments,
  activityLogs,
  invitations,
  resourceRequests,
} = schema;

// Export operators
export { eq, and, or, desc, asc, inArray, sql, isNull, gt, lt, gte, lte, ne, notInArray, ilike };
