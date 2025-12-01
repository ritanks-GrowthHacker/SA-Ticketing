# Attendance Tracking - Simplified Setup 🚀

## Bilkul Simple Approach!

**NO USER-EMPLOYEE MAPPING NEEDED!** ✅

Directly ticketing system ke `user_id` ko HRM database mein `employee_id` ki tarah use kar rahe hain!

## Setup Steps

### 1. HRM Database mein Table Banao

```bash
# Connect to HRM database (port 5433)
psql -h localhost -p 5433 -U postgres -d human_resource_module
```

Then run:
```sql
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,  -- Yeh directly user_id hai ticketing system se!
  date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  work_hours VARCHAR(10),
  status VARCHAR(50) DEFAULT 'Present',
  location_check_in VARCHAR(255),
  location_check_out VARCHAR(255),
  ip_address_check_in VARCHAR(45),
  ip_address_check_out VARCHAR(45),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_unique_employee_date UNIQUE (employee_id, date)
);

CREATE INDEX idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);
```

Ya phir directly file run karo:
```bash
database-updates/create-simple-attendance-table.sql
```

### 2. Check .env File

```env
NEXT_PUBLIC_POSTGRES_URL_HRM=postgresql://postgres:your_password@localhost:5433/human_resource_module
```

### 3. Test Karo!

1. Login karo kisi bhi dashboard mein
2. "Check In" button dikhai dega header mein
3. Click karo → attendance record ban jayega
4. Baad mein "Check Out" karo → work hours calculate ho jayega

## How It Works

### Check-In Flow
```
User clicks "Check In" 
   ↓
JWT token se user_id nikalo
   ↓
Directly employee_id = user_id
   ↓
attendance table mein insert karo:
   - employee_id: user_id
   - date: today
   - check_in_time: current time
   ↓
Done! ✅
```

### Check-Out Flow
```
User clicks "Check Out"
   ↓
JWT token se user_id nikalo
   ↓
employee_id = user_id se find karo today ka record
   ↓
Update karo:
   - check_out_time: current time
   - work_hours: (check_out - check_in) / hours
   ↓
Done! ✅
```

## API Endpoints

### 1. Check-In/Check-Out
```typescript
POST /api/hrm/attendance/mark
Headers: { Authorization: Bearer <token> }
Body: { action: 'check-in' }  // or 'check-out'

Response:
{
  success: true,
  message: "Checked in successfully",
  attendance: {
    id: "uuid",
    checkInTime: "2025-12-02T10:00:00Z",
    date: "2025-12-02"
  }
}
```

### 2. Get Status
```typescript
GET /api/hrm/attendance/status
Headers: { Authorization: Bearer <token> }

Response:
{
  hasCheckedIn: true,
  hasCheckedOut: false,
  checkInTime: "2025-12-02T10:00:00Z",
  checkOutTime: null,
  workHours: null,
  status: "Present"
}
```

## Database Queries

### Today's Attendance
```sql
SELECT 
  employee_id as user_id,
  date,
  check_in_time,
  check_out_time,
  work_hours,
  status
FROM public.attendance
WHERE date = CURRENT_DATE
ORDER BY check_in_time;
```

### Specific User ka Attendance
```sql
SELECT * FROM public.attendance
WHERE employee_id = 'USER_UUID_HERE'
ORDER BY date DESC
LIMIT 30;
```

### Work Hours Report
```sql
SELECT 
  employee_id,
  DATE_TRUNC('month', date) as month,
  COUNT(*) as days_worked,
  SUM(work_hours::decimal) as total_hours
FROM public.attendance
WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY employee_id, DATE_TRUNC('month', date);
```

## Button Placement

✅ **Ticketing Dashboards**:
- Admin Dashboard - Header (next to Export Data)
- Manager Dashboard - Header (before Create Ticket)
- User Dashboard - Header (before Create Ticket)

✅ **Sales Dashboards**:
- Admin Dashboard - Header (before Transactions button)
- Manager Dashboard - Header (before view selector)
- Member Dashboard - Header (before Add Client)

## Troubleshooting

### "relation attendance does not exist"
**Fix**: Run the SQL migration file
```bash
database-updates/create-simple-attendance-table.sql
```

### Button not showing
**Fix**: Check imports in dashboard files
```typescript
import { AttendanceCheckInOut } from '@/components/AttendanceCheckInOut';
```

### Check-in not working
**Fix**: 
1. Check HRM database connection in .env
2. Verify JWT token has user_id
3. Check browser console for errors

## Files Changed

- ✅ `app/api/hrm/attendance/mark/route.ts` - Simplified (no mapping)
- ✅ `app/api/hrm/attendance/status/route.ts` - Simplified (no mapping)  
- ✅ `components/AttendanceCheckInOut.tsx` - Button component
- ✅ All 6 dashboards - Component added
- ✅ `database-updates/create-simple-attendance-table.sql` - Migration

## What We Removed

❌ `user_employee_mapping` table - NOT NEEDED!
❌ Complex mapping queries - NOT NEEDED!
❌ Separate employee records - NOT NEEDED!

Bas directly user_id ko employee_id bana diya! Simple! 🎉

---
**Last Updated**: December 2, 2025  
**Status**: ✅ READY TO USE
