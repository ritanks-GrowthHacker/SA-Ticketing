# Multi-Department System Implementation

## Overview
Complete implementation of multi-department support with department-based role permissions and project visibility.

## Implementation Date
November 19, 2025

---

## Key Features

### 1. **Department Context in JWT**
- JWT now includes department information:
  - `department_id` - Current active department ID
  - `department_name` - Current active department name
  - `department_role` - Role in current department (Admin, Manager, Member)
  - `hasMultipleDepartments` - Boolean flag indicating if user belongs to multiple departments
  - `all_department_roles` - Array of all department roles for the user

### 2. **Department Switcher UI**
- **Location**: Navbar dropdown menu, positioned above "Sign out" button
- **Visibility**: Only appears when `hasMultipleDepartments === true`
- **Functionality**: 
  - Displays current department name
  - Shows dropdown of all user's departments
  - Highlights currently selected department
  - Smoothly switches department and rebuilds JWT
  - Refreshes page to reload dashboard with new department context

### 3. **Role-Based Project Visibility**

#### Department Admin
- Sees **ALL projects** in their current department
- Includes both owned and shared projects
- Full visibility across department resources

#### Department Manager
- Sees **ONLY projects they're assigned to**
- Must be explicitly added to `user_project` table
- Limited to projects where they have a role

#### Regular User (Member/Viewer)
- Sees **ONLY projects they're assigned to**
- Same restriction as Manager role
- Minimal project access

---

## Files Modified

### 1. **components/ui/navbar.tsx**
**Changes:**
- Added department switcher dropdown component
- Imported `Building2` icon from lucide-react
- Added state management for department dropdown
- Implemented `handleDepartmentSwitch` function
- Fetches user departments from `/api/get-user-departments-projects`
- Only renders department switcher if `hasMultipleDepartments === true`

**Key Functions:**
```typescript
handleDepartmentSwitch(departmentId: string)
- Calls /api/switch-department with new departmentId
- Updates authStore with new token and department
- Refreshes page to reload data
```

### 2. **app/api/verify-login-otp/route.ts**
**Changes:**
- Fetches `user_department_roles` ordered by `created_at` ascending
- Selects first department as `primaryDepartment` on login
- Adds department context to JWT payload:
  - `department_id`
  - `department_name`
  - `department_role`
  - `hasMultipleDepartments`
  - `all_department_roles`

**Logic Flow:**
1. User logs in with OTP
2. Fetch all department roles ordered by creation date
3. Select first department as default
4. Build JWT with full department context
5. Return JWT to client

### 3. **app/api/switch-department/route.ts** *(NEW FILE)*
**Purpose:** Rebuild JWT when user switches department

**Endpoint:** `POST /api/switch-department`

**Request Body:**
```json
{
  "departmentId": "uuid-of-department"
}
```

**Response:**
```json
{
  "token": "new-jwt-token",
  "department": {
    "id": "uuid",
    "name": "Department Name",
    "role": "Admin"
  },
  "hasMultipleDepartments": true
}
```

**Logic:**
1. Verify JWT from Authorization header
2. Query `user_department_roles` to validate user has access to requested department
3. Fetch department details and user's role in that department
4. Generate new JWT with updated department context
5. Return new token and department info

### 4. **app/store/authStore.ts**
**Changes:**
- Added `currentDepartment` state: `{ id, name, role } | null`
- Added `hasMultipleDepartments` boolean flag
- Added `switchDepartment` function to AuthState interface

**New Function:**
```typescript
switchDepartment: (departmentData: { 
  token: string; 
  department: { id: string; name: string; role: string } 
}) => void
```

**Implementation:**
- Logs department switch
- Clears dashboard cache from localStorage
- Updates token in localStorage and state
- Updates currentDepartment in state
- Mirrors `switchProject` pattern for consistency

### 5. **app/api/get-user-departments-projects/route.ts**
**Changes:**
- Extracts `department_id` and `department_role` from JWT
- Implements role-based project filtering:

**Department Admin:**
```typescript
// Fetch ALL projects in current department
SELECT * FROM projects
WHERE project_department.department_id = currentDepartmentId
```

**Department Manager/Member:**
```typescript
// Fetch ONLY assigned projects
SELECT * FROM user_project
WHERE user_id = currentUserId
AND projects.organization_id = organizationId
```

**Logic Flow:**
1. Verify JWT and extract user info + department context
2. Check department_role from JWT
3. If Admin: fetch all department projects
4. If Manager/Member: fetch only assigned projects
5. Format and return projects grouped by department

### 6. **app/api/get-all-projects/route.tsx**
**Changes:**
- Added `department_id` and `department_role` to JWTPayload interface
- Uses department context from JWT for filtering
- Updated role determination logic to prioritize `department_role`

**Filtering Logic:**
```typescript
const effectiveRole = departmentRole || userRole;

if (effectiveRole === "Admin" && isDeptOnlyAdmin) {
  // Department Admin: See all dept projects
}
else if (effectiveRole === "Manager" || departmentRole === "Manager") {
  // Manager: See only assigned projects
}
else {
  // Regular users: See only assigned projects
}
```

**Key Variables:**
- `currentDepartmentId` - From JWT
- `departmentRole` - From JWT
- `effectiveRole` - Prioritizes department_role over org role
- `userDepartmentIds` - Array of department IDs (from JWT or fallback to DB)

### 7. **app/api/get-dashboard-metrics/route.tsx**
**Changes:**
- Extracts `department_id` and `department_role` from JWT
- Filters all metrics queries by department context
- Updates role determination to prioritize department_role

**Filtered Queries:**
1. **Tickets**: Filtered by projects in current department
2. **Active Projects**: Shows only department projects for Admin
3. **Resolved Tickets**: Scoped to department projects
4. **Recent Activity**: Paginated results filtered by department

**Department Admin Filter:**
```typescript
if ((isDeptOnlyAdmin || departmentRole === 'Admin') && userDepartmentId) {
  const { data: deptProjectIds } = await supabase
    .from('project_department')
    .select('project_id')
    .eq('department_id', userDepartmentId);
  
  query = query.in('project_id', projectIds);
}
```

**Applied To:**
- Current/Previous ticket counts
- Active projects count
- Resolved tickets calculation
- Recent activity pagination
- All metric aggregations

---

## Database Schema Dependencies

### Tables Used:
1. **user_department_roles**
   - Links users to departments with roles
   - Columns: `user_id`, `department_id`, `organization_id`, `role_id`, `created_at`
   - Used to determine user's department access

2. **departments**
   - Department master table
   - Columns: `id`, `name`, `color_code`, `organization_id`

3. **project_department**
   - Links projects to departments (one-to-many)
   - Columns: `project_id`, `department_id`
   - Used to filter projects by department

4. **user_project**
   - User-project assignments with roles
   - Columns: `user_id`, `project_id`, `role_id`
   - Determines which projects a Manager/Member can see

5. **global_roles**
   - Role definitions
   - Values: Admin, Manager, Member, Viewer, etc.

---

## User Flow

### Login Flow:
1. User enters email and OTP
2. System fetches all `user_department_roles` ordered by `created_at`
3. First department selected as default (primaryDepartment)
4. JWT generated with department context
5. User lands on dashboard with department-scoped data

### Department Switch Flow:
1. User clicks department dropdown in navbar
2. Selects different department from list
3. Frontend calls `POST /api/switch-department` with `departmentId`
4. Backend validates access and generates new JWT
5. Frontend updates authStore with new token and department
6. Page refreshes to reload dashboard with new department context
7. All subsequent API calls use new department context from JWT

### Project Visibility:
1. **Department Admin** logs in → Sees all department projects in dropdown and dashboard
2. **Department Manager** logs in → Sees only projects they're assigned to
3. **Regular User** logs in → Sees only projects they're assigned to
4. User switches department → Project list updates based on new department and role

---

## API Endpoints

### GET /api/get-user-departments-projects
**Purpose:** Fetch user's departments and projects

**Authorization:** Bearer token (JWT)

**Returns:**
```json
{
  "departments": [{ "id": "uuid", "name": "Engineering", "color_code": "#3b82f6" }],
  "projects": [{ "id": "uuid", "name": "Project A", "role": "Admin", "department_id": "uuid" }],
  "projectsByDepartment": { "dept-uuid": [...projects] },
  "defaultProject": { "id": "uuid", "name": "Project A" },
  "hasMultipleDepartments": true
}
```

**Filtering:**
- Department Admin: All department projects
- Manager/Member: Only assigned projects

### POST /api/switch-department
**Purpose:** Switch user's active department and rebuild JWT

**Authorization:** Bearer token (JWT)

**Request:**
```json
{
  "departmentId": "uuid-of-new-department"
}
```

**Returns:**
```json
{
  "token": "new-jwt-token",
  "department": {
    "id": "uuid",
    "name": "Marketing",
    "role": "Manager"
  },
  "hasMultipleDepartments": true
}
```

**Validation:**
- Verifies user has access to requested department via `user_department_roles`
- Returns 403 if no access

### GET /api/get-all-projects
**Purpose:** Get all accessible projects for dropdown/listing

**Authorization:** Bearer token (JWT)

**Query Params:**
- `format=dropdown` - Returns simplified format
- `search=term` - Filter by name/description

**Filtering:**
- Uses `department_role` from JWT
- Department Admin: All department projects
- Manager: Only assigned projects
- Member: Only assigned projects

### GET /api/get-dashboard-metrics
**Purpose:** Get dashboard metrics and recent activity

**Authorization:** Bearer token (JWT)

**Query Params:**
- `project_id` - Filter by specific project
- `status_id` - Filter by status
- `priority_id` - Filter by priority
- `page` - Pagination page number
- `limit` - Items per page

**Filtering:**
- All metrics filtered by current department from JWT
- Department Admin sees department-wide metrics
- Manager/Member see only their project metrics

---

## Testing Checklist

### Pre-Testing Setup:
- [ ] Ensure users exist in multiple departments
- [ ] Verify `user_department_roles` table has multiple entries per user
- [ ] Confirm projects are linked to departments via `project_department`

### Test Cases:

#### 1. **Login with Multiple Departments**
- [ ] User with 2+ departments logs in
- [ ] First department (earliest created_at) is selected automatically
- [ ] JWT contains correct department_id and department_role
- [ ] Dashboard shows department-scoped data

#### 2. **Department Switcher UI**
- [ ] Department switcher appears in navbar dropdown
- [ ] Positioned above "Sign out" button
- [ ] Shows current department name
- [ ] Only visible if `hasMultipleDepartments === true`
- [ ] User with 1 department doesn't see switcher

#### 3. **Department Switch**
- [ ] Click department switcher
- [ ] Select different department
- [ ] JWT rebuilds with new department context
- [ ] Page refreshes and shows new department data
- [ ] Project dropdown updates with new department projects
- [ ] Dashboard metrics update to new department

#### 4. **Department Admin Role**
- [ ] Login as Department Admin
- [ ] Verify all department projects visible in dropdown
- [ ] Dashboard shows all department tickets and metrics
- [ ] Can access all department projects

#### 5. **Department Manager Role**
- [ ] Login as Department Manager
- [ ] Verify only assigned projects visible in dropdown
- [ ] Dashboard shows only assigned project metrics
- [ ] Cannot see other department projects

#### 6. **Regular User Role**
- [ ] Login as regular user (Member)
- [ ] Verify only assigned projects visible
- [ ] Dashboard shows only personal metrics
- [ ] Limited project access

#### 7. **Cross-Department Testing**
- [ ] User in Dept A + Dept B
- [ ] Switch from Dept A to Dept B
- [ ] Project list updates correctly
- [ ] Dashboard metrics update correctly
- [ ] Switch back to Dept A - data reverts

#### 8. **JWT Validation**
- [ ] JWT includes department_id after login
- [ ] JWT includes department_role after login
- [ ] JWT updates after department switch
- [ ] Old JWT becomes invalid after switch (optional)
- [ ] API calls use new JWT successfully

---

## Known Limitations

1. **Single Active Department**: User can only view one department at a time. No multi-department aggregate view.

2. **Department Creation Order**: First department is selected based on `created_at` in `user_department_roles`, not alphabetical or other sorting.

3. **Page Refresh Required**: Department switch triggers full page reload to ensure all components reload with new context.

4. **No Department-Level Permissions**: Currently uses global_roles. Future enhancement: department-specific role definitions.

5. **Project Ownership**: Projects belong to departments via `project_department` table (one-to-many relationship). A project can belong to multiple departments through this table.

---

## Future Enhancements

1. **Department-Specific Roles**: Custom role definitions per department (e.g., "Engineering Admin" vs "Marketing Admin")

2. **Multi-Department View**: Aggregate dashboard showing data from all user's departments

3. **Department Preferences**: Remember user's last selected department in database

4. **Department Switching Without Reload**: Use state management to switch departments without full page refresh

5. **Department Activity Log**: Track when users switch departments for audit purposes

6. **Department Permissions**: Fine-grained permissions per department (beyond Admin/Manager/Member)

7. **Shared Projects UI**: Better visualization of projects shared across departments

8. **Department Analytics**: Department-specific reporting and analytics dashboards

---

## Troubleshooting

### Department Switcher Not Appearing
**Check:**
- `hasMultipleDepartments` in authStore (should be true)
- User has entries in `user_department_roles` for multiple departments
- JWT includes `hasMultipleDepartments` claim

### Projects Not Showing After Department Switch
**Check:**
- `project_department` table links projects to the selected department
- User has `user_project` entries if they're a Manager/Member
- JWT `department_id` matches the selected department

### Dashboard Shows No Data
**Check:**
- Current department has projects in `project_department`
- User's role in department (Admin should see all, Manager/Member only assigned)
- JWT includes correct `department_role`
- API calls include Authorization header with new token

### JWT Not Updating After Switch
**Check:**
- `switch-department` API returns new token
- Frontend calls `switchDepartment` in authStore
- localStorage contains updated token
- Page refresh occurred after switch

---

## Developer Notes

### Adding New Department-Aware APIs
When creating new APIs that should respect department context:

1. Extract department context from JWT:
```typescript
const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
const currentDepartmentId = decoded.department_id;
const departmentRole = decoded.department_role;
```

2. Filter queries by department:
```typescript
if (departmentRole === 'Admin' && currentDepartmentId) {
  // Get all department projects
  const { data: deptProjects } = await supabase
    .from('project_department')
    .select('project_id')
    .eq('department_id', currentDepartmentId);
  
  query = query.in('project_id', projectIds);
} else {
  // Get only assigned projects
  query = query
    .from('user_project')
    .eq('user_id', userId);
}
```

3. Always prioritize `department_role` over org role:
```typescript
const effectiveRole = departmentRole || projectRole || orgRole || 'Member';
```

### State Management Pattern
The department switch follows the same pattern as project switch:
- Clear local cache
- Update token
- Update current context (department/project)
- Refresh UI

This ensures consistency across context switching mechanisms.

---

## Conclusion

The multi-department system is now fully implemented with:
- ✅ JWT-based department context
- ✅ Department switcher UI in navbar
- ✅ Role-based project visibility (Admin sees all, Manager sees assigned)
- ✅ Department-scoped dashboard metrics
- ✅ Smooth department switching with JWT rebuild
- ✅ Backward compatible with single-department users

All APIs respect department context from JWT, and the UI dynamically shows/hides the department switcher based on user's department count.
