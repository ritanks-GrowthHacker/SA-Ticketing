# Project-Based Role System Migration Plan

## Overview
Migrating from Department-Based Roles to Project-Based Roles as the dominant role system.

## Current Architecture (Department-Based)
- User → Department → Role in Department
- JWT contains: `department_id`, `department_role`
- Dashboard renders based on department role
- Department role is dominant

## New Architecture (Project-Based) ✅
- User → Multiple Departments → Multiple Projects → Role per Project
- JWT contains: `project_id`, `project_role`, `org_role` (for display only)
- Dashboard renders based on **project role**
- Project role is dominant
- Organizational role is for profile display only

---

## Phase 1: Update JWT Structure

### 1.1 Modify Login API (`verify-login-otp/route.ts`)
**Current JWT Payload:**
```typescript
{
  sub: userId,
  org_id: organizationId,
  department_id: departmentId,
  department_role: "Admin",
  role: "Manager",
  roles: ["Manager"]
}
```

**New JWT Payload:**
```typescript
{
  sub: userId,
  org_id: organizationId,
  org_role: "Admin", // For profile display only
  project_id: defaultProjectId,
  project_name: "Project Name",
  project_role: "Manager", // THIS IS DOMINANT
  role: "Manager", // Alias for project_role for compatibility
  roles: ["Manager"],
  departments: [
    { id: "dept1", name: "Engineering" },
    { id: "dept2", name: "Design" }
  ]
}
```

**Changes Needed:**
- ✅ Get user's first project (or default project)
- ✅ Get user's role in that project from `user_project` table
- ✅ Include all user departments in JWT
- ✅ Set `project_role` as the dominant role
- ✅ Set `org_role` for profile display only

### 1.2 Update Switch Project API (`switch-project/route.ts`)
**Already Done! ✅**
- Already fetches user's role for the selected project
- Already generates new JWT with project context
- Just needs to ensure `project_role` is set in JWT

---

## Phase 2: Update Database Queries

### 2.1 Dashboard Metrics API (`get-dashboard-metrics/route.tsx`)
**Current:** Filters by `department_id` from JWT
**New:** Filters by `project_id` from JWT

**Changes:**
- Read `project_id` and `project_role` from JWT (not department)
- Filter tickets by project
- Show stats for selected project only

### 2.2 Get All Projects API (`get-all-projects/route.tsx`)
**Current:** Filters projects by department
**New:** Shows all projects user is assigned to (from `user_project` table)

**Changes:**
- Query `user_project` table to get all projects for user
- Include user's role in each project
- Filter out projects user doesn't have access to

### 2.3 Create Tickets API (`create-tickets/route.tsx`)
**Current:** Uses department role for permissions
**New:** Uses project role for permissions

**Changes:**
- Check `project_role` from JWT (not department role)
- Verify user has Manager/Admin role in the **current project**
- Allow ticket creation only in current project

---

## Phase 3: Update Frontend Components

### 3.1 Dashboard Components
**ManagerDashboard.tsx, MemberDashboard.tsx, AdminDashboard.tsx**

**Current:** Reads `currentDepartment.role`
**New:** Reads `currentProject.role`

**Changes:**
- Use `currentProject.role` instead of `currentDepartment.role`
- Switch dashboards when project changes (not department)
- Remove department switching logic from dashboards

### 3.2 Auth Store (`store/authStore.ts`)
**Changes:**
- Update `currentProject` structure to include `role`
- Remove dominant `currentDepartment.role`
- Add `organizationRole` for profile display
- Update `switchProject` to update JWT with new project role

### 3.3 Sidebar (`components/ui/sidebar.tsx`)
**Changes:**
- Read role from `currentProject.role` (not department)
- Show "Manage Access" for project Managers/Admins

### 3.4 Project Filter Dropdown
**Changes:**
- Show all projects user is assigned to (not just department projects)
- Display user's role in each project
- Trigger JWT refresh when project changes

---

## Phase 4: Manage Access Revamp

### 4.1 Manage Access Page (`manage-access/page.tsx`)
**Current:** Shows all users in organization
**New:** Shows project-specific user assignment

**Major Changes:**
1. **Project Selection Required**
   - User must select a project from dropdown
   - Cannot use "All Projects" view anymore
   - Manage access for ONE project at a time

2. **Department Filtering**
   - Show users from ALL departments EXCEPT:
     - Sales
     - Human Resource
     - Administration
   - These three departments require resource requests

3. **Assign Users to Project**
   - Select users from eligible departments
   - Assign project role: Manager, Admin, Member
   - Save to `user_project` table

4. **Resource Requests (New Feature)**
   - Button: "Request Resource from Sales/HR/Admin"
   - Modal opens to select:
     - Department (Sales/HR/Administration)
     - Employee from that department
     - Project role to assign
     - Message/reason
   - Creates entry in `resource_requests` table
   - Org admin approves/rejects

### 4.2 Resource Request System (New)

**New Table: `resource_requests`**
```sql
CREATE TABLE resource_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  requester_id UUID NOT NULL REFERENCES users(id),
  requested_user_id UUID NOT NULL REFERENCES users(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  requested_role_id UUID NOT NULL REFERENCES global_roles(id),
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints:**
- POST `/api/submit-resource-request` - Manager submits request
- GET `/api/get-resource-requests` - Get pending requests
- POST `/api/handle-resource-request` - Admin approves/rejects

**Workflow:**
1. Manager opens Manage Access for their project
2. Clicks "Request Resource"
3. Selects department (Sales/HR/Administration)
4. Selects employee from that department
5. Selects role (Manager/Member)
6. Adds message
7. Submits request
8. Org Admin sees request in "Requests" page
9. Approves → User added to project with role
10. Rejects → Request marked as rejected

---

## Phase 5: Create Project Workflow

### 5.1 Who Can Create Projects?
**Org Roles that can create projects:**
- Admin (Org-level)
- Manager (Org-level or Dept-level)

**When project is created:**
- Creator becomes Project Admin
- Saved in `user_project` table with Admin role
- Creator can now manage team via Manage Access

### 5.2 Project Creation Flow
1. User has Org role = Admin or Manager
2. Clicks "Create Project"
3. Enters project details
4. Project created
5. User automatically assigned as Project Admin
6. Can now manage team via Manage Access

---

## Phase 6: Testing Checklist

### Login & JWT
- [ ] User logs in → Gets default project in JWT
- [ ] JWT contains `project_id`, `project_role`, `org_role`
- [ ] JWT contains all user departments

### Project Switching
- [ ] User switches project → JWT updates with new project role
- [ ] Dashboard changes based on new project role
- [ ] If user is Manager in Project A, sees ManagerDashboard
- [ ] If user is Member in Project B, sees MemberDashboard

### Dashboard
- [ ] ManagerDashboard shows data for selected project only
- [ ] MemberDashboard shows data for selected project only
- [ ] AdminDashboard shows data for selected project only
- [ ] No department role checks, only project role

### Manage Access
- [ ] Manager can manage users for their project
- [ ] Shows users from Engineering, Design, Marketing, etc. (not Sales/HR/Admin)
- [ ] Can assign users to project with roles
- [ ] Can request resources from Sales/HR/Administration
- [ ] Resource requests create pending entries

### Resource Requests
- [ ] Manager submits resource request
- [ ] Org Admin sees request in Requests page
- [ ] Org Admin approves → User added to project
- [ ] Org Admin rejects → Request marked rejected

### Profile
- [ ] Profile shows `org_role` (Admin/Manager/Member)
- [ ] Profile does NOT use this for access control
- [ ] Only for display purposes

---

## Migration Steps (In Order)

1. ✅ **Create resource_requests table**
2. ✅ **Update JWT structure in login API**
3. ✅ **Update switch-project API (already done)**
4. ✅ **Update dashboard APIs to use project_id**
5. ✅ **Update frontend Auth Store**
6. ✅ **Update dashboard components**
7. ✅ **Update sidebar**
8. ✅ **Revamp Manage Access page**
9. ✅ **Create resource request APIs**
10. ✅ **Add resource request UI**
11. ✅ **Update create project flow**
12. ✅ **Test everything**

---

## Rollback Plan

If something breaks:
1. Revert JWT structure changes
2. Revert dashboard role checks
3. Keep resource request feature (it's additive, won't break)
4. Test with old department-based system

---

## Notes

- This is a **major architectural change**
- Will affect **every** role-based check in the application
- Must be implemented **step by step**
- Each step must be tested before moving to next
- Keep department data intact (users can still be in departments)
- Departments are just for organizational structure, not access control

