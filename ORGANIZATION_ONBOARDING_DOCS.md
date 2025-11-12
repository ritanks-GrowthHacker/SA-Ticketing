# Organization Onboarding System Documentation

## Overview
The organization onboarding system provides a complete registration, email verification, and authentication flow for organizations. It includes department association and proper security measures.

## Database Schema Changes

### Organizations Table Enhancements
The organizations table has been enhanced with the following fields:
- `username` (VARCHAR, UNIQUE): Unique username for organization login
- `password_hash` (VARCHAR): Hashed password using bcryptjs
- `org_email` (VARCHAR, UNIQUE): Organization email address
- `mobile_number` (VARCHAR): Organization contact phone number
- `otp` (VARCHAR): One-time password for email verification
- `otp_expiry` (TIMESTAMP): OTP expiration timestamp
- `otp_verified` (BOOLEAN): Email verification status
- `associated_departments` (UUID[]): Array of department IDs associated with the organization

### Departments Table (Globalized)
- Removed `organization_id` dependency
- Now serves as global department catalog
- Standard departments pre-populated: IT, HR, Finance, Operations, Marketing, Sales, Customer Support, Legal, Procurement, Quality Assurance

## API Endpoints

### 1. Organization Registration
**Endpoint:** `POST /api/org-onboarding`

**Request Body:**
```json
{
  "orgName": "Tech Solutions Ltd",
  "username": "techsolutions",
  "orgEmail": "admin@techsolutions.com", 
  "password": "SecurePassword123!",
  "mobileNumber": "+1234567890",
  "selectedDepartments": ["uuid1", "uuid2"]
}
```

**Features:**
- Username and email uniqueness validation
- Department ID validation against global departments table
- Password hashing with bcryptjs (12 rounds)
- OTP generation with 15-minute expiry
- Email verification sending via OTPService
- Complete organization record creation

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Organization created successfully. Please check your email for verification code.",
  "organizationId": "uuid-here",
  "requiresVerification": true,
  "orgEmail": "admin@techsolutions.com"
}
```

### 2. Email Verification
**Endpoint:** `POST /api/org-verify-email`

**Request Body:**
```json
{
  "orgEmail": "admin@techsolutions.com",
  "otp": "123456"
}
```

**Features:**
- OTP validation and expiry checking
- Organization activation upon successful verification
- OTP cleanup after verification

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Organization email verified successfully. You can now login.",
  "verified": true
}
```

### 3. Organization Login
**Endpoint:** `POST /api/org-login`

**Request Body:**
```json
{
  "username": "techsolutions",
  "password": "SecurePassword123!"
}
```

**Features:**
- Username-based authentication
- Password verification with bcrypt
- Email verification status check
- Organization active status check
- JWT token generation

**Response (Success - 200):**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "organization": {
    "id": "uuid-here",
    "name": "Tech Solutions Ltd",
    "username": "techsolutions",
    "org_email": "admin@techsolutions.com",
    "is_active": true,
    "otp_verified": true,
    "associated_departments": ["uuid1", "uuid2"]
  }
}
```

### 4. Get Available Departments
**Endpoint:** `GET /api/get-departments`

**Features:**
- Returns all active departments from global departments table
- Used for department selection during registration

**Response (Success - 200):**
```json
{
  "success": true,
  "departments": [
    {
      "id": "uuid1",
      "name": "Information Technology",
      "description": "IT and software development",
      "is_active": true
    },
    {
      "id": "uuid2", 
      "name": "Human Resources",
      "description": "Employee management and recruitment",
      "is_active": true
    }
  ]
}
```

## Security Features

1. **Password Security:**
   - Minimum 8 characters required
   - Hashed using bcryptjs with 12 rounds
   - Stored as password_hash, never plain text

2. **Email Verification:**
   - 6-digit OTP generation
   - 15-minute expiry window
   - Email sent via OTPService
   - Required before login access

3. **Input Validation:**
   - Username and email uniqueness checks
   - Department ID validation
   - Required field validation
   - SQL injection prevention via parameterized queries

4. **JWT Authentication:**
   - Secure token generation
   - Organization data embedded in token
   - Expiration handling

## Testing

Use the provided test files:
- `test-org-onboarding-flow.http`: Complete registration and login flow tests
- `test-get-departments.http`: Department listing tests

## Flow Diagram

```
1. Register Organization (POST /api/org-onboarding)
   ↓
2. Receive Email with OTP
   ↓  
3. Verify Email (POST /api/org-verify-email)
   ↓
4. Login with Username/Password (POST /api/org-login)
   ↓
5. Receive JWT Token for Authenticated Access
```

## Error Handling

The system provides comprehensive error handling for:
- Duplicate usernames/emails
- Invalid department selections
- Expired or invalid OTPs
- Authentication failures
- Database connection issues
- Email sending failures

## Database Connection

All APIs use the consistent `supabase` client pattern from `@/app/db/connections` to ensure proper database connectivity and avoid connection errors.

## Integration Notes

- Uses existing OTPService for email functionality
- Compatible with existing JWT authentication system
- Department system now supports cross-organization sharing
- Ready for integration with existing user and project management systems

## Next Steps

1. Frontend organization registration form
2. Email verification UI component  
3. Organization dashboard integration
4. Department-based role management
5. Organization user management system