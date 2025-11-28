'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { browserNotifications } from '@/lib/browserNotifications';
import { useAuthStore } from '@/app/store/authStore';

interface Notification {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface TicketUpdate {
  type: 'ticket_update';
  ticket: any;
}

interface UseRealtimeOptions {
  enabled?: boolean;
  projectId?: string;
  onNotification?: (notification: Notification) => void;
  onTicketUpdate?: (ticket: any) => void;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { 
    enabled = true,
    projectId,
    onNotification,
    onTicketUpdate
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const notificationSourceRef = useRef<EventSource | null>(null);
  const ticketSourceRef = useRef<EventSource | null>(null);

  const token = useAuthStore(state => state.token);
  
  // Use refs to store callbacks to prevent reconnections on every render
  const onNotificationRef = useRef(onNotification);
  const onTicketUpdateRef = useRef(onTicketUpdate);
  
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);
  
  useEffect(() => {
    onTicketUpdateRef.current = onTicketUpdate;
  }, [onTicketUpdate]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    const permission = await browserNotifications.requestPermission();
    setNotificationPermission(permission);
    return permission;
  }, []);

  // Connect to notification stream
  useEffect(() => {
    if (!enabled) return;

    if (!token) return;

    const url = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('✅ Notification stream connected');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('📡 SSE:', data.message);
          return;
        }

        // It's a notification
        const notification: Notification = data;
        console.log('🔔 New notification:', notification);

        // Call callback using ref
        onNotificationRef.current?.(notification);

        // Show browser notification if permission granted
        if (browserNotifications.getPermission() === 'granted') {
          browserNotifications.show({
            title: notification.title,
            body: notification.message,
            tag: notification.entity_id,
            data: {
              ticket_id: notification.entity_type === 'ticket' ? notification.entity_id : null,
              notification_id: notification.id
            }
          });
        }
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    };

    eventSource.onerror = (error) => {
      // SSE errors are normal when connection closes - don't spam console
      setIsConnected(false);
      eventSource.close();
    };

    notificationSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      notificationSourceRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, token]); // Removed onNotification from dependencies

  // Connect to ticket updates stream
  useEffect(() => {
    if (!enabled) return;
    if (!token) return;

    const url = `/api/tickets/stream?token=${encodeURIComponent(token)}${projectId ? `&project_id=${projectId}` : ''}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('✅ Ticket updates stream connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('📡 Ticket SSE:', data.message);
          return;
        }

        if (data.type === 'ticket_update') {
          console.log('🎫 Ticket updated:', data.ticket);
          onTicketUpdateRef.current?.(data.ticket);
        }
      } catch (error) {
        console.error('Error parsing ticket update:', error);
      }
    };

    eventSource.onerror = (error) => {
      // SSE errors are normal when connection closes - don't spam console
      eventSource.close();
    };

    ticketSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      ticketSourceRef.current = null;
    };
  }, [enabled, token, projectId]); // Removed onTicketUpdate from dependencies

  // Auto-request notification permission on mount if supported
  useEffect(() => {
    if (browserNotifications.isSupported()) {
      const currentPermission = browserNotifications.getPermission();
      setNotificationPermission(currentPermission);

      // Auto-request if default (not yet asked)
      if (currentPermission === 'default') {
        requestNotificationPermission();
      }
    }
  }, [requestNotificationPermission]);

  return {
    isConnected,
    notificationPermission,
    requestNotificationPermission,
    disconnect: () => {
      notificationSourceRef.current?.close();
      ticketSourceRef.current?.close();
      setIsConnected(false);
    }
  };
}
