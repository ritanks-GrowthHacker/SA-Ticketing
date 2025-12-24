import { pgTable, uuid, text, varchar, timestamp, boolean, integer, numeric, date, jsonb, check } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Organizations Table
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  domain: text('domain').unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  username: varchar('username').unique(),
  passwordHash: text('password_hash'),
  orgEmail: varchar('org_email').unique(),
  isActive: boolean('is_active').default(false),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  mobileNumber: varchar('mobile_number'),
  otp: varchar('otp'),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
  otpVerified: boolean('otp_verified').default(false),
  mobileVerified: boolean('mobile_verified').default(false),
  associatedDepartments: text('associated_departments').array(),
  logoUrl: text('logo_url'),
  address: text('address'),
  taxPercentage: numeric('tax_percentage').default('0.00'),
  gstNumber: varchar('gst_number'),
  cin: varchar('cin'),
});

// Departments Table
export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  description: text('description'),
  colorCode: varchar('color_code').default('#6b7280'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
});

// Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  profileImage: text('profile_image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  otp: varchar('otp'),
  otpExpiresAt: timestamp('otp_expires_at'),
  otpVerified: boolean('otp_verified').default(false),
  profilePictureUrl: text('profile_picture_url'),
  about: text('about'),
  phone: varchar('phone'),
  location: varchar('location'),
  jobTitle: varchar('job_title'),
  department: varchar('department'),
  dateOfBirth: date('date_of_birth'),
  profileUpdatedAt: timestamp('profile_updated_at', { withTimezone: true }).defaultNow(),
  emailNotificationsEnabled: boolean('email_notifications_enabled').default(true),
  darkModeEnabled: boolean('dark_mode_enabled').default(false),
  organizationId: uuid('organization_id'),
  departmentId: uuid('department_id').references(() => departments.id),
  hasSeenDashboardWelcome: boolean('has_seen_dashboard_welcome').default(false),
});

// Global Roles Table
export const globalRoles = pgTable('global_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Project Statuses Table
export const projectStatuses = pgTable('project_statuses', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
  colorCode: varchar('color_code').default('#6b7280'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  organizationId: uuid('organization_id').references(() => organizations.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// Projects Table
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  statusId: uuid('status_id').references(() => projectStatuses.id),
});

// Priorities Table
export const priorities = pgTable('priorities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
  colorCode: varchar('color_code').default('#6b7280'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  organizationId: uuid('organization_id').references(() => organizations.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Statuses Table (for tickets)
export const statuses = pgTable('statuses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  name: text('name').notNull(),
  type: text('type').notNull(),
  colorCode: varchar('color_code'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tickets Table
export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  statusId: uuid('status_id').references(() => statuses.id),
  priorityId: uuid('priority_id').references(() => priorities.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
  expectedClosingDate: timestamp('expected_closing_date', { withTimezone: true }),
  actualClosingDate: timestamp('actual_closing_date', { withTimezone: true }),
});

// Ticket Comments Table
export const ticketComments = pgTable('ticket_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  parentCommentId: uuid('parent_comment_id').references((): any => ticketComments.id),
  comment: text('comment').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  content: text('content'),
  isDeleted: boolean('is_deleted').default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Notifications Table
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  message: text('message'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  title: text('title'),
  type: varchar('type').default('info'),
  readAt: timestamp('read_at'),
});

// Project Documents Table
export const projectDocs = pgTable('project_docs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  authorId: uuid('author_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content'),
  visibility: text('visibility').default('project'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  fileType: text('file_type'),
  fileSize: integer('file_size'),
  hasFile: boolean('has_file').default(false),
});

// Junction Tables
export const projectDepartment = pgTable('project_department', {
  projectId: uuid('project_id').notNull().references(() => projects.id),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
});

export const sharedProjects = pgTable('shared_projects', {
  projectId: uuid('project_id').notNull().references(() => projects.id),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
  sharedBy: uuid('shared_by').references(() => users.id),
  sharedAt: timestamp('shared_at', { withTimezone: true }).defaultNow(),
});

export const userDepartment = pgTable('user_department', {
  userId: uuid('user_id').notNull().references(() => users.id),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
});

export const userDepartmentRoles = pgTable('user_department_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
  roleId: uuid('role_id').notNull().references(() => globalRoles.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const userOrganizationRoles = pgTable('user_organization_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  roleId: uuid('role_id').notNull().references(() => globalRoles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const userProject = pgTable('user_project', {
  userId: uuid('user_id').notNull().references(() => users.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  roleId: uuid('role_id').notNull().references(() => globalRoles.id),
});

// Meetings
export const meetings = pgTable('meetings', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  scheduledAt: timestamp('scheduled_at').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  title: text('title').notNull(),
  meetingLink: text('meeting_link'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const meetingParticipants = pgTable('meeting_participants', {
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id),
  userId: uuid('user_id').notNull().references(() => users.id),
});

export const meetingMoms = pgTable('meeting_moms', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id),
  generatedByAi: boolean('generated_by_ai').default(true),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tags
export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  colorCode: varchar('color_code'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const entityTags = pgTable('entity_tags', {
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  tagId: uuid('tag_id').notNull().references(() => tags.id),
});

// Attachments
export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  fileUrl: text('file_url').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Activity Logs
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Invitations
export const invitations = pgTable('invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
  email: varchar('email').notNull(),
  name: varchar('name'),
  jobTitle: varchar('job_title'),
  phone: varchar('phone'),
  invitationToken: varchar('invitation_token').notNull().unique(),
  status: varchar('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// Resource Requests
export const resourceRequests = pgTable('resource_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  requestedUserId: uuid('requested_user_id').notNull().references(() => users.id),
  userDepartmentId: uuid('user_department_id').notNull().references(() => departments.id),
  status: varchar('status').notNull().default('pending'),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  requestedRoleId: uuid('requested_role_id').references(() => globalRoles.id),
});
