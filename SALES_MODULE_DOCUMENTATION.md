# Sales Module Documentation

## Overview
Complete Sales CRM module with separate database, role-based dashboards, client management, and revenue tracking.

---

## Database Architecture

### Separate Database
- **Main DB**: User authentication, departments, projects, tickets (Supabase)
- **Sales DB**: Clients, transactions, analytics, forecasts (Separate Supabase/PostgreSQL)
- **Connection**: `app/db/connections.tsx` - `supabaseSales`, `supabaseAdminSales`

### Tables
1. **sales_team_hierarchy** - Manages Admin → Manager → Member relationships
2. **clients** - Client registration and business details
3. **products** - Product/service catalog
4. **transactions** - Orders and invoices
5. **transaction_line_items** - Line-item details
6. **sales_targets** - Monthly/quarterly/yearly targets
7. **client_interactions** - Call/email/meeting logs
8. **mv_revenue_analytics** - Materialized view for fast analytics
9. **ai_revenue_forecasts** - AI prediction storage
10. **member_assignment_audit** - Tracks manager-member assignments

---

## User Roles

### Sales Admin
- **Permissions**: See all org data, manage team hierarchy
- **Dashboard**: `/sales/admin-dashboard`
- **Features**:
  - Total org revenue, transactions, clients, profit
  - Hierarchical table of managers and members
  - Expandable manager rows showing team members
  - Unassigned members highlighted
  - Access to Manage Access page

### Sales Manager
- **Permissions**: See team data only
- **Dashboard**: `/sales/manager-dashboard`
- **Features**:
  - Team revenue, transactions, profit
  - Team member performance table
  - Per-member revenue/transactions/profit breakdown

### Sales Member
- **Permissions**: See own data only
- **Dashboard**: `/sales/member-dashboard`
- **Features**:
  - Personal revenue, transactions, client count
  - Target achievement percentage
  - Client list with registration details
  - Add Client modal

---

## API Endpoints

### Authentication & Sync
**POST `/api/sales/auth-check`**
- Checks if user is from Sales department
- Returns role and redirect URL
- Response: `{ isSalesUser, salesRole, redirectTo }`

**POST `/api/sales/sync-user`**
- Syncs user from main DB to sales_team_hierarchy
- Auto-maps department_role to sales_role
- One-time sync on first access

### Team Hierarchy
**GET `/api/sales/get-hierarchy?view=admin|manager|member`**
- Admin: Returns all managers with nested members + unassigned members
- Manager: Returns their team members
- Member: Returns own info
- Response: `{ managers: [...], unassignedMembers: [...] }`

**POST `/api/sales/assign-member`**
- Admin only
- Assigns member to manager (1-to-1)
- Body: `{ member_user_id, manager_user_id }`
- Creates audit log entry

### Client Management
**POST `/api/sales/clients`**
- Register new client
- Body: Client details (name, email, phone, industry, payment_terms, etc.)
- Auto-assigns to current user unless specified

**GET `/api/sales/clients?view=my|team|all&salesMemberId=xxx`**
- my: User's own clients
- team: Manager's team clients
- all: Admin sees all
- Optional filter by salesMemberId

### Transactions (Revenue Capture)
**POST `/api/sales/transactions`**
- Create transaction/invoice
- Auto-generates invoice number
- Calculates totals, discounts, taxes
- Body: `{ client_id, subtotal_amount, line_items: [...], discount_percentage, tax_percentage }`

**GET `/api/sales/transactions?clientId=xxx&salesMemberId=xxx`**
- Fetch transactions with filters
- Includes client name via join

**PATCH `/api/sales/transactions`**
- Update payment details
- Body: `{ transaction_id, amount_paid, payment_method, payment_reference }`

### Analytics
**GET `/api/sales/analytics?view=member|manager|admin&userId=xxx`**
- Member: Personal metrics (revenue, transactions, profit, clients, target)
- Manager: Team aggregates + member performance breakdown
- Admin: Org-wide metrics + manager performance breakdown
- Uses `mv_revenue_analytics` materialized view

---

## Frontend Pages

### `/sales/admin-dashboard`
**Components**:
- 4 metric cards (Revenue, Transactions, Clients, Profit)
- Hierarchical table with expand/collapse
- Unassigned members section
- "Manage Access" button

**Features**:
- Click manager row to expand/collapse members
- Color-coded role badges (Manager=blue, Member=green, Unassigned=orange)
- Quick assign button for unassigned members

### `/sales/manager-dashboard`
**Components**:
- 4 metric cards (Team Revenue, Transactions, Team Size, Profit)
- Team members table with performance

**Features**:
- Per-member revenue/transactions/profit
- Empty state for managers with no team

### `/sales/member-dashboard`
**Components**:
- 4 metric cards (Revenue, Transactions, Clients, Target Achievement)
- Client list table
- Add Client dialog

**Add Client Dialog**:
- Fields: Client name, contact person, email, phone, industry, client type (B2B/B2C/B2G), company size, payment terms, address
- Validation: Client name required
- Auto-assigns to current user

### `/sales/manage-access`
**Admin Only**

**Features**:
- Unassigned members card (orange border)
- Manager sections (one card per manager)
- Assign dropdown + button for unassigned
- Reassign dropdown for existing assignments
- Real-time updates after assignment

**Flow**:
1. Admin selects manager from dropdown for unassigned member
2. Clicks "Assign" button
3. API creates assignment + audit log
4. Page refreshes to show updated hierarchy

---

## Navigation

### Sidebar
- Sales icon (DollarSign) added to sidebar
- Visible to all users
- Clicking redirects based on role:
  - Admin → `/sales/admin-dashboard`
  - Manager → `/sales/manager-dashboard`
  - Member → `/sales/member-dashboard`

### Entry Point
**`/sales`**: Auto-redirects to role-specific dashboard

---

## Data Flow

### User First Access
1. User from Sales dept clicks "Sales" in sidebar
2. `/sales` page calls `/api/sales/auth-check`
3. API verifies department = Sales
4. API returns `redirectTo` based on department_role
5. If user not in `sales_team_hierarchy`, `/api/sales/sync-user` creates entry
6. User lands on role-specific dashboard

### Client Registration (Member)
1. Member opens "Add Client" dialog
2. Fills form, submits
3. POST `/api/sales/clients` with all details
4. Client record created with `created_by_user_id` and `assigned_sales_member_id`
5. Dashboard refreshes to show new client in list
6. Analytics refresh to update client count

### Transaction Creation
1. User (any role) creates transaction
2. POST `/api/sales/transactions` with:
   - client_id
   - subtotal_amount
   - line_items array (product_id, quantity, unit_price)
   - discount_percentage, tax_percentage
3. API calculates:
   - Discount amount
   - Tax amount
   - Total amount
   - Amount due
   - Per-item profit margins
4. Transaction + line items inserted
5. Trigger auto-updates payment_status based on amount_paid

### Analytics Refresh
1. Dashboards call `/api/sales/analytics` on load
2. API queries `mv_revenue_analytics` materialized view
3. Aggregates by role scope (member/manager/admin)
4. Returns pre-calculated totals
5. Frontend displays in metric cards

### Manager Assignment (Admin)
1. Admin navigates to `/sales/manage-access`
2. Sees unassigned members at top
3. Selects manager from dropdown
4. Clicks "Assign"
5. POST `/api/sales/assign-member` updates `sales_team_hierarchy.manager_id`
6. Audit log created
7. Page refreshes, member moves to manager's section

---

## Database Functions

### Auto-Calculate Transaction Totals
```sql
CREATE TRIGGER trg_calculate_transaction_totals
BEFORE INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION calculate_transaction_totals();
```
- Auto-calculates `amount_due = total_amount - amount_paid`
- Auto-updates `payment_status` based on amount_paid

### Update Target Achievement
```sql
SELECT update_target_achievement();
```
- Manual refresh to update `sales_targets.achieved_revenue`
- Aggregates from `transactions` where `payment_status IN ('paid', 'partial')`
- Calculates `revenue_achievement_percentage`

### Refresh Analytics View
```sql
SELECT refresh_revenue_analytics();
```
- Refreshes `mv_revenue_analytics` materialized view
- Should be run nightly or after bulk imports
- CONCURRENT refresh allows queries during refresh

---

## Key Features

### 1-to-1 Manager-Member Constraint
- Each sales_member must have exactly ONE manager
- Enforced by CHECK constraint: `(sales_role = 'sales_member' AND manager_id IS NOT NULL)`
- Managers and Admins have `manager_id = NULL`

### Cross-Database Authentication
- Main DB validates JWT token
- Sales DB uses same user_id for foreign keys
- No duplicate user management

### Role Mapping
| Main DB Role | Sales DB Role |
|--------------|---------------|
| Admin        | sales_admin   |
| Manager      | sales_manager |
| Member       | sales_member  |

### Revenue Tracking
- Transaction-level: Individual invoices
- Line-item level: Per-product breakdown with profit margins
- Aggregated: Materialized view for fast analytics

### Analytics Scoping
- Member: See only own data
- Manager: See team aggregate + per-member breakdown
- Admin: See org-wide + per-manager breakdown

---

## Future Enhancements (Planned)

### AI Revenue Forecasting
- Table `ai_revenue_forecasts` ready
- Fields: predicted_revenue, confidence_score, seasonality_factor
- Scope: member/manager/team/organization
- Algorithm: Time-series analysis on historical transactions

### Products Module
- Product catalog management
- SKU tracking
- Cost price vs selling price
- Subscription billing cycles

### Commission Tracking
- `transactions.commission_amount` field ready
- Commission percentage per transaction
- `commission_paid` boolean flag
- Commission reports by member/manager

### Client Interactions Log
- Table `client_interactions` ready
- Track calls, emails, meetings, demos
- Outcome recording (positive/neutral/negative)
- Next follow-up date reminders

---

## Environment Variables Required

```env
# Sales Database
NEXT_PUBLIC_SUPABASE_SALES_URL=https://your-sales-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY_SALES=your_anon_key
```

---

## Testing Checklist

### Admin
- [ ] See all managers and their members
- [ ] Expand/collapse manager rows
- [ ] See unassigned members
- [ ] Assign member to manager
- [ ] Reassign member to different manager
- [ ] View org-wide analytics

### Manager
- [ ] See only own team members
- [ ] View team revenue/transactions
- [ ] See per-member performance breakdown
- [ ] Cannot access Manage Access

### Member
- [ ] View personal metrics
- [ ] See target achievement
- [ ] Add new client
- [ ] View client list
- [ ] Cannot see other members' data

### All Roles
- [ ] Register clients
- [ ] Create transactions
- [ ] Update payment status
- [ ] View analytics

---

## API Response Examples

### GET /api/sales/get-hierarchy?view=admin
```json
{
  "managers": [
    {
      "user_id": "uuid-1",
      "full_name": "John Manager",
      "email": "john@company.com",
      "sales_role": "sales_manager",
      "members": [
        {
          "user_id": "uuid-2",
          "full_name": "Jane Member",
          "email": "jane@company.com",
          "sales_role": "sales_member",
          "manager_id": "uuid-1"
        }
      ]
    }
  ],
  "unassignedMembers": []
}
```

### GET /api/sales/analytics?view=member
```json
{
  "totalRevenue": 150000,
  "totalTransactions": 12,
  "totalProfit": 45000,
  "totalClients": 8,
  "target": {
    "target_revenue": 200000,
    "achieved_revenue": 150000,
    "revenue_achievement_percentage": 75
  },
  "revenueByClient": [...]
}
```

---

## Troubleshooting

**Issue**: User not syncing to sales_team_hierarchy  
**Fix**: Ensure `/api/sales/sync-user` is called on first access. Check JWT has correct department_name='Sales'.

**Issue**: Analytics showing 0 despite transactions  
**Fix**: Refresh materialized view: `SELECT refresh_revenue_analytics();`

**Issue**: Cannot assign member to manager  
**Fix**: Verify both users exist in sales_team_hierarchy. Check manager has `sales_role='sales_manager'`.

**Issue**: Foreign key constraint error on user_id  
**Fix**: Ensure `CREATE UNIQUE INDEX idx_sales_hierarchy_user_unique ON sales_team_hierarchy(user_id);` exists.

---

**Module Status**: ✅ Complete and Production-Ready

