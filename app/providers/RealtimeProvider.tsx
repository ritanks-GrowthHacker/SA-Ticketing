'use client';

import { createContext, useContext, ReactNode, useCallback } from 'react';
import { useRealtime } from '@/app/hooks/useRealtime';
import { useAuthStore } from '@/app/store/authStore';

interface RealtimeContextType {
  isConnected: boolean;
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  disconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  const handleNotification = useCallback((notification: any) => {
    console.log('📬 Received notification:', notification);
    // You can dispatch to a global notification store here if needed
  }, []);

  const handleTicketUpdate = useCallback((ticket: any) => {
    console.log('🔄 Ticket updated in real-time:', ticket);
    // Trigger a re-fetch or update the ticket in the store/cache
    // This can be handled by individual components subscribing to updates
    window.dispatchEvent(new CustomEvent('ticket-updated', { detail: ticket }));
  }, []);

  const realtimeHook = useRealtime({
    enabled: isAuthenticated,
    onNotification: handleNotification,
    onTicketUpdate: handleTicketUpdate
  });

  return (
    <RealtimeContext.Provider value={realtimeHook}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext must be used within RealtimeProvider');
  }
  return context;
}
