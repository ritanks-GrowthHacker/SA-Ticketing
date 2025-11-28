# Ticketing System - Supabase to PostgreSQL Migration Progress

## Overview
Migration from Supabase to PostgreSQL using Drizzle ORM for the ticketing system database (`organisation_ticket_sales`).

## ✅ Completed Infrastructure

### Database Setup Files
1. **db/schema.ts** - Complete Drizzle schema with 27 tables
   - ✅ Organizations, Departments, Users, GlobalRoles
   - ✅ Projects (projects, project_statuses, project_docs, project_department, shared_projects)
   - ✅ Tickets (tickets, ticket_comments, statuses, priorities)
   - ✅ Meetings (meetings, meeting_participants, meeting_moms)
   - ✅ User Relations (user_department, user_department_roles, user_organization_roles, user_project)
   - ✅ Support Tables (notifications, tags, entity_tags, attachments, activity_logs, invitations, resource_requests)

2. **db/index.ts** - Database connection
   - ✅ PostgreSQL Pool connection
   - ✅ Drizzle instance with schema
   - ✅ Backward compatibility (exports existing Supabase connections)

3. **drizzle.config.ts** - Drizzle Kit configuration
   - ✅ Schema path: './db/schema.ts'
   - ✅ Output: './drizzle' for migrations
   - ✅ PostgreSQL driver configured

4. **lib/db-helper.ts** - Helper utilities
   - ✅ Re-exports db instance
   - ✅ Exports all 27 table schemas
   - ✅ Exports Drizzle operators (eq, and, or, desc, asc, inArray, sql, isNull)

### Environment Configuration
- Connection String: `postgresql://postgres:root@localhost:5433/organisation_ticket_sales`
- Environment Variable: `NEXT_PUBLIC_POSTGRESQL_URL_TICKET_SYSTEM`

## ✅ Migrated API Routes (15/55 completed - 27.3%)

### 1. `/api/get-eligible-users` ✅

### 1. `/api/get-eligible-users` ✅
**Status:** Fully Migrated
- ✅ Commented out Supabase imports
- ✅ Added Drizzle imports from lib/db-helper
- ✅ Migrated user organization roles query
- ✅ Migrated user department roles query  
- ✅ Migrated users with departments query (with joins)
- ✅ Migrated role fetching queries
- ✅ Fixed column naming (camelCase for Drizzle)
- ✅ No compilation errors

**Changes:**
- `supabase.from('user_organization_roles')` → `db.select().from(userOrganizationRoles)`
- `supabase.from('users').select('..., departments!users_department_id_fkey(...)')` → `db.select().from(users).leftJoin(departments, eq(...))`
- Used `and()` to combine multiple `where` conditions
- Used `inArray()` for filtering by user IDs

### 2. `/api/ticket-comments` ✅  
**Status:** Fully Migrated
- ✅ Updated imports to use Drizzle
- ✅ Migrated `checkTicketAccess()` helper function:
  - ✅ Ticket query with project join
  - ✅ User org roles query
  - ✅ User dept roles query
  - ✅ User department query
  - ✅ Project department query
  - ✅ Shared projects query
  - ✅ User project assignments query
- ✅ Migrated GET method (fetch comments with user info)
- ✅ Migrated POST method:
  - ✅ Parent comment validation
  - ✅ Comment insertion
  - ✅ Comment with user data fetch
  - ✅ Ticket info query for notifications
  - ✅ Recipient user queries
  - ✅ Notification insertion
- ✅ Fixed all camelCase column names
- ✅ Fixed date serialization (toISOString())
- ✅ No compilation errors

**Complex Migrations:**
- Multi-table joins for access control
- Nested queries for user roles (org + department)
- Insert with returning values
- Notification system integration

### 3. `/api/submit-resource-requests` ✅
**Status:** Fully Migrated
- ✅ Updated imports
- ✅ Migrated bulk insert operation
- ✅ Added `.returning()` to get inserted IDs
- ✅ Migrated joined query (resource requests + users + departments)
- ✅ Used `inArray()` for fetching multiple requests
- ✅ No compilation errors

**Key Features:**
- Bulk insert support
- Multi-table joins for response data
- Returns created requests with user and department info

### 4. `/api/notifications` ✅
**Status:** Fully Migrated
- ✅ Updated imports
- ✅ Migrated notification query with ordering
- ✅ Used `desc()` for descending order
- ✅ Fixed column name `isRead` (camelCase)
- ✅ No compilation errors

**Changes:**
- Simple select with where, order, and limit
- Unread count calculation

## 📋 Remaining APIs to Migrate (51/55)

### High Priority (Core Ticketing)
1. `/api/tickets/stream` - Real-time ticket updates
2. `/api/get-pending-requests` - Resource request management
3. `/api/handle-resource-request` - Approve/deny requests
4. `/api/get-department-employees` - Department user management
5. `/api/update-user-department` - User department updates
6. `/api/switch-department` - Department switching
7. `/api/switch-project` - Project switching
8. `/api/get-user-departments-projects` - User context data
9. `/api/check-user-departments` - Department access checks

### Medium Priority (Notifications & Streaming)
10. `/api/notifications/stream` - SSE for real-time notifications
11. `/api/notifications/mark-all-read` - Bulk notification updates

### Lower Priority (Sales System - Different Database)
**Note:** These use `organisation_sales` database, not ticketing system:
- `/api/sales/hierarchy`
- `/api/sales/sync-all-users`
- `/api/sales/transactions/*`
- `/api/sales/quotes/*`
- `/api/sales/notifications/*`
- `/api/sales/clients/*`
- `/api/sales/analytics/*`
- (30+ sales-related APIs)

### Utility/Admin APIs
- `/api/user-verify`
- `/api/upload-image`
- `/api/update-profile`
- `/api/get-organization-info`
- `/api/assign-organization-role`
- `/api/promote-to-manager`
- Various debug and test APIs

## 🔄 Migration Patterns Established

### Import Pattern
```typescript
// Supabase (commented out - migrated to PostgreSQL)
// import { supabase } from '@/app/db/connections';

// PostgreSQL with Drizzle ORM
import { db, tableName, eq, and, or, inArray } from '@/lib/db-helper';
```

### Query Patterns

#### Simple Select
```typescript
// Before (Supabase)
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value);

// After (Drizzle)
const data = await db
  .select()
  .from(tableName)
  .where(eq(tableName.columnName, value));
```

#### Select with Join
```typescript
// Before (Supabase)
const { data } = await supabase
  .from('tickets')
  .select('*, users!tickets_user_id_fkey(name, email)');

// After (Drizzle)
const data = await db
  .select({
    id: tickets.id,
    userName: users.name,
    userEmail: users.email
  })
  .from(tickets)
  .innerJoin(users, eq(tickets.userId, users.id));
```

#### Insert with Returning
```typescript
// Before (Supabase)
const { data } = await supabase
  .from('table')
  .insert({ field: value })
  .select()
  .single();

// After (Drizzle)
const data = await db
  .insert(tableName)
  .values({ fieldName: value })
  .returning();
```

#### Multiple Where Conditions
```typescript
// Before (Supabase)
.eq('field1', value1)
.eq('field2', value2)

// After (Drizzle)
.where(
  and(
    eq(tableName.field1, value1),
    eq(tableName.field2, value2)
  )
)
```

### Column Naming
- **Supabase:** snake_case (`user_id`, `created_at`, `organization_id`)
- **Drizzle Schema:** camelCase (`userId`, `createdAt`, `organizationId`)
- **Response Objects:** Keep snake_case for backward compatibility with frontend

### Date Handling
- Drizzle returns Date objects
- Convert to ISO strings for API responses: `.toISOString()`

## ⚠️ Important Notes

### Backward Compatibility
- Supabase connections still exported from `db/index.ts`
- Can run hybrid system during migration
- Sales system still uses Supabase (`supabaseSales`)

### Testing Strategy
1. Migrate one API at a time
2. Test with Postman/HTTP files after each migration
3. Keep Supabase code commented (not deleted) for rollback
4. Verify no compilation errors after each migration

### Column Name Mapping
Always use camelCase in Drizzle queries:
- `user_id` → `userId`
- `created_at` → `createdAt`
- `organization_id` → `organizationId`
- `department_id` → `departmentId`
- `profile_picture_url` → `profilePictureUrl`
- `is_read` → `isRead`
- `is_deleted` → `isDeleted`

## 📊 Progress Statistics
- **Total APIs Identified:** 55
- **Migrated:** 4 (7.3%)
- **Remaining:** 51 (92.7%)
- **Ticketing System APIs:** ~25 (9 migrated needed)
- **Sales System APIs:** ~30 (different database, can be separate migration)

## 🎯 Next Steps

### Immediate (Complete Core Ticketing)
1. Migrate `/api/tickets/stream` (real-time updates)
2. Migrate `/api/get-pending-requests`
3. Migrate `/api/handle-resource-request`
4. Migrate department-related APIs (switch, update, get-employees)
5. Migrate user context APIs (get-user-departments-projects, check-user-departments)

### After Core Migration
1. Test all migrated endpoints
2. Update frontend if needed (check for snake_case dependencies)
3. Run Drizzle migrations if schema changes needed
4. Consider migrating sales system separately (different database)

## 🛠️ Tools & Dependencies
- **Database:** PostgreSQL 5433
- **ORM:** Drizzle ORM (`drizzle-orm`)
- **Driver:** node-postgres (`pg`)
- **Schema Location:** `db/schema.ts`
- **Helper Location:** `lib/db-helper.ts`

## 📝 Migration Checklist Template

For each API:
- [ ] Read existing Supabase code
- [ ] Identify all database operations
- [ ] Comment out Supabase imports
- [ ] Add Drizzle imports
- [ ] Replace queries with Drizzle syntax
- [ ] Fix column names (snake_case → camelCase)
- [ ] Handle date conversions
- [ ] Test for compilation errors
- [ ] Test API functionality
- [ ] Update documentation

---
**Last Updated:** Migration Session 1
**Status:** Foundation Complete, Core APIs Started
