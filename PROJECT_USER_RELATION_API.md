# Project User Relations API Documentation

## Overview
The `/api/create-project-user-relation` endpoint manages user assignments to projects with role-based permissions and optional email notifications.

## Endpoints

### POST /api/create-project-user-relation
Assign users to a project with specific roles.

#### Authentication
- Requires JWT token in `Authorization: Bearer <token>` header
- Only **Admin** and **Manager** roles can assign users
- **Managers** can only assign users to projects they are assigned to
- **Admins** can assign users to any project in their organization

#### Request Body
```json
{
  "project_id": "string (required)",
  "assignments": [
    {
      "user_id": "string (required)",
      "role_id": "string (required)"
    }
  ],
  "notify": "boolean (optional, default: true)"
}
```

#### Response (200 OK)
```json
{
  "message": "Assignments processed successfully",
  "assignments": [
    {
      "user_id": "uuid",
      "project_id": "uuid",
      "role_id": "uuid", 
      "created_by": "uuid",
      "updated_by": "uuid",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

#### Error Responses
- **400 Bad Request**: Missing or invalid request body
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Insufficient permissions or Manager trying to assign to unmanaged project
- **404 Not Found**: Project not found
- **500 Internal Server Error**: Database or system error

### DELETE /api/create-project-user-relation
Remove users from a project.

#### Authentication
- Requires JWT token in `Authorization: Bearer <token>` header
- Only **Admin** and **Manager** roles can remove users
- **Managers** can only remove users from projects they are assigned to
- **Admins** can remove users from any project in their organization

#### Request Body
```json
{
  "project_id": "string (required)",
  "user_ids": ["string"] // array of user IDs to remove (required)
}
```

#### Response (200 OK)
```json
{
  "message": "Users removed from project successfully",
  "removed": [
    {
      "user_id": "uuid",
      "project_id": "uuid",
      "role_id": "uuid",
      "created_by": "uuid",
      "updated_by": "uuid",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ],
  "removed_count": 2
}
```

#### Error Responses
- **400 Bad Request**: Missing or invalid request body
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Insufficient permissions or Manager trying to remove from unmanaged project
- **404 Not Found**: Project not found
- **500 Internal Server Error**: Database or system error

## Database Schema

### Tables Used
- `user_project` - Main assignment table
  - `user_id` (UUID, FK to users)
  - `project_id` (UUID, FK to projects)
  - `role_id` (UUID, FK to roles)
  - `created_by` (UUID, FK to users)
  - `updated_by` (UUID, FK to users)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
  - **Unique constraint**: `(user_id, project_id)`

- `user_organization` - Used for permission validation
- `projects` - Used for project validation
- `roles` - Used for role validation
- `users` - Used for email notifications

## Business Rules

### Permission Matrix
| Role | Can Assign To | Can Remove From |
|------|---------------|-----------------|
| Admin | Any org project | Any org project |
| Manager | Assigned projects only | Assigned projects only |
| User | None | None |
| Team Lead | None | None |

### Assignment Logic
1. **Update-or-Insert**: If user is already assigned to the project, their role is updated
2. **Organization Scoping**: All users must belong to the same organization as the requester
3. **Project Validation**: Project must exist and belong to the requester's organization
4. **Role Validation**: Role IDs must exist in the roles table

### Email Notifications
- Sent when `notify: true` (default)
- Uses `sendTeamAssignmentEmail` function
- Includes project name, role name, and assignee name
- Failures are logged but don't block the assignment

## Example Usage

### Assign Multiple Users (Admin)
```bash
curl -X POST http://localhost:3000/api/create-project-user-relation \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "assignments": [
      {
        "user_id": "660e8400-e29b-41d4-a716-446655440001",
        "role_id": "770e8400-e29b-41d4-a716-446655440002"
      },
      {
        "user_id": "880e8400-e29b-41d4-a716-446655440003",
        "role_id": "990e8400-e29b-41d4-a716-446655440004"
      }
    ],
    "notify": true
  }'
```

### Remove Users from Project (Admin)
```bash
curl -X DELETE http://localhost:3000/api/create-project-user-relation \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_ids": [
      "660e8400-e29b-41d4-a716-446655440001",
      "880e8400-e29b-41d4-a716-446655440003"
    ]
  }'
```

### Manager Assignment (Restricted)
```bash
curl -X POST http://localhost:3000/api/create-project-user-relation \
  -H "Authorization: Bearer <manager_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "assignments": [
      {
        "user_id": "660e8400-e29b-41d4-a716-446655440001",
        "role_id": "770e8400-e29b-41d4-a716-446655440002"
      }
    ]
  }'
```

## Error Handling

### Common Error Scenarios

#### 1. Manager Trying to Assign to Unmanaged Project
**Request**: Manager token + project they're not assigned to
**Response**: `403 Forbidden`
```json
{
  "error": "Managers can only assign users to projects they are assigned to"
}
```

#### 2. Invalid Project ID
**Request**: Non-existent project_id
**Response**: `404 Not Found`
```json
{
  "error": "Project not found"
}
```

#### 3. User Outside Organization
**Request**: Assigning user from different organization
**Response**: Assignment skipped with warning in logs

#### 4. Missing Required Fields
**Request**: Missing project_id or assignments
**Response**: `400 Bad Request`
```json
{
  "error": "project_id is required"
}
```

#### 5. Insufficient Permissions
**Request**: User or Team Lead trying to assign
**Response**: `403 Forbidden`
```json
{
  "error": "Insufficient permissions. Only Admins and Managers can assign users to projects"
}
```

## Security Considerations

1. **JWT Validation**: All requests validated against JWT secret
2. **Organization Scoping**: Users can only manage projects in their organization
3. **Role-Based Access**: Strict permission checking based on user roles
4. **Input Validation**: All request parameters validated before processing
5. **SQL Injection Prevention**: Using parameterized queries via Supabase client
6. **Rate Limiting**: Consider implementing rate limiting for production use

## Performance Notes

1. **Batch Operations**: Multiple assignments processed efficiently
2. **Database Transactions**: Consider wrapping in transactions for atomicity
3. **Email Queue**: Consider using email queue for production to avoid blocking
4. **Caching**: Role and project lookups could be cached for better performance

## Testing

Use the provided `test-project-user-relation.http` file to test all scenarios:
- Valid assignments by Admin and Manager
- Permission violations
- Invalid data scenarios
- Error handling paths
- Authentication failures

## Future Enhancements

1. **Bulk Operations**: Add endpoint for bulk project assignments
2. **Assignment History**: Track assignment changes over time
3. **Notifications**: Add in-app notifications alongside email
4. **Validation Rules**: Add custom validation rules per organization
5. **Assignment Templates**: Pre-defined role sets for common project types