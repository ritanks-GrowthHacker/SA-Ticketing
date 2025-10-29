# Postman Collection - Ticketing Metrix Project API

## Prerequisites
1. First, you need to authenticate and get a JWT token
2. Replace `{{baseUrl}}` with `http://localhost:3000`
3. Replace `{{token}}` with your actual JWT token

---

## 1. Authentication (Get JWT Token First)

### Login User
**Method:** POST  
**URL:** `{{baseUrl}}/api/user-login`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "email": "john@techcorp.com",
  "password": "your-password"
}
```

**Expected Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@techcorp.com"
  },
  "organization": {
    "id": "org-uuid",
    "name": "Tech Corp",
    "domain": "techcorp.com"
  },
  "role": {
    "id": "role-uuid",
    "name": "Admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> **Note:** Copy the `token` value and use it in all subsequent requests

---

## 2. Project Management API Requests

### A. Create Project (Basic)
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

**Body (JSON):**
```json
{
  "name": "Website Redesign Project",
  "description": "Complete overhaul of the company website with modern UI/UX design"
}
```

### B. Create Project (Complete)
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

**Body (JSON):**
```json
{
  "name": "Mobile App Development",
  "description": "Cross-platform mobile application for iOS and Android"
}
```

### C. Create Project (Minimum Required)
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

**Body (JSON):**
```json
{
  "name": "Quick Task Project"
}
```

### D. Create Project for Another Organization (Master Org Only)
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

**Body (JSON):**
```json
{
  "name": "Client Website Project",
  "description": "Website development for client organization",
  "organization_id": "client-organization-uuid",
  "project_manager_id": "client-user-uuid",
  "start_date": "2025-11-15",
  "end_date": "2025-02-15",
  "status": "Planning",
  "priority": "High",
  "budget": 75000.00
}
```

> **Note:** This requires the authenticated user to belong to a master organization

---

## 3. Get Projects (Various Scenarios)

### A. Get All Projects (Default)
**Method:** GET  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Authorization": "Bearer {{token}}"
}
```

### B. Get Projects with Pagination
**Method:** GET  
**URL:** `{{baseUrl}}/api/create-project?page=1&limit=5`

**Headers:**
```json
{
  "Authorization": "Bearer {{token}}"
}
```

### C. Get Projects with Status Filter
**Method:** GET  
**URL:** `{{baseUrl}}/api/create-project?status=Planning`

**Headers:**
```json
{
  "Authorization": "Bearer {{token}}"
}
```

### D. Get Projects with Priority Filter
**Method:** GET  
**URL:** `{{baseUrl}}/api/create-project?priority=High`

**Headers:**
```json
{
  "Authorization": "Bearer {{token}}"
}
```

### E. Get Projects with Search
**Method:** GET  
**URL:** `{{baseUrl}}/api/create-project?search=website`

**Headers:**
```json
{
  "Authorization": "Bearer {{token}}"
}
```

### F. Get Projects with Multiple Filters
**Method:** GET  
**URL:** `{{baseUrl}}/api/create-project?page=1&limit=10&status=Active&priority=High&search=mobile`

**Headers:**
```json
{
  "Authorization": "Bearer {{token}}"
}
```

### G. Get Projects by Project Manager
**Method:** GET  
**URL:** `{{baseUrl}}/api/create-project?project_manager_id=replace-with-user-id`

**Headers:**
```json
{
  "Authorization": "Bearer {{token}}"
}
```

### H. Get Projects from Specific Organization (Master Org Only)
**Method:** GET  
**URL:** `{{baseUrl}}/api/create-project?organization_id=target-org-uuid`

**Headers:**
```json
{
  "Authorization": "Bearer {{token}}"
}
```

### I. Get Projects with Organization Filter and Other Filters
**Method:** GET  
**URL:** `{{baseUrl}}/api/create-project?organization_id=target-org-uuid&status=Active&priority=High&page=1&limit=10`

**Headers:**
```json
{
  "Authorization": "Bearer {{token}}"
}
```

---

## 4. Test Error Scenarios

### A. Create Project without Authentication
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "name": "Test Project"
}
```

**Expected Response (401):**
```json
{
  "error": "Authorization token is required"
}
```

### B. Create Project with Invalid Token
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer invalid-token-here"
}
```

**Body (JSON):**
```json
{
  "name": "Test Project"
}
```

**Expected Response (401):**
```json
{
  "error": "Invalid or expired token"
}
```

### C. Create Project without Name
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

**Body (JSON):**
```json
{
  "description": "Project without name"
}
```

**Expected Response (400):**
```json
{
  "error": "Project name is required"
}
```

### D. Create Project with Invalid Dates
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

**Body (JSON):**
```json
{
  "name": "Invalid Dates Project",
  "start_date": "2025-06-30",
  "end_date": "2025-01-15"
}
```

**Expected Response (400):**
```json
{
  "error": "End date must be after start date"
}
```

### E. Create Duplicate Project Name
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

**Body (JSON):**
```json
{
  "name": "Website Redesign Project"
}
```

**Expected Response (409):**
```json
{
  "error": "A project with this name already exists in the target organization"
}
```

### F. Non-Master Org Tries to Create Project for Another Org
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

**Body (JSON):**
```json
{
  "name": "Cross Org Project",
  "organization_id": "another-org-uuid"
}
```

**Expected Response (403):**
```json
{
  "error": "Only users from master organizations can create projects for other organizations"
}
```

### G. Invalid Target Organization
**Method:** POST  
**URL:** `{{baseUrl}}/api/create-project`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}"
}
```

**Body (JSON):**
```json
{
  "name": "Invalid Org Project",
  "organization_id": "non-existent-uuid"
}
```

**Expected Response (400):**
```json
{
  "error": "Invalid target organization specified"
}
```

---

## 5. Sample Test Data Projects

### Project 1: E-commerce Platform
```json
{
  "name": "E-commerce Platform",
  "description": "Build a comprehensive e-commerce platform with payment integration",
  "start_date": "2025-11-15",
  "end_date": "2025-08-15",
  "status": "Planning",
  "priority": "Critical",
  "budget": 500000.00
}
```

### Project 2: Data Analytics Dashboard
```json
{
  "name": "Data Analytics Dashboard",
  "description": "Real-time analytics dashboard for business intelligence",
  "start_date": "2025-12-01",
  "end_date": "2025-03-31",
  "status": "Active",
  "priority": "High",
  "budget": 75000.00
}
```

### Project 3: Customer Support System
```json
{
  "name": "Customer Support System",
  "description": "Automated customer support system with AI chatbot integration",
  "start_date": "2025-11-01",
  "end_date": "2025-02-28",
  "status": "Planning",
  "priority": "Medium",
  "budget": 120000.00
}
```

### Project 4: Security Audit
```json
{
  "name": "Security Audit & Compliance",
  "description": "Comprehensive security audit and compliance implementation",
  "start_date": "2025-10-30",
  "end_date": "2025-12-30",
  "status": "Active",
  "priority": "Critical",
  "budget": 80000.00
}
```

### Project 5: API Integration
```json
{
  "name": "Third-party API Integration",
  "description": "Integration with external APIs for enhanced functionality",
  "start_date": "2025-11-10",
  "end_date": "2025-01-31",
  "status": "Planning",
  "priority": "Medium",
  "budget": 45000.00
}
```

---

## 6. Environment Variables for Postman

Create these variables in your Postman environment:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `baseUrl` | `http://localhost:3000` | `http://localhost:3000` |
| `token` | | `paste-your-jwt-token-here` |
| `userId` | | `paste-user-id-here` |

---

## 7. Pre-request Script (Optional)

Add this to your collection's Pre-request Scripts tab to automatically handle token expiration:

```javascript
// Check if token exists
const token = pm.environment.get("token");
if (!token) {
    console.log("No token found. Please login first.");
}

// You can add automatic login logic here if needed
```

---

## 8. Test Scripts (Optional)

Add this to your requests' Tests tab for automatic validation:

```javascript
// Test for successful response
pm.test("Status code is success", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});

// Test response has required fields
if (pm.response.code === 201) {
    pm.test("Project created successfully", function () {
        const jsonData = pm.response.json();
        pm.expect(jsonData).to.have.property('message');
        pm.expect(jsonData).to.have.property('project');
        pm.expect(jsonData.project).to.have.property('id');
        pm.expect(jsonData.project).to.have.property('name');
    });
}

// Save project ID for future requests
if (pm.response.code === 201) {
    const jsonData = pm.response.json();
    pm.environment.set("projectId", jsonData.project.id);
}
```

---

## Quick Testing Workflow

1. **Login** using the login endpoint to get your JWT token
2. **Copy the token** and set it as the `{{token}}` variable
3. **Create a few projects** using the sample payloads above
4. **Test retrieving projects** with different filters
5. **Test error scenarios** to validate error handling

This comprehensive collection will help you thoroughly test all aspects of the Project API!