# Enhanced User Profile System

## Overview
A comprehensive profile management system for SA-Ticketing that supports all user personas (Admin, Manager, Member) with enhanced profile features including profile pictures and about sections.

## Database Changes

### New Columns Added to Users Table
- `profile_picture_url` (TEXT): URL or path to user's profile picture
- `about` (TEXT): User biography/description section
- `phone` (VARCHAR(20)): Contact phone number
- `location` (VARCHAR(255)): Physical location/address
- `job_title` (VARCHAR(255)): Professional job title
- `department` (VARCHAR(255)): Department/team assignment
- `date_of_birth` (DATE): Date of birth for profile information
- `profile_updated_at` (TIMESTAMP): Tracks profile-specific updates

### Database Migration
Run the following SQL file to update your database:
```sql
-- Execute this file to add the new profile columns
\i database-updates/add-user-profile-fields.sql
```

### Indexes Created
- `idx_users_profile_picture`: For profile picture lookups
- `idx_users_job_title`: For job title searches
- `idx_users_department`: For department filtering
- `idx_users_location`: For location-based searches

## API Endpoints

### GET /api/get-user-profile
Retrieves the current user's complete profile information.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "user-uuid",
    "name": "John Doe", 
    "email": "john@company.com",
    "profilePicture": "https://example.com/avatar.jpg",
    "about": "Software developer with 5 years experience...",
    "phone": "+1234567890",
    "location": "San Francisco, CA",
    "jobTitle": "Senior Developer",
    "department": "Engineering",
    "dateOfBirth": "1990-01-01",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z",
    "profileUpdatedAt": "2023-01-01T00:00:00.000Z",
    "organization": {
      "id": "org-uuid",
      "name": "Company Name", 
      "domain": "company.com"
    },
    "role": "Admin"
  }
}
```

### PUT /api/update-user-profile
Updates the current user's profile information.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "newemail@company.com", 
  "profilePictureUrl": "https://example.com/new-avatar.jpg",
  "about": "Updated bio text...",
  "phone": "+1234567890",
  "location": "New York, NY",
  "jobTitle": "Lead Developer", 
  "department": "Engineering",
  "dateOfBirth": "1990-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "profile": { /* updated profile object */ }
}
```

## Features

### For All User Personas (Admin, Manager, Member)
- ✅ **Profile Picture Management**: Upload and display profile pictures
- ✅ **Personal Information**: Name, email, phone, location editing
- ✅ **Professional Details**: Job title, department management
- ✅ **About Section**: Rich text bio/description area
- ✅ **Security Settings**: Password change and 2FA options (existing)
- ✅ **Preferences**: Notifications and theme settings (existing)
- ✅ **Role Display**: Shows user's role and organization
- ✅ **Profile History**: Tracks when profile was last updated

### Profile Page Enhancements
- Real-time editing with save/cancel functionality
- Separate editing modes for different sections
- Success/error message handling
- Responsive design for all screen sizes
- Integration with existing auth system

## File Structure

### Database
- `db/schema.sql` - Updated with new user profile columns
- `database-updates/add-user-profile-fields.sql` - Migration script
- `db/types.ts` - Updated TypeScript interfaces

### API Routes
- `app/api/get-user-profile/route.tsx` - Get profile endpoint
- `app/api/update-user-profile/route.tsx` - Update profile endpoint

### Frontend
- `app/profile/page.tsx` - Enhanced profile management page

## Security Features

### Data Protection
- JWT token validation for all profile operations
- Organization-based access control
- Email uniqueness validation
- Profile update timestamp tracking

### Access Control
- Users can only view/edit their own profiles
- Organization isolation (users only see their org data)
- Role-based permissions preserved from existing system

## Usage Examples

### Updating Profile Information
```typescript
const updateProfile = async (profileData: UpdateProfileRequest) => {
  const response = await fetch('/api/update-user-profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profileData)
  });
  
  if (response.ok) {
    const result = await response.json();
    console.log('Profile updated:', result.profile);
  }
};
```

### Fetching Profile Data
```typescript
const getProfile = async () => {
  const response = await fetch('/api/get-user-profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    const result = await response.json();
    return result.profile;
  }
};
```

## Integration Notes

### Existing System Compatibility
- Fully compatible with existing authentication system
- Preserves all current user roles and permissions
- Maintains organization-based access control
- Does not affect existing user login/registration flow

### Future Enhancements
- Profile picture upload to cloud storage (S3, Cloudinary)
- Social media profile links
- Skills and expertise sections
- Profile visibility settings
- Export profile data functionality

## Installation

1. Run the database migration:
```bash
psql -d your_database -f database-updates/add-user-profile-fields.sql
```

2. Restart your application server to load new API endpoints

3. The enhanced profile page is immediately available at `/profile`

## Testing

Test the profile system by:
1. Logging in as different user types (Admin, Manager, Member)
2. Updating profile information and verifying saves
3. Testing the About section editing functionality
4. Verifying profile picture placeholder display
5. Checking responsive design on mobile devices