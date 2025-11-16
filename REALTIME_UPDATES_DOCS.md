# Real-time Updates & Browser Notifications Implementation

## Overview
This implementation provides:
1. **Real-time ticket updates** across browser tabs/windows via SSE
2. **Browser push notifications** for in-app notifications
3. **Auto-refresh** of ticket lists when changes occur

## Components Created

### 1. Backend APIs
- **`/api/tickets/stream`** - SSE endpoint for real-time ticket updates
- **`/api/notifications/stream`** - SSE endpoint for notifications (already existed)

### 2. Frontend Utilities
- **`lib/browserNotifications.ts`** - Browser notification wrapper
- **`app/hooks/useRealtime.ts`** - Main hook for SSE connections
- **`app/hooks/useTicketUpdates.ts`** - Hook for listening to ticket updates
- **`app/providers/RealtimeProvider.tsx`** - Context provider for real-time features

## Setup Instructions

### Step 1: Wrap your app with RealtimeProvider

In your root layout (`app/layout.tsx`), add the RealtimeProvider:

```tsx
import { RealtimeProvider } from '@/app/providers/RealtimeProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <RealtimeProvider>
          {children}
        </RealtimeProvider>
      </body>
    </html>
  );
}
```

### Step 2: Use in Ticket List/Kanban Views

In your ticket list or kanban component, add the `useTicketUpdates` hook:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTicketUpdates } from '@/app/hooks/useTicketUpdates';

export default function TicketList({ projectId }: { projectId?: string }) {
  const [tickets, setTickets] = useState([]);

  // Fetch initial tickets
  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    const res = await fetch('/api/search-tickets');
    const data = await res.json();
    setTickets(data.tickets);
  }

  // Listen for real-time updates
  useTicketUpdates({
    projectId,
    onUpdate: (updatedTicket) => {
      // Update the ticket in state
      setTickets(prev => 
        prev.map(ticket => 
          ticket.id === updatedTicket.id ? updatedTicket : ticket
        )
      );
    }
  });

  return (
    <div>
      {tickets.map(ticket => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}
```

### Step 3: Request Browser Notification Permission

Add a permission request button in your settings or header:

```tsx
'use client';

import { useRealtimeContext } from '@/app/providers/RealtimeProvider';

export function NotificationSettings() {
  const { notificationPermission, requestNotificationPermission } = useRealtimeContext();

  return (
    <div>
      <p>Browser Notifications: {notificationPermission}</p>
      {notificationPermission !== 'granted' && (
        <button onClick={requestNotificationPermission}>
          Enable Notifications
        </button>
      )}
    </div>
  );
}
```

## How It Works

### Real-time Ticket Updates
1. When a user updates a ticket in Browser A, the API saves to database
2. SSE endpoint (`/api/tickets/stream`) polls every 2 seconds for tickets with `updated_at > last_check_time`
3. Updated tickets are sent to all connected clients via SSE
4. Browser B receives the update via `useTicketUpdates` hook
5. Hook triggers `onUpdate` callback with the updated ticket
6. Component updates the ticket in state → UI refreshes automatically

### Browser Notifications
1. User grants notification permission (one-time)
2. When in-app notification is received via SSE:
   - Shows browser notification (Chrome/Edge/Firefox native notifications)
   - Notification appears even if window is minimized/hidden
   - Click on notification focuses window and navigates to ticket
   - Auto-closes after 5 seconds

### Features
- ✅ **Cross-browser/tab sync** - Changes in one browser instantly appear in others
- ✅ **Browser notifications** - Native OS notifications with click-to-view
- ✅ **Auto-reconnect** - SSE reconnects on connection loss
- ✅ **Project filtering** - Only receive updates for relevant projects
- ✅ **Efficient polling** - Only sends changed data, not full dataset
- ✅ **No page refresh needed** - UI updates automatically

## API Response Format

### Ticket Update Event
```json
{
  "type": "ticket_update",
  "ticket": {
    "id": "uuid",
    "title": "Ticket title",
    "status_id": "uuid",
    "priority_id": "uuid",
    "assigned_to": "uuid",
    "updated_at": "2025-11-17T...",
    "status": { "name": "In Progress", "color_code": "#yellow" },
    "priority": { "name": "High", "color_code": "#red" },
    "assignee": { "name": "John Doe" }
  }
}
```

### Notification Event
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "entity_type": "ticket",
  "entity_id": "ticket-uuid",
  "title": "Ticket Updated",
  "message": "Status changed to In Progress",
  "type": "info",
  "is_read": false,
  "created_at": "2025-11-17T..."
}
```

## Browser Notification Example

When a notification arrives:
```
┌─────────────────────────────────┐
│ 🔔 Ticket Updated               │
│                                 │
│ Status changed to In Progress   │
│                                 │
│ Click to view ticket            │
└─────────────────────────────────┘
```

## Performance Considerations

- SSE connections are lightweight (text-only)
- Polling interval is 2 seconds (configurable)
- Only sends tickets updated since last check
- Automatic cleanup on component unmount
- Keep-alive prevents connection timeout

## Testing

1. Open ticket list in Chrome
2. Open same ticket list in Edge/Firefox
3. Update a ticket in Chrome
4. Watch it update in Edge/Firefox without refresh
5. Check browser notification appears (if permitted)

## Troubleshooting

**Notifications not appearing?**
- Check browser notification permission is granted
- Check browser settings allow notifications from localhost
- Open DevTools → Console to see SSE connection logs

**Updates not syncing?**
- Check SSE connection: Look for "✅ Ticket updates stream connected"
- Verify token is in localStorage
- Check network tab for EventSource connection

**Connection keeps dropping?**
- Increase keep-alive interval (currently 30s)
- Check server timeout settings
- Verify no proxy/firewall blocking SSE
