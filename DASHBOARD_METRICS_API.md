# Dashboard Metrics API Documentation

## Endpoint: `/api/get-dashboard-metrics`

### Description
This API provides comprehensive dashboard metrics for Admin and Manager roles with organization-specific data aggregation.

### Method
`GET`

### Authentication
- **Required**: JWT Bearer token in Authorization header
- **Roles Allowed**: Admin, Manager, Team Lead

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | No | Specific project ID for Manager dashboard (filters metrics to that project) |
| `type` | string | No | Metric type: 'overview', 'project', 'team' (default: 'overview') |

### Response Structure

#### Admin Response
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalTickets": {
        "value": 1234,
        "change": "+12%",
        "changeType": "positive"
      },
      "activeProjects": {
        "value": 28,
        "change": "+5%",
        "changeType": "positive"
      },
      "teamMembers": {
        "value": 156,
        "change": "+8%",
        "changeType": "positive"
      },
      "avgResolutionTime": {
        "value": "2.4h",
        "change": "-15%",
        "changeType": "positive"
      }
    },
    "recentActivity": [
      {
        "id": 123,
        "title": "Database connection issue",
        "status": "In Progress",
        "time": "2 mins ago",
        "project": "E-commerce Platform",
        "priority": "High",
        "assignedTo": "Alice Johnson"
      }
    ],
    "chartData": {
      "weekly": [
        { "day": "Mon", "tickets": 5 },
        { "day": "Tue", "tickets": 8 }
      ]
    },
    "quickStats": {}
  },
  "userRole": "admin",
  "organizationId": "org_123"
}
```

#### Manager Response
```json
{
  "success": true,
  "data": {
    "overview": {
      "projectTickets": {
        "value": 47,
        "change": "+8%",
        "changeType": "positive"
      },
      "teamMembers": {
        "value": 12,
        "change": "+1",
        "changeType": "positive"
      },
      "completionRate": {
        "value": "78%",
        "change": "+12%",
        "changeType": "positive"
      },
      "avgResolutionTime": {
        "value": "2.1h",
        "change": "-0.5h",
        "changeType": "positive"
      }
    },
    "recentActivity": [
      {
        "id": 456,
        "title": "Payment gateway integration",
        "status": "In Progress",
        "time": "1 hour ago",
        "priority": "High",
        "assignedTo": "Bob Smith"
      }
    ],
    "chartData": {
      "weekly": [
        { "day": "Mon", "tickets": 2 },
        { "day": "Tue", "tickets": 4 }
      ]
    },
    "quickStats": {
      "projectInfo": {
        "project_id": "1",
        "projects": { "name": "E-commerce Platform" },
        "roles": { "name": "Project Manager" }
      },
      "availableProjects": [
        {
          "id": "1",
          "name": "E-commerce Platform",
          "role": "Project Manager"
        }
      ]
    }
  },
  "userRole": "manager",
  "organizationId": "org_123"
}
```

### Status Codes
- `200`: Success
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient role permissions)
- `500`: Internal Server Error

### Features

#### Admin Metrics
- **Organization-wide data**: All projects, tickets, and team members
- **Growth metrics**: Month-over-month comparisons
- **Recent activity**: Latest tickets across all projects
- **Performance tracking**: Average resolution times

#### Manager Metrics
- **Project-specific data**: Filtered to managed projects
- **Team performance**: Members working on managed projects
- **Completion rates**: Project success metrics
- **Project selection**: Multi-project managers can filter by specific projects

#### Smart Data Aggregation
- **Date ranges**: Automatic current vs previous month/week comparisons
- **Percentage calculations**: Growth indicators with proper formatting
- **Role-based filtering**: Automatic data scope based on user permissions
- **Chart data**: Weekly ticket trends for visualization

### Database Dependencies
- `tickets` table with project relationships
- `projects` table with organization mapping
- `user_organization` and `user_project` for role relationships
- `statuses` and `priorities` for ticket categorization
- JWT token validation with organization and role claims

### Usage Examples

#### Frontend Integration (Admin Dashboard)
```javascript
const fetchDashboardMetrics = async () => {
  const token = localStorage.getItem('authToken');
  const response = await fetch('/api/get-dashboard-metrics', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  return data.data; // Contains all metrics
};
```

#### Frontend Integration (Manager Dashboard with Project)
```javascript
const fetchProjectMetrics = async (projectId) => {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`/api/get-dashboard-metrics?project_id=${projectId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  return data.data;
};
```