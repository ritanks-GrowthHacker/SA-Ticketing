# Attendance Tracking Feature Documentation

## Overview
The attendance tracking system allows users to check-in and check-out from all dashboards (ticketing, sales admin, sales manager, sales member). It integrates with the HRM database and automatically calculates work hours.

## Architecture

### Components
1. **AttendanceCheckInOut Component** (`components/AttendanceCheckInOut.tsx`)
   - Reusable button component
   - Shows current status (Checked In / Checked Out)
   - Displays check-in time, check-out time, and work hours
   - Auto-updates state based on current attendance

2. **HRM Database Schema** (`db/hrm-schema.ts`)
   - `attendance` table: Stores daily attendance records
   - `userEmployeeMapping` table: Links ticketing users to HRM employees
   - `hrActivityLogs` table: Audit trail for HRM operations

3. **API Endpoints**
   - `POST /api/hrm/attendance/mark` - Check-in / Check-out
   - `GET /api/hrm/attendance/status` - Get current attendance status

### Database Structure

#### HRM Database (`human_resource_module` - Port 5433)

**user_employee_mapping** table:
```sql
CREATE TABLE public.user_employee_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                    -- From ticketing system
  employee_id UUID NOT NULL,                -- From employees table
  organization_id UUID NOT NULL,            -- Organization context
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, organization_id)
);
```

**attendance** table (already exists in hrDb.sql):
```sql
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL,
  date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  work_hours DECIMAL(5,2),
  status VARCHAR(50),
  location_check_in VARCHAR(255),
  location_check_out VARCHAR(255),
  ip_address_check_in VARCHAR(45),
  ip_address_check_out VARCHAR(45),
  UNIQUE (employee_id, date)
);
```

## Setup Instructions

### 1. Database Setup

#### Run Migration
Connect to the HRM database (port 5433) and run:
```bash
psql -h localhost -p 5433 -U postgres -d human_resource_module -f database-updates/create-user-employee-mapping.sql
```

Or use pgAdmin / DBeaver to execute the SQL file.

### 2. Create Employee Records

First, create employee records in the `employees` table:

```sql
INSERT INTO public.employees (employee_code, first_name, last_name, email, hire_date, employment_type, job_title)
VALUES 
  ('EMP001', 'ritank', 's', 'ritank1998@gmail.com', CURRENT_DATE, 'Full-Time', 'Developer'),
  ('EMP002', 'ritank', '', 'fashion.rupali72@gmail.com', CURRENT_DATE, 'Full-Time', 'Developer'),
  ('EMP003', 'Prajwal', '', 'prajwalhemanth5@gmail.com', CURRENT_DATE, 'Full-Time', 'Developer');
```

### 3. Create User-Employee Mappings

Link ticketing system users to HRM employees:

```sql
INSERT INTO public.user_employee_mapping (user_id, employee_id, organization_id)
SELECT 
  'a2c7b541-5397-477e-8c74-033f4d308dd7'::uuid, -- User ID from ticketing system
  e.id,                                          -- Employee ID from employees table
  '8ce7d8ae-c60f-41e4-a567-0722ab86bf39'::uuid -- Organization ID
FROM public.employees e
WHERE e.email = 'ritank1998@gmail.com'
UNION ALL
SELECT 
  '836b1b5b-72ec-446c-8173-23f4e83fe462'::uuid,
  e.id,
  '8ce7d8ae-c60f-41e4-a567-0722ab86bf39'::uuid
FROM public.employees e
WHERE e.email = 'fashion.rupali72@gmail.com'
UNION ALL
SELECT 
  '250b4a4d-a959-4f01-8480-015261c1e5ce'::uuid,
  e.id,
  '8ce7d8ae-c60f-41e4-a567-0722ab86bf39'::uuid
FROM public.employees e
WHERE e.email = 'prajwalhemanth5@gmail.com'
ON CONFLICT (user_id, organization_id) DO NOTHING;
```

### 4. Environment Variables

Ensure `.env` file has the HRM database connection:

```env
NEXT_PUBLIC_POSTGRES_URL_HRM=postgresql://postgres:your_password@localhost:5433/human_resource_module
```

## Implementation Details

### Component Integration

The `AttendanceCheckInOut` component has been added to:

✅ **Ticketing Dashboards**:
- `app/dashboard/components/AdminDashboard.tsx` (line 506 - next to Export Data)
- `app/dashboard/components/ManagerDashboard.tsx` (line 481 - before Create Ticket)
- `app/dashboard/components/UserDashboard.tsx` (line 453 - before Create Ticket)

✅ **Sales Dashboards**:
- `app/sales/admin-dashboard/page.tsx` (line 276 - header section)
- `app/sales/manager-dashboard/page.tsx` (line 265 - header section)
- `app/sales/member-dashboard/page.tsx` (line 182 - header section)

### API Flow

#### Check-In Flow
1. User clicks "Check In" button
2. Component calls `POST /api/hrm/attendance/mark` with `action: 'check-in'`
3. API validates JWT token and extracts `userId` and `organizationId`
4. API fetches employee ID from `user_employee_mapping`
5. API checks if attendance record exists for today
6. If no record exists, creates new attendance record with `checkInTime`
7. Returns success response
8. Component updates UI to show "Check Out" button and check-in time

#### Check-Out Flow
1. User clicks "Check Out" button
2. Component calls `POST /api/hrm/attendance/mark` with `action: 'check-out'`
3. API validates token and fetches employee ID
4. API checks existing attendance record
5. API calculates work hours: `(checkOutTime - checkInTime) / (1000 * 60 * 60)`
6. API updates attendance record with `checkOutTime` and `workHours`
7. Returns success response with work hours
8. Component displays "Checked Out" (disabled) and work hours

#### Status Check
1. Component loads: calls `GET /api/hrm/attendance/status?date=YYYY-MM-DD`
2. API returns current status: `{ hasCheckedIn, hasCheckedOut, checkInTime, checkOutTime, workHours }`
3. Component determines button state based on response

### Work Hours Calculation

```typescript
const workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
// Example: 9 AM to 6 PM = 9 hours
```

Stored as `DECIMAL(5,2)` in database (e.g., 8.50 hours)

## Button States

1. **Check In** (Green) - No attendance record for today
   ```
   📍 Check In
   ```

2. **Check Out** (Blue) - Checked in but not checked out
   ```
   🚪 Check Out
   Check-in: 09:00 AM
   ```

3. **Checked Out** (Gray, Disabled) - Already checked out
   ```
   ✓ Checked Out
   Check-in: 09:00 AM
   Check-out: 06:00 PM
   Work Hours: 9.00 hours
   ```

## Error Handling

### Missing User-Employee Mapping
```json
{
  "error": "User-employee mapping not found. Please contact HR."
}
```
**Solution**: Create mapping record in `user_employee_mapping` table

### Double Check-In
```json
{
  "error": "Already checked in today"
}
```
**Behavior**: User must check out before checking in again

### Check-Out Without Check-In
```json
{
  "error": "No check-in record found for today"
}
```
**Behavior**: User must check in first

## Database Queries

### View Today's Attendance
```sql
SELECT 
  a.id,
  e.employee_code,
  e.first_name || ' ' || e.last_name as name,
  a.date,
  a.check_in_time,
  a.check_out_time,
  a.work_hours,
  a.status
FROM public.attendance a
JOIN public.employees e ON a.employee_id = e.id
WHERE a.date = CURRENT_DATE
ORDER BY a.check_in_time;
```

### View User's Attendance History
```sql
SELECT 
  a.date,
  a.check_in_time,
  a.check_out_time,
  a.work_hours,
  a.status
FROM public.attendance a
JOIN public.user_employee_mapping m ON a.employee_id = m.employee_id
WHERE m.user_id = 'USER_UUID_HERE'
ORDER BY a.date DESC
LIMIT 30;
```

### Monthly Work Hours Report
```sql
SELECT 
  e.employee_code,
  e.first_name || ' ' || e.last_name as name,
  DATE_TRUNC('month', a.date) as month,
  COUNT(*) as days_worked,
  SUM(a.work_hours) as total_hours,
  AVG(a.work_hours) as avg_hours_per_day
FROM public.attendance a
JOIN public.employees e ON a.employee_id = e.id
WHERE DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY e.employee_code, e.first_name, e.last_name, DATE_TRUNC('month', a.date)
ORDER BY total_hours DESC;
```

## Testing Checklist

- [ ] Create employee records in HRM database
- [ ] Create user-employee mappings
- [ ] Test check-in on ticketing dashboard
- [ ] Test check-in on sales dashboard
- [ ] Verify attendance record created in database
- [ ] Test check-out functionality
- [ ] Verify work hours calculation
- [ ] Refresh page and verify button shows correct state
- [ ] Test multiple users checking in/out independently
- [ ] Test checking in on different days
- [ ] Verify unique constraint (one attendance per employee per day)
- [ ] Test error handling (no mapping, double check-in, etc.)

## Future Enhancements

1. **Location Tracking**: Auto-capture location on check-in/out (already in schema)
2. **IP Address Logging**: Track IP addresses (already in schema)
3. **Late Arrival Alerts**: Flag late check-ins based on shift times
4. **Leave Integration**: Sync with leave requests
5. **Reports Dashboard**: Visual reports for HR personnel
6. **Mobile App**: Check-in via mobile device
7. **Geofencing**: Restrict check-in to office location
8. **Notifications**: Remind users to check-out

## Troubleshooting

### Button Not Showing
- Check component is imported in dashboard file
- Verify component is added to JSX
- Check for TypeScript/compilation errors

### "relation user_employee_mapping does not exist"
- Run migration: `database-updates/create-user-employee-mapping.sql`
- Verify connected to HRM database (port 5433)

### "User-employee mapping not found"
- Create employee record in `employees` table
- Create mapping in `user_employee_mapping` table
- Verify user_id and organization_id match JWT token

### Work Hours Not Calculating
- Verify both check_in_time and check_out_time are set
- Check database column type is DECIMAL(5,2)
- Verify calculation logic in API

## File References

- Component: `components/AttendanceCheckInOut.tsx`
- Schema: `db/hrm-schema.ts`
- Helper: `lib/hrm-db-helper.ts`
- APIs: 
  - `app/api/hrm/attendance/mark/route.ts`
  - `app/api/hrm/attendance/status/route.ts`
- Migration: `database-updates/create-user-employee-mapping.sql`
- Full Schema: `hrDb.sql`

## Support

For issues or questions, check:
1. Browser console for errors
2. Server logs for API errors
3. Database logs for query errors
4. This documentation for setup steps

---
**Last Updated**: December 2, 2025
**Version**: 1.0.0
