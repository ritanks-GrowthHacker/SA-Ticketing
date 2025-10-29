# Role-Based Access Control (RBAC) Implementation

## Overview
The Ticketing Metrix system implements a comprehensive Role-Based Access Control system with three primary user roles: **Admin**, **Manager**, and **User**. Each role has specific permissions and access to different dashboard views.

## User Roles

### 🔴 Admin
**Full organization access and management capabilities**

**Dashboard Features:**
- Complete organization overview
- Project-wise filtering dropdown 
- All projects and tickets visibility
- Organization-wide statistics
- Team management capabilities

**Permissions:**
- ✅ Create projects
- ✅ Manage all users
- ✅ View all tickets across organization
- ✅ Access full analytics
- ✅ Export organizational data
- ✅ Assign tickets
- ✅ Manage all teams
- ✅ View organizational data

**Quick Actions:**
- Create New Ticket
- Start New Project  
- Manage Users
- View Analytics

### 🟡 Manager
**Project-specific management for assigned projects**

**Dashboard Features:**
- Project-specific overview
- Only assigned projects in dropdown
- Team member management for assigned projects
- Project-specific statistics and tickets
- Team performance tracking

**Permissions:**
- ❌ Create new projects (only manage assigned ones)
- ❌ Manage all users (only team members)
- ❌ View all organization tickets (only project tickets)
- ✅ View project analytics
- ✅ Export project data
- ✅ Assign tickets within project
- ✅ Manage project team
- ❌ View organizational data

**Quick Actions:**
- Create Ticket
- Manage Team
- Project Analytics

### 🟢 User (Developer/Employee)
**Personal ticket management and limited access**

**Dashboard Features:**
- Personal ticket overview
- Own assigned tickets only
- Personal progress tracking
- Individual performance metrics
- Weekly goal tracking

**Permissions:**
- ❌ Create projects
- ❌ Manage users
- ❌ View other users' tickets (only own tickets)
- ✅ View personal analytics only
- ❌ Export organizational data
- ❌ Assign tickets to others
- ❌ Manage teams
- ❌ View organizational data

**Quick Actions:**
- Create New Ticket
- View Analytics (personal)

## Implementation Details

### File Structure
```
app/
├── dashboard/
│   ├── page.tsx                 # Main RBAC router
│   └── components/
│       ├── AdminDashboard.tsx   # Admin-specific dashboard
│       ├── ManagerDashboard.tsx # Manager-specific dashboard
│       └── UserDashboard.tsx    # User-specific dashboard
├── rbac-test/
│   └── page.tsx                 # Role testing interface
lib/
└── rbac.ts                      # RBAC utilities and permissions
```

### Key Components

#### 1. Main Dashboard Router (`/dashboard/page.tsx`)
```typescript
const renderDashboard = () => {
  const userRole = role?.toLowerCase() || '';
  
  switch (userRole) {
    case 'admin':
    case 'administrator':
      return <AdminDashboard />;
    
    case 'manager':
    case 'project manager':
    case 'team lead':
    case 'technical lead':
      return <ManagerDashboard />;
    
    case 'user':
    case 'developer':
    case 'employee':
    case 'member':
    default:
      return <UserDashboard />;
  }
};
```

#### 2. RBAC Utilities (`/lib/rbac.ts`)
- `normalizeRole()`: Handles role name variations
- `getRolePermissions()`: Returns permission object for role
- `hasPermission()`: Checks specific permissions
- `getDashboardType()`: Maps roles to dashboard types

#### 3. Role Testing (`/rbac-test`)
- Interactive role switching for testing
- Permission matrix visualization
- Dashboard preview links

## Usage Examples

### Check Permissions
```typescript
import { hasPermission } from '@/lib/rbac';

// Check if user can create projects
const canCreate = hasPermission(userRole, 'canCreateProjects');

// Get all permissions for a role
const permissions = getRolePermissions('manager');
```

### Role-based Rendering
```typescript
import { useAuth } from '../store/authStore';

const { role } = useAuth();

{hasPermission(role, 'canManageUsers') && (
  <UserManagementButton />
)}
```

## Dashboard Differences

### Data Scope
| Feature | Admin | Manager | User |
|---------|-------|---------|------|
| **Tickets** | All organization tickets | Project tickets only | Own tickets only |
| **Projects** | All projects | Assigned projects only | None (view only) |
| **Users** | All organization users | Team members only | Own profile only |
| **Analytics** | Organization-wide | Project-specific | Personal only |

### UI Elements
| Element | Admin | Manager | User |
|---------|-------|---------|------|
| **Project Filter** | All projects dropdown | Assigned projects only | None |
| **Export Button** | ✅ Full data | ✅ Project data | ❌ Not available |
| **Create Project** | ✅ Available | ❌ Not available | ❌ Not available |
| **Manage Users** | ✅ All users | ✅ Team only | ❌ Not available |

## Security Considerations

### Authentication Check
All dashboard components check authentication status before rendering:
```typescript
if (!isAuthenticated || !user) {
  return <LoadingSpinner />;
}
```

### Route Protection
Protected routes are defined in `MainLayout.tsx`:
- Dashboard components only render within authenticated layout
- Unauthenticated users redirected to login

### Data Filtering
- API calls should implement server-side role filtering
- Client-side permissions are for UI only, not security
- Always validate permissions on backend

## Testing

### Using RBAC Test Page
1. Navigate to `/rbac-test`
2. Click different role buttons to simulate login
3. View permission matrix and dashboard differences
4. Click "View Dashboard" to see role-specific interface

### Test Scenarios
- **Admin Test**: All features accessible, organization-wide data
- **Manager Test**: Limited to assigned projects, team management
- **User Test**: Personal tickets only, limited quick actions

## Future Enhancements

- [ ] Dynamic role assignment
- [ ] Custom permissions per user
- [ ] Role hierarchy (Super Admin, etc.)
- [ ] Permission caching
- [ ] Audit logging for role changes
- [ ] Multi-organization role mapping

## API Integration

When integrating with backend APIs, ensure:
1. JWT tokens include role information
2. API endpoints validate permissions server-side
3. Data filtering happens at database level
4. Role changes trigger token refresh