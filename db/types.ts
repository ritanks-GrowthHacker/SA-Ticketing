// SA-Ticketing System TypeScript Interfaces
// Complete type definitions for the ticketing system
// Date: October 31, 2025

// =============================================
// BASE INTERFACES
// =============================================

export interface Organization {
  id: string;
  name: string;
  domain: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  is_verified: boolean;
  profile_picture_url?: string;
  about?: string;
  phone?: string;
  location?: string;
  job_title?: string;
  department?: string;
  date_of_birth?: string;
  email_notifications_enabled?: boolean;
  dark_mode_enabled?: boolean;
  created_at: string;
  updated_at: string;
  profile_updated_at?: string;
  organization?: Organization;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  user?: User;
  role?: Role;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  about?: string;
  phone?: string;
  location?: string;
  jobTitle?: string;
  department?: string;
  dateOfBirth?: string;
  emailNotificationsEnabled?: boolean;
  darkModeEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  profileUpdatedAt?: string;
  organization?: Organization;
  role?: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  profilePictureUrl?: string;
  about?: string;
  phone?: string;
  location?: string;
  jobTitle?: string;
  department?: string;
  dateOfBirth?: string;
  emailNotificationsEnabled?: boolean;
  darkModeEnabled?: boolean;
}

// =============================================
// PROJECT RELATED INTERFACES
// =============================================

export interface ProjectStatus {
  id: string;
  name: string;
  description?: string;
  color_code: string;
  sort_order: number;
  is_active: boolean;
  organization_id: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status_id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  status?: ProjectStatus;
  users?: User; // created_by user
  organizations?: Organization;
  user_project?: UserProject[];
  // Additional computed fields
  ticket_count?: number;
  team_members?: number;
  progress_percentage?: number;
  user_role_in_project?: string;
  // Stats from API
  stats?: ProjectStats;
}

export interface ProjectStats {
  totalTickets: number;
  openTickets: number;
  completedTickets: number;
  teamMembers: number;
  managerName?: string;
  completionRate: number;
  statusBreakdown?: { [statusName: string]: number };
}

export interface UserProject {
  id: string;
  user_id: string;
  project_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by?: string;
  // Joined data
  user?: User;
  project?: Project;
  role?: Role;
  users?: User; // assigned_by user
}

// =============================================
// TICKET RELATED INTERFACES
// =============================================

export interface Status {
  id: string;
  name: string;
  description?: string;
  color_code: string;
  type: string; // 'ticket', 'project', etc.
  sort_order: number;
  is_active: boolean;
  organization_id: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Priority {
  id: string;
  name: string;
  description?: string;
  color_code: string;
  level: number; // 1=Low, 2=Medium, 3=High, 4=Critical
  organization_id: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  status_id?: string;
  priority_id?: string;
  assigned_to?: string;
  created_by: string;
  organization_id: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  created_at: string;
  updated_at: string;
  // Joined data
  project?: Project;
  status?: Status;
  statuses?: Status; // Alternative join name
  priority?: Priority;
  assignee?: User; // assigned_to user
  creator?: User; // created_by user
  users?: User; // Alternative join name for creator
}

// =============================================
// DOCUMENT INTERFACES
// =============================================

export interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  content?: string;
  file_url?: string;
  file_type?: string;
  file_size?: number;
  version: number;
  is_active: boolean;
  created_by: string;
  updated_by?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  project?: Project;
  creator?: User; // created_by user
  updater?: User; // updated_by user
}

// =============================================
// AUTH INTERFACES
// =============================================

export interface OTPVerification {
  id: string;
  email: string;
  otp_code: string;
  purpose: 'registration' | 'login' | 'password_reset';
  expires_at: string;
  is_used: boolean;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  roles?: string[];
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  org_id: string;
  role: string;
  iat?: number;
  exp?: number;
}

// =============================================
// API RESPONSE INTERFACES
// =============================================

export interface ApiResponse<T = any> {
  message: string;
  data?: T;
  error?: string;
  success?: boolean;
}

export interface ProjectsResponse {
  message: string;
  projects: Project[];
  statuses: ProjectStatus[];
  totalCount: number;
  userRole?: string;
  filters?: {
    search?: string;
    includeStats?: boolean;
  };
}

export interface ProjectDetailsResponse {
  message: string;
  project: Project;
}

export interface ProjectMembersResponse {
  message: string;
  members: UserProject[];
}

export interface EntitiesResponse {
  message: string;
  data: {
    roles: Role[];
    users: User[];
    organizations: Organization[];
    statuses: Status[];
    priorities: Priority[];
  };
}

// =============================================
// FORM INTERFACES
// =============================================

export interface CreateProjectForm {
  name: string;
  description?: string;
  status_id?: string;
}

export interface UpdateProjectForm {
  name?: string;
  description?: string;
  status_id?: string;
}

export interface CreateTicketForm {
  title: string;
  description?: string;
  project_id: string;
  status_id?: string;
  priority_id?: string;
  assigned_to?: string;
  due_date?: string;
  estimated_hours?: number;
}

export interface UpdateTicketForm {
  title?: string;
  description?: string;
  status_id?: string;
  priority_id?: string;
  assigned_to?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
}

export interface LoginForm {
  email: string;
  password?: string;
  otp_code?: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  organization_name: string;
  organization_domain: string;
  otp_code?: string;
}

// =============================================
// STORE INTERFACES
// =============================================

export interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  organization: Organization | null;
  roles: string[] | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser, organization: Organization, roles: string[]) => void;
  clearAuth: () => void;
}

export interface CachedProjectData {
  projects: Project[];
  statuses: ProjectStatus[];
  organizationId: string;
  timestamp: number;
}

export interface ProjectStore {
  cachedData: CachedProjectData | null;
  isLoading: boolean;
  lastUpdateTimestamp: number;
  getCachedData: (orgId: string) => CachedProjectData | null;
  setCachedData: (projects: Project[], statuses: ProjectStatus[], orgId: string) => void;
  isCacheValid: (orgId: string) => boolean;
  clearCache: () => void;
  setLoading: (loading: boolean) => void;
  invalidateCache: () => void;
  broadcastUpdate: (type: string, data: any) => void;
  setupCrossTabSync: () => () => void;
  updateProjectStatus: (projectId: string, statusId: string) => void;
}

// =============================================
// UI COMPONENT INTERFACES
// =============================================

export interface NotificationProps {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  show: boolean;
  onClose: () => void;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export interface TableColumn<T = any> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

// =============================================
// UTILITY TYPES
// =============================================

export type SortDirection = 'asc' | 'desc';
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in';

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface FilterConfig {
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
}

// =============================================
// EXPORT ALL TYPES
// =============================================

export type {
  // Re-export for convenience
  Organization as Org,
  ProjectStatus as ProjStatus,
  UserProject as ProjectMember,
  OTPVerification as OTP
};