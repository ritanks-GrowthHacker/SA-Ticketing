# Project-Based Role System - Implementation Summary

## ✅ Changes Completed

### 1. JWT Structure Updated

#### **Login API (verify-login-otp/route.ts)**
**Changes:**
- JWT now includes `project_id`, `project_name`, `project_role` as dominant role
- `org_role` included for profile display only
- All departments included in JWT as array
- Default project selection prioritizes user_project table

**New JWT Payload:**
```typescript
{
  sub: userId,
  email: user.email,
  name: user.name,
  org_id: organization.id,
  org_name: organization.name,
  org_domain: organization.domain,
  org_role: role?.name || "Member", // For profile display only
  project_id: defaultProject?.id || null,
  project_name: defaultProject?.name || null,
  project_role: defaultProjectRole, // THIS IS THE DOMINANT ROLE
  role: defaultProjectRole, // Alias for compatibility
  roles: [defaultProjectRole],
  departments: allDepartments, // All departments user is part of
  department_id: currentDepartment?.id || null,
  department_name: currentDepartment?.name || null,
  department_role: currentDepartmentRole,
  iss: process.env.JWT_ISSUER,
}
```

#### **Switch Project API (switch-project/route.ts)**
**Changes:**
- Preserves org_role from old token
- Sets project_role as dominant
- Maintains department context
- Preserves all departments array

---

### 2. Frontend State Management (authStore.ts)

**AuthState Interface Updated:**
```typescript
export interface AuthState {
  organization: Organization & { role?: string } | null // Added role for org-level display
  role: string | null // Active role (project role if available, else org role)
  allDepartments: Array<{ id: string; name: string; role: string }> // All user departments
  currentProject: {
    id: string
    name: string
    role: string // THIS IS THE DOMINANT ROLE
  } | null
}
```

**Login Action Updated:**
- Accepts project data in login parameters
- Stores allDepartments array
- Sets currentProject with role

---

### 3. Role Priority Changes

#### **Sidebar (components/ui/sidebar.tsx)**
**Before:**
```typescript
const effectiveRole = currentDepartment?.role || currentProject?.role || role || 'User';
```

**After:**
```typescript
const effectiveRole = currentProject?.role || currentDepartment?.role || role || 'User';
```

#### **Manage Access (app/manage-access/page.tsx)**
**Before:**
```typescript
const effectiveRole = currentDepartment?.role || currentProject?.role || role || 'User';
```

**After:**
```typescript
const effectiveRole = currentProject?.role || currentDepartment?.role || role || 'User';
```

#### **Dashboard (app/dashboard/page.tsx)**
**Before:**
```typescript
const effectiveRole = currentProject?.role || departmentRole || resolvedRoleName || orgLevelRole || 'Member';
```

**After:**
```typescript
const effectiveRole = projectRole || currentProject?.role || resolvedRoleName || departmentRole || orgLevelRole || 'Member';
```
Where `projectRole = decoded.project_role` from JWT (DOMINANT)

---

### 4. Login Flow Updated (app/user-login/page.tsx)

**Before:**
```typescript
authLogin({
  user: data.user,
  organization: data.organization,
  role: data.role,
  roles: data.roles,
  token: data.token
})
```

**After:**
```typescript
authLogin({
  user: data.user,
  organization: data.organization,
  role: data.role, // Project role (dominant)
  roles: data.roles,
  token: data.token,
  project: data.project || null,
  department: data.department || null,
  departments: data.departments || [],
  hasMultipleDepartments: data.hasMultipleDepartments || false
})
```

---

## 📋 System Behavior

### Role Hierarchy (New)
1. **Project Role** (Dominant) - Used for access control in dashboards, manage access, etc.
2. **Department Role** (Fallback) - Used if no project assigned
3. **Organization Role** (Profile Only) - Displayed in user profile, not used for access control

### Login Flow
1. User enters email → OTP sent
2. User verifies OTP → Backend:
   - Finds all user departments
   - Finds first assigned project (from user_project table)
   - Gets user's role in that project
   - Generates JWT with project role as dominant
3. Frontend stores project context
4. Dashboard renders based on project role

### Project Switching
1. User selects different project from dropdown
2. API verifies user access to project
3. Gets user's role in selected project
4. Generates new JWT with new project role
5. Dashboard updates based on new role

### Multi-Project Support
- User can be assigned to multiple projects with different roles
- User can be Manager in Project A, Member in Project B
- Dashboard changes when switching projects

### Multi-Department Support
- User can be part of multiple departments
- All departments stored in JWT as array
- Department switching preserved (doesn't affect project role)

---

## 🎯 What Works Now

✅ **Login**: Users get default project with project role in JWT  
✅ **Project Switching**: JWT updates with new project role  
✅ **Dashboard Rendering**: Based on project role from JWT  
✅ **Sidebar Navigation**: Shows tabs based on project role  
✅ **Manage Access**: Uses project role for permission checks  
✅ **Multi-Project**: Users can have different roles in different projects  
✅ **Multi-Department**: Users can be part of multiple departments  

---

## 🔧 Still TODO (Based on Original Requirements)

### 1. ❌ Manage Access Revamp (Per-Project)
**Current State**: Still works at organization level  
**Required**:
- Manage Access should work PER PROJECT
- Show only users eligible for assignment (exclude Sales, HR, Administration)
- Add "Request Resource" feature for restricted departments
- Build resource request approval workflow

### 2. ❌ Resource Request System
**Tables**: `resource_requests` exists in schema  
**APIs Needed**:
- POST `/api/submit-resource-request`
- GET `/api/get-resource-requests`
- POST `/api/handle-resource-request` (approve/reject)

**UI Needed**:
- "Request Resource" button in Manage Access
- Modal to select department (Sales/HR/Admin), user, role
- Admin page to view/approve/reject requests

### 3. ❌ Get All Projects API Update
**Current**: Filters projects by department  
**Required**: Show ALL projects user is assigned to (query user_project table)

### 4. ❌ Dashboard Metrics API Update
**Current**: May still filter by department  
**Required**: Filter by project_id from JWT

### 5. ❌ Profile Page
**Required**: Show org_role (not project role)  
**Verify**: Profile displays organization-level role for informational purposes

---

## 🧪 Testing Checklist

### Login & JWT
- [x] User logs in → Gets default project in JWT
- [x] JWT contains `project_id`, `project_role`, `org_role`
- [x] JWT contains all user departments
- [ ] Test user with NO projects assigned

### Project Switching
- [x] User switches project → JWT updates with new project role
- [x] Dashboard changes based on new project role
- [ ] If user is Manager in Project A, sees ManagerDashboard
- [ ] If user is Member in Project B, sees MemberDashboard

### Dashboard
- [x] Role priority: project_role > department_role > org_role
- [ ] ManagerDashboard shows data for selected project only
- [ ] MemberDashboard shows data for selected project only
- [ ] AdminDashboard shows data for selected project only

### Sidebar & Navigation
- [x] Sidebar uses project role for permission checks
- [x] Manage Access tab shows for project Managers/Admins
- [ ] All tabs respect project role

### Manage Access
- [x] Uses project role for permission checks
- [ ] Shows users for SELECTED PROJECT only (not implemented yet)
- [ ] Can assign users from eligible departments (not implemented yet)
- [ ] Can request resources from Sales/HR/Admin (not implemented yet)

---

## 📁 Files Modified

1. **app/api/verify-login-otp/route.ts** - Login JWT with project role
2. **app/api/switch-project/route.ts** - Preserve org_role, set project_role
3. **app/store/authStore.ts** - Updated state and login action
4. **app/user-login/page.tsx** - Pass project/department data to authStore
5. **components/ui/sidebar.tsx** - Project role priority
6. **app/manage-access/page.tsx** - Project role priority
7. **app/dashboard/page.tsx** - Project role from JWT as dominant

---

## 🚀 Next Steps (In Order)

1. **Update Get All Projects API**
   - Query `user_project` table to get all projects for user
   - Include user's role in each project

2. **Update Dashboard Metrics API**
   - Read `project_id` and `project_role` from JWT
   - Filter data by project, not department

3. **Revamp Manage Access Page**
   - Work per-project (select project first)
   - Show users from eligible departments
   - Exclude Sales, HR, Administration departments

4. **Build Resource Request System**
   - Create resource request APIs
   - Add "Request Resource" UI in Manage Access
   - Build admin approval workflow

5. **Test Everything**
   - Multi-project role switching
   - Dashboard data filtering
   - Resource requests end-to-end

---

## 📖 Migration Plan Reference

See `PROJECT_ROLE_MIGRATION_PLAN.md` for complete detailed plan.

