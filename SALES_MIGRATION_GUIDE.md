# Sales APIs Migration Guide: Supabase → Drizzle ORM

## ✅ Completed Migrations

### 1. sync-user (`app/api/sales/sync-user/route.ts`)
- Status: ✅ Migrated
- Changes: Uses `salesDb` and `salesTeamHierarchy` table

## 📋 Pending Migrations (24 files)

### Migration Pattern

#### Before (Supabase):
```typescript
import { supabaseAdminSales } from '@/app/db/connections';

const { data, error } = await supabaseAdminSales
  .from('sales_team_hierarchy')
  .select('*')
  .eq('user_id', userId)
  .single();
```

#### After (Drizzle):
```typescript
import { salesDb, salesTeamHierarchy, eq, and } from '@/lib/sales-db-helper';

const data = await salesDb
  .select()
  .from(salesTeamHierarchy)
  .where(eq(salesTeamHierarchy.userId, userId))
  .limit(1);
```

### Common Conversions

| Supabase | Drizzle | Example |
|----------|---------|---------|
| `.eq('field', value)` | `eq(table.field, value)` | `eq(salesTeamHierarchy.userId, userId)` |
| `.neq('field', value)` | `ne(table.field, value)` | `ne(clients.status, 'inactive')` |
| `.in('field', array)` | `inArray(table.field, array)` | `inArray(transactions.clientId, clientIds)` |
| `.is('field', null)` | `isNull(table.field)` | `isNull(salesTeamHierarchy.managerId)` |
| `.gte('field', value)` | `gte(table.field, value)` | `gte(transactions.transactionDate, startDate)` |
| `.lte('field', value)` | `lte(table.field, value)` | `lte(transactions.transactionDate, endDate)` |
| `.like('field', '%value%')` | `like(table.field, '%value%')` | `like(clients.clientName, '%acme%')` |
| `.order('field', { ascending: false })` | `.orderBy(desc(table.field))` | `.orderBy(desc(transactions.createdAt))` |
| `.limit(10)` | `.limit(10)` | Same |
| `.single()` | `.limit(1)` then `[0]` | `const user = result[0]` |

### Multiple Conditions

#### Before:
```typescript
.eq('org_id', orgId)
.eq('is_active', true)
.neq('status', 'deleted')
```

#### After:
```typescript
.where(
  and(
    eq(table.orgId, orgId),
    eq(table.isActive, true),
    ne(table.status, 'deleted')
  )
)
```

### OR Conditions

#### Before:
```typescript
.or('status.eq.active,status.eq.pending')
```

#### After:
```typescript
.where(
  or(
    eq(table.status, 'active'),
    eq(table.status, 'pending')
  )
)
```

### Insert

#### Before:
```typescript
const { data, error } = await supabaseAdminSales
  .from('clients')
  .insert({ name: 'Test', org_id: orgId })
  .select()
  .single();
```

#### After:
```typescript
const data = await salesDb
  .insert(clients)
  .values({ clientName: 'Test', organizationId: orgId })
  .returning();

const client = data[0];
```

### Update

#### Before:
```typescript
const { data, error } = await supabaseAdminSales
  .from('clients')
  .update({ status: 'active' })
  .eq('client_id', clientId)
  .select()
  .single();
```

#### After:
```typescript
const data = await salesDb
  .update(clients)
  .set({ status: 'active' })
  .where(eq(clients.clientId, clientId))
  .returning();

const client = data[0];
```

### Delete

#### Before:
```typescript
const { error } = await supabaseAdminSales
  .from('clients')
  .delete()
  .eq('client_id', clientId);
```

#### After:
```typescript
await salesDb
  .delete(clients)
  .where(eq(clients.clientId, clientId));
```

### Joins (Complex)

#### Before:
```typescript
const { data } = await supabaseAdminSales
  .from('transactions')
  .select(`
    *,
    clients(client_name, email),
    products(product_name)
  `)
  .eq('organization_id', orgId);
```

#### After:
```typescript
// Use raw SQL for complex joins
const data = await salesDb.execute(sql`
  SELECT 
    t.*,
    c.client_name, c.email,
    p.product_name
  FROM transactions t
  LEFT JOIN clients c ON t.client_id = c.client_id
  LEFT JOIN products p ON t.product_id = p.product_id
  WHERE t.organization_id = ${orgId}::uuid
`);

const result = data.rows;
```

## 🔧 Files to Migrate

### Priority 1 (Core APIs)
1. ✅ `sync-user/route.ts` - DONE
2. ⏳ `get-hierarchy/route.ts` - Partially migrated (compile errors)
3. ⏳ `assign-member/route.ts` - Partially migrated (compile errors)
4. ⏳ `auth-check/route.ts` - Partially migrated (compile errors)
5. ⏳ `transactions/route.ts`
6. ⏳ `transactions/[id]/route.ts`
7. ⏳ `quotes/route.ts`
8. ⏳ `quotes/[id]/route.ts`

### Priority 2 (Secondary APIs)
9. `transactions/payment/route.ts`
10. `quotes/[id]/send/route.ts`
11. `quotes/[id]/accept/route.ts`
12. `quotes/[id]/reject-public/route.ts`
13. `quotes/[id]/accept-public/route.ts`
14. `quotes/preview/route.ts`
15. `notifications/stream/route.ts`
16. `notifications/test/route.ts`

### Priority 3 (Utilities)
17. `decode-token/route.ts`
18. `debug-departments/route.ts`
19. `sync-all-users/route.ts`
20. `helpers.ts`

## 📝 Table Name Mappings

| Supabase Table | Drizzle Import | Variable Name |
|----------------|----------------|---------------|
| `sales_team_hierarchy` | `salesTeamHierarchy` | `salesTeamHierarchy` |
| `clients` | `clients` | `clients` |
| `transactions` | `transactions` | `transactions` |
| `transaction_line_items` | `transactionLineItems` | `transactionLineItems` |
| `products` | `products` | `products` |
| `quotes` | `quotes` | `quotes` |
| `client_interactions` | `clientInteractions` | `clientInteractions` |
| `sales_notifications` | `salesNotifications` | `salesNotifications` |
| `sales_targets` | `salesTargets` | `salesTargets` |
| `member_assignment_audit` | `memberAssignmentAudit` | `memberAssignmentAudit` |
| `ai_revenue_forecasts` | `aiRevenueForecasts` | `aiRevenueForecasts` |

## 🚀 Quick Start for Each File

1. Replace imports:
```typescript
// Remove
import { supabaseAdminSales } from '@/app/db/connections';

// Add
import { salesDb, [tables], eq, and, or, sql } from '@/lib/sales-db-helper';
```

2. Convert all queries using patterns above

3. Handle errors (Drizzle throws, doesn't return error object)

4. Test API endpoints

## ⚠️ Common Pitfalls

1. **Field names**: Supabase uses `snake_case`, Drizzle schema uses `camelCase`
2. **Single vs Array**: `.single()` returns object, Drizzle returns array - use `[0]`
3. **Error handling**: Supabase returns `{ data, error }`, Drizzle throws errors
4. **UUID casting**: Use `${value}::uuid` in raw SQL queries
5. **Returning**: Always add `.returning()` for INSERT/UPDATE to get data back

## ✨ Benefits After Migration

- ✅ Type-safe queries
- ✅ No RLS issues
- ✅ Better performance
- ✅ Single database (PostgreSQL)
- ✅ Easier to debug
