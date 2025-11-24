# Sales Realtime Notifications & Dashboard Updates - Implementation Guide

## 🎯 Overview
Implemented complete realtime notification system for sales events (quote acceptance and payment received) with automatic dashboard refreshing.

---

## 📋 Implementation Steps

### 1. **Database Setup**
Run this SQL on your **Sales Supabase database**:

```sql
-- Execute: database-updates/add-sales-notifications.sql
```

This creates:
- `sales_notifications` table
- Indexes for performance
- Proper columns for user_id, organization_id, entity tracking

---

### 2. **Features Implemented**

#### ✅ Realtime Notification System
- **SSE Stream**: `/api/sales/notifications/stream`
- **Custom Hook**: `useSalesRealtime()` for easy integration
- **Auto-refresh**: Dashboards automatically update when events occur

#### ✅ Notification Triggers

**Quote Acceptance** (`/api/sales/quotes/[id]/accept-public`):
- When client accepts quote via magic link
- Creates notification for sales member who created the quote
- Message: "Quote QT-XXX was accepted by Client Name. Invoice INV-XXX generated."
- Type: `quote_accepted`
- Includes metadata: quote_number, invoice_number, client_name, amount

**Payment Received** (`/api/sales/transactions/payment`):
- When admin records a payment
- Creates notification for sales member who created the transaction
- Message: "Payment of ₹XX,XXX received for Invoice INV-XXX from Client Name. Status: paid/partial"
- Type: `payment_received`
- Includes metadata: invoice_number, amount_paid, payment_method, payment_status

#### ✅ Auto-Refresh Integration

**Transactions Page** (`/sales/transactions`):
- Uses `useSalesRealtime()` hook
- Auto-refreshes transaction list when payment received or quote accepted
- Shows toast notifications for realtime events

**Admin Dashboard** (`/sales/admin-dashboard`):
- Uses `useSalesRealtime()` hook
- Auto-refreshes analytics and hierarchy on payment/quote events
- Shows browser notifications (if permission granted)

---

## 🔧 How It Works

### Notification Flow:

```
1. Client Action (Accept Quote / Payment Recorded)
   ↓
2. API creates notification in sales_notifications table
   ↓
3. Supabase Realtime broadcasts INSERT event
   ↓
4. SSE stream sends notification to connected client
   ↓
5. useSalesRealtime() hook receives notification
   ↓
6. Callback executes → Shows toast + Refreshes data
```

### Code Example:

```typescript
// Any page can use this hook
useSalesRealtime({
  onNotification: (notification) => {
    console.log('Notification:', notification);
    
    // Show toast
    showNotification('success', notification.message);
    
    // Refresh data based on type
    if (notification.type === 'payment_received') {
      fetchTransactions();
    }
  }
});
```

---

## 🔔 Notification Types

| Type | Trigger | Recipient | Message Pattern |
|------|---------|-----------|-----------------|
| `quote_accepted` | Client accepts quote | Sales member who created quote | "Quote {number} accepted by {client}. Invoice {inv_number} generated." |
| `payment_received` | Payment recorded | Sales member + Admin | "Payment of ₹{amount} received for Invoice {number} from {client}. Status: {status}" |
| `invoice_generated` | Quote acceptance | Sales member | "Invoice {number} generated from Quote {number}" |

---

## 📊 Dashboard Updates

### What Updates Automatically:

✅ **Transactions Page**:
- Transaction list
- Payment status badges
- Amount paid/due

✅ **Admin Dashboard**:
- Total revenue
- Total transactions
- Total profit
- Manager performance metrics

✅ **Manager Dashboard** (if you add the hook):
- Team revenue
- Team transactions
- Member performance

---

## 🚀 Testing Guide

### Test Quote Acceptance Notification:

1. **Create a quote** as Sales Admin/Member
2. **Send quote** to client (generates magic link)
3. **Open magic link** in incognito browser
4. **Click "Accept Quote"**
5. **Check original browser** → Should see:
   - 🔔 Toast notification: "Quote accepted..."
   - ♻️ Console: "Refreshing transactions..."
   - 📈 Dashboard metrics updated
   - 📋 New transaction in list

### Test Payment Notification:

1. **Go to Transactions page** (`/sales/transactions`)
2. **Record a payment** on any pending invoice
3. **Check browser** → Should see:
   - 🔔 Toast: "Payment of ₹XX,XXX received..."
   - ♻️ Transaction list refreshes
   - 📊 Status badge updates (pending → partial → paid)
   - 💰 Dashboard revenue updates

---

## 🐛 Fixing the SSE Error

The error you saw:
```
❌ Notification stream error: {}
```

**Cause**: 
- The `useRealtime.ts` hook tries to connect to `/api/notifications/stream` (main ticketing system)
- This endpoint might not be implemented or returns an error

**Fix Options**:

**Option 1**: Disable main notifications (Quick fix)
```typescript
// In your layout or main page
useRealtime({ enabled: false })
```

**Option 2**: Implement main notification stream
- Create `/api/notifications/stream/route.ts` similar to sales notifications
- Or remove the useRealtime hook if not needed

**Option 3**: Only use sales notifications
- Remove `useRealtime()` from non-sales pages
- Only use `useSalesRealtime()` in sales pages

---

## 📁 Files Created/Modified

### New Files:
- ✅ `database-updates/add-sales-notifications.sql`
- ✅ `app/api/sales/notifications/stream/route.ts`
- ✅ `lib/salesNotifications.ts`
- ✅ `app/hooks/useSalesRealtime.ts`
- ✅ `app/quote/preview/page.tsx` (Magic link page)
- ✅ `app/api/sales/quotes/preview/route.ts`
- ✅ `app/api/sales/quotes/[id]/accept-public/route.ts`

### Modified Files:
- ✅ `app/api/sales/transactions/payment/route.ts` (Added notification)
- ✅ `app/sales/transactions/page.tsx` (Added realtime hook)
- ✅ `app/sales/admin-dashboard/page.tsx` (Added realtime hook)
- ✅ `app/api/sales/quotes/[id]/send/route.ts` (Updated magic link URL)

---

## 🎨 Browser Notification Setup

To enable desktop notifications:

```typescript
// Request permission (one-time)
if ('Notification' in window) {
  Notification.requestPermission();
}
```

Users will see a browser prompt. Once granted, they'll receive desktop notifications even when tab is in background.

---

## 🔐 Security Notes

- ✅ Notifications filtered by `user_id` (users only see their own)
- ✅ Magic link token verification before accepting quote
- ✅ JWT token required for SSE stream connection
- ✅ Organization_id filtering in all queries

---

## 📈 Performance Optimizations

- ✅ Database indexes on `user_id`, `is_read`, `created_at`, `type`
- ✅ SSE connection auto-closes on page unload
- ✅ Notifications only sent to connected users (no polling)
- ✅ Minimal payload size (only changed data)

---

## 🎯 Next Steps

### Recommended Additions:

1. **Notification Center UI**:
   - Create `/sales/notifications` page
   - Show list of all notifications
   - Mark as read functionality
   - Filter by type (payments, quotes, invoices)

2. **Email Notifications**:
   - Send email when quote accepted (already done ✅)
   - Send email on payment received
   - Daily digest of unread notifications

3. **Toast Notification System**:
   - Create reusable toast component
   - Replace all `alert()` calls
   - Add sound effects for notifications

4. **Notification Preferences**:
   - Let users choose which events to be notified about
   - Email vs browser vs in-app preferences
   - Quiet hours settings

---

## 🆘 Troubleshooting

### "Notification stream error" in console:
- Check if `/api/notifications/stream` exists
- Disable `useRealtime()` if not using main notifications
- Use only `useSalesRealtime()` in sales pages

### Notifications not appearing:
- Verify SQL migration ran successfully
- Check browser console for SSE connection status
- Ensure JWT token is valid
- Check user_id matches in notifications table

### Dashboard not refreshing:
- Check console for "Refreshing..." logs
- Verify `fetchTransactions()` / `fetchAnalytics()` are called
- Check network tab for API calls
- Ensure notification type matches condition (`payment_received`, `quote_accepted`)

### Payment status not updating:
- Verify transaction update query succeeded
- Check `amount_paid` and `total_amount` calculation
- Ensure payment_status logic is correct (pending/partial/paid)

---

## ✨ Summary

You now have:
- 🔔 **Realtime notifications** for quote acceptance and payments
- ♻️ **Auto-refreshing dashboards** when events occur
- 📧 **Email notifications** to clients
- 🎯 **Magic link quote preview** without login
- 💰 **Automatic invoice generation** from accepted quotes
- 📊 **Live metrics updates** on admin dashboard

All working together seamlessly! 🎉
