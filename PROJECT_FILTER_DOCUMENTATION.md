# Project Filter Integration Documentation

## Overview
This implementation adds comprehensive project filtering functionality to both Admin and Manager dashboards using shadcn/ui Select components and role-based project access.

## API Endpoints

### GET /api/get-all-projects
Returns projects based on user role and permissions.

#### Query Parameters:
- `format=dropdown` - Returns simplified format for dropdowns
- `search` - Filter projects by name/description
- `includeStats=true` - Include project statistics (tickets, completion rate, etc.)

#### Role-based Access:
- **Admin**: Can see all projects in the organization
- **Manager**: Can see only projects they are assigned to
- **User/Team Lead**: Can see only projects they are assigned to

#### Response Format (dropdown):
```json
{
  "message": "Projects retrieved successfully",
  "projects": [
    {
      "id": "project-uuid",
      "name": "Project Name",
      "value": "project-uuid", 
      "label": "Project Name"
    }
  ],
  "totalCount": 5
}
```

#### Response Format (full):
```json
{
  "message": "Projects retrieved successfully",
  "projects": [
    {
      "id": "project-uuid",
      "name": "Project Name",
      "description": "Project description",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "created_by": {
        "id": "user-uuid",
        "name": "Creator Name",
        "email": "creator@example.com"
      },
      "organization": {
        "id": "org-uuid",
        "name": "Organization Name",
        "domain": "org.com"
      },
      "user_role_in_project": "Manager",
      "stats": {
        "totalTickets": 25,
        "openTickets": 10,
        "completedTickets": 15,
        "teamMembers": 5,
        "completionRate": 60
      }
    }
  ],
  "totalCount": 5,
  "userRole": "Admin"
}
```

## Components

### ProjectSelect Component
Location: `components/ui/ProjectSelect.tsx`

A reusable dropdown component that fetches and displays projects based on user permissions.

#### Props:
- `value: string` - Current selected project ID
- `onValueChange: (value: string) => void` - Callback for selection changes
- `placeholder?: string` - Placeholder text (default: "Select project")
- `includeAllOption?: boolean` - Include "All Projects" option (default: true)
- `disabled?: boolean` - Disable the select
- `className?: string` - Additional CSS classes

#### Features:
- Automatic project fetching based on user role
- Loading and error states
- Search support (future enhancement)
- Proper accessibility with shadcn/ui Select

### Dashboard Integration

#### AdminDashboard
- Shows "All Projects" option by default
- Can filter metrics by specific project
- Uses auth store for token management
- Updates metrics when project filter changes

#### ManagerDashboard  
- Shows only assigned projects
- Can filter to specific managed project or view all assigned projects
- Displays "Manager" role badge
- Integrated with team management

## Database Schema

The implementation relies on these key tables:
- `projects` - Main project information
- `user_project` - Project assignments and roles
- `user_organization` - User organization membership
- `tickets` - For project statistics

## Authentication & Authorization

Uses JWT tokens with the following claims:
- `sub` - User ID
- `org_id` - Organization ID
- `role` - Primary user role
- `roles` - Array of all user roles

Role hierarchy for project access:
1. **Admin** - Full access to all organization projects
2. **Manager** - Access to assigned projects only
3. **Team Lead/User** - Access to assigned projects only

## Usage Examples

### Basic Implementation
```tsx
import { ProjectSelect } from '@/components/ui/ProjectSelect';

const [selectedProject, setSelectedProject] = useState('all');

<ProjectSelect
  value={selectedProject}
  onValueChange={setSelectedProject}
  placeholder="Select project to filter"
  includeAllOption={true}
/>
```

### Integration with Metrics
```tsx
useEffect(() => {
  const fetchMetrics = async () => {
    const url = selectedProject && selectedProject !== 'all' 
      ? `/api/get-dashboard-metrics?project_id=${selectedProject}`
      : '/api/get-dashboard-metrics';
      
    // Fetch and update metrics
  };
  
  fetchMetrics();
}, [selectedProject]);
```

## Error Handling

The implementation includes comprehensive error handling:
- Authentication errors (401)
- Authorization errors (403) 
- Network errors with user-friendly messages
- Loading states during data fetching
- Empty state when no projects found

## Performance Considerations

- Projects are cached in component state after first fetch
- Dropdown format reduces payload size
- Statistics are only fetched when explicitly requested
- Efficient database queries with proper indexing on foreign keys

## Security Features

- JWT token validation on every request
- Role-based access control
- Organization-scoped data access
- No sensitive information in dropdown responses
- Input sanitization for search parameters

## Testing

Use the provided test file `test-get-all-projects.http` to verify:
- Admin can see all projects
- Manager sees only assigned projects
- Search functionality works
- Error handling for invalid tokens
- Proper response formats

## Future Enhancements

1. **Search Integration**: Add real-time search in ProjectSelect
2. **Caching**: Implement React Query for better caching
3. **Pagination**: Add pagination for organizations with many projects
4. **Favorites**: Allow users to favorite frequently used projects
5. **Project Templates**: Support for project templates and categories