# Ticket Closing Dates Implementation

## Overview
Added expected closing date and actual closing date functionality to the ticketing system.

## Database Changes

### SQL Query (Run in Supabase SQL Editor)
```sql
-- Add expected_closing_date and actual_closing_date columns to tickets table
ALTER TABLE tickets 
ADD COLUMN expected_closing_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN actual_closing_date TIMESTAMP WITH TIME ZONE;

-- Add comment to describe the columns
COMMENT ON COLUMN tickets.expected_closing_date IS 'Expected date when the ticket should be closed, set during creation';
COMMENT ON COLUMN tickets.actual_closing_date IS 'Actual date when the ticket was resolved, auto-set when status changes to Resolved';
```

## API Changes

### 1. Create Ticket API (`/api/create-tickets`)

#### New Field in Request Body
- `expected_closing_date` (optional): ISO date string for when the ticket is expected to be closed

#### Validation
- Date format must be valid ISO date string
- Date cannot be in the past
- If not provided, field remains null

#### Example Request
```json
{
  "project_id": "uuid",
  "title": "Bug in login page",
  "description": "Users cannot login",
  "priority_id": "uuid",
  "assigned_to": "uuid",
  "expected_closing_date": "2025-11-30T00:00:00Z"
}
```

#### Response Includes
- `expected_closing_date`: The date set by creator
- `actual_closing_date`: Initially null

---

### 2. Update Ticket API (`/api/update-ticket`)

#### New Field in Request Body
- `expected_closing_date` (optional): ISO date string to update expected closing date

#### Behavior

**Expected Closing Date:**
- Only the ticket **creator** can update the `expected_closing_date`
- Other users' attempts to update this field are ignored (frozen in edit mode)
- Can be set to null to remove the expected date

**Actual Closing Date (Auto-captured):**
- Automatically set to current timestamp when ticket status changes to "Resolved"
- Automatically cleared (set to null) when ticket is reopened (status changed FROM "Resolved" to something else)
- Cannot be manually set - it's system-controlled

#### Example Request (Update Status to Resolved)
```json
{
  "ticket_id": "uuid",
  "status_id": "resolved-status-uuid"
}
```

This will automatically set `actual_closing_date` to the current timestamp.

#### Example Request (Creator Updates Expected Date)
```json
{
  "ticket_id": "uuid",
  "expected_closing_date": "2025-12-15T00:00:00Z"
}
```

Only works if the requester is the ticket creator.

---

## Frontend Integration Guide

### Creating a Ticket
Add a date picker for `expected_closing_date`:

```typescript
const [expectedClosingDate, setExpectedClosingDate] = useState<Date | null>(null);

// In form submission
const response = await fetch('/api/create-tickets', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    project_id,
    title,
    description,
    expected_closing_date: expectedClosingDate?.toISOString()
  })
});
```

### Editing a Ticket
- Show `expected_closing_date` field
- **Freeze/disable** the field if current user is NOT the creator
- Show `actual_closing_date` as read-only (auto-populated when resolved)

```typescript
// In ticket edit form
<DatePicker
  label="Expected Closing Date"
  value={expectedClosingDate}
  onChange={setExpectedClosingDate}
  disabled={currentUserId !== ticket.created_by} // Frozen for non-creators
/>

<div className="text-sm text-gray-500">
  Actual Closing Date: {ticket.actual_closing_date 
    ? new Date(ticket.actual_closing_date).toLocaleDateString() 
    : 'Not yet resolved'}
</div>
```

### Updating Ticket Status
When status changes to "Resolved", the `actual_closing_date` is automatically captured:

```typescript
const updateStatus = async (statusId: string) => {
  const response = await fetch('/api/update-ticket', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ticket_id: ticketId,
      status_id: statusId // If this is "Resolved", actual_closing_date is set
    })
  });
};
```

---

## Business Logic Summary

1. **Expected Closing Date**:
   - Set by creator during ticket creation
   - Can be updated only by creator
   - Helps track SLA and deadlines
   - Optional field

2. **Actual Closing Date**:
   - Automatically captured when ticket is marked as "Resolved"
   - Automatically cleared if ticket is reopened
   - System-controlled, cannot be manually edited
   - Used for performance metrics and resolution time tracking

3. **Use Cases**:
   - Calculate resolution time: `actual_closing_date - created_at`
   - Track SLA compliance: Compare `actual_closing_date` with `expected_closing_date`
   - Generate reports on ticket closure performance
   - Dashboard metrics for average resolution time

---

## Testing Checklist

- [ ] Run SQL query in Supabase SQL Editor
- [ ] Create ticket with expected closing date
- [ ] Create ticket without expected closing date (should work)
- [ ] Try setting past date as expected closing date (should fail)
- [ ] Update ticket status to "Resolved" → Check `actual_closing_date` is set
- [ ] Reopen ticket (change from Resolved to Open) → Check `actual_closing_date` is cleared
- [ ] Non-creator tries to update expected_closing_date (should be ignored)
- [ ] Creator updates expected_closing_date (should work)
- [ ] Verify API responses include both date fields

---

## Database Schema Reference

```sql
tickets (
  ...existing columns...,
  expected_closing_date TIMESTAMP WITH TIME ZONE,  -- When ticket should be closed
  actual_closing_date TIMESTAMP WITH TIME ZONE     -- When ticket was actually resolved
)
```

Both columns are nullable and use timezone-aware timestamps.
