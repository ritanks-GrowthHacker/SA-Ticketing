# Project Management API Documentation

## Overview
The `/api/create-project` endpoint provides comprehensive project management functionality for organizations using the ticketing system.

## Endpoints

### POST `/api/create-project`
Creates a new project for the authenticated user's organization.

#### Authentication
Requires JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

#### Request Body
```json
{
  "name": "Project Alpha",                    // Required: Project name
  "description": "Project description"        // Optional: Detailed description
}
```

#### Response (201 Created)
```json
{
  "message": "Project created successfully",
  "project": {
    "id": "project-uuid",
    "name": "Project Alpha",
    "description": "Project description",
    "start_date": "2025-01-15",
    "end_date": "2025-06-30",
    "status": "Planning",
    "priority": "High",
    "budget": 50000.00,
    "created_at": "2025-10-29T12:00:00Z",
    "updated_at": "2025-10-29T12:00:00Z",
    "project_manager": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@company.com"
    },
    "created_by": {
      "id": "creator-uuid",
      "name": "Jane Smith",
      "email": "jane@company.com"
    },
    "organization": {
      "id": "org-uuid",
      "name": "Tech Corp",
      "domain": "techcorp.com"
    }
  }
}
```

### GET `/api/create-project`
Retrieves projects for the authenticated user's organization with filtering and pagination.

#### Query Parameters
- `page`: Page number (default: 1, min: 1)
- `limit`: Items per page (default: 10, min: 1, max: 100)
- `search`: Search in project name and description

#### Example Request
```
GET /api/create-project?page=1&limit=20&status=Active&priority=High&search=alpha
```

#### Response (200 OK)
```json
{
  "message": "Projects retrieved successfully",
  "projects": [
    {
      "id": "project-uuid",
      "name": "Project Alpha",
      "description": "Project description",
      "start_date": "2025-01-15",
      "end_date": "2025-06-30",
      "status": "Active",
      "priority": "High",
      "budget": 50000.00,
      "created_at": "2025-10-29T12:00:00Z",
      "updated_at": "2025-10-29T12:00:00Z",
      "project_manager": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@company.com"
      },
      "created_by": {
        "id": "creator-uuid",
        "name": "Jane Smith",
        "email": "jane@company.com"
      },
      "organization": {
        "id": "org-uuid",
        "name": "Tech Corp",
        "domain": "techcorp.com"
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_count": 47,
    "limit": 10,
    "has_next_page": true,
    "has_previous_page": false
  },
  "filters": {
    "status": "Active",
    "priority": "High",
    "project_manager_id": null,
    "search": "alpha"
  }
}
```

## Permissions

### Project Creation (POST)
- **Admin**: Can create projects and assign any user as project manager
- **Manager**: Can create projects and assign any user as project manager
- **Member**: Not allowed
- **Viewer**: Not allowed
- **Master Organization**: Can create projects for any organization
- **Regular Organization**: Can only create projects for their own organization

### Project Viewing (GET)
- **All roles**: Can view all projects within their organization
- **Master Organization**: Can view projects from any organization with `organization_id` parameter
- **Regular Organization**: Can only view projects from their own organization

## Validation Rules

### Project Name
- Required field
- Maximum 255 characters
- Must be unique within the organization

### Dates
- Must be in ISO format (YYYY-MM-DD)
- End date must be after start date
- Both dates are optional

### Budget
- Must be a positive number
- Maximum value: 999,999,999

### Project Manager
- Must be a valid user ID
- User must belong to the same organization
- Defaults to the project creator if not specified

## Error Responses

### 400 Bad Request
```json
{
  "error": "Project name is required"
}
```

### 401 Unauthorized
```json
{
  "error": "Authorization token is required"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions. Only Admins and Managers can create projects"
}
```

### 409 Conflict
```json
{
  "error": "A project with this name already exists in your organization"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error"
}
```

## Usage Examples

### Using the API Client (React)
```typescript
import { useApiClient } from '@/app/store/apiClient'

function ProjectForm() {
  const { createProject, getProjects } = useApiClient()

  // Create a project
  const handleCreateProject = async () => {
    try {
      const result = await createProject({
        name: "New Project",
        description: "Project description",
        start_date: "2025-01-15",
        end_date: "2025-06-30",
        priority: "High",
        budget: 25000
      })
      console.log('Project created:', result.project)
    } catch (error) {
      console.error('Failed to create project:', error.message)
    }
  }

  // Get projects with filters
  const handleGetProjects = async () => {
    try {
      const result = await getProjects({
        page: 1,
        limit: 20,
        status: 'Active',
        search: 'alpha'
      })
      console.log('Projects:', result.projects)
      console.log('Pagination:', result.pagination)
    } catch (error) {
      console.error('Failed to get projects:', error.message)
    }
  }
}
```

### Direct API Call (JavaScript)
```javascript
// Create project
const createProject = async (projectData, token) => {
  const response = await fetch('/api/create-project', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(projectData)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error)
  }
  
  return response.json()
}

// Get projects
const getProjects = async (params, token) => {
  const url = new URL('/api/create-project', window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString())
    }
  })

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error)
  }
  
  return response.json()
}
```

## Database Schema (Expected)
The API expects a `projects` table with the following structure:

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status VARCHAR(100) DEFAULT 'Planning',
  priority VARCHAR(100) DEFAULT 'Medium',
  budget DECIMAL(12,2),
  project_manager_id UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(name, organization_id)
);
```

## Security Features

1. **JWT Authentication**: All requests require valid JWT tokens
2. **Organization Isolation**: Users can only access projects from their organization
3. **Role-based Access Control**: Different permissions based on user roles
4. **Input Validation**: Comprehensive validation of all input data
5. **SQL Injection Prevention**: Using parameterized queries
6. **XSS Prevention**: Proper data sanitization