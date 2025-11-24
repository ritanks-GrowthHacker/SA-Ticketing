'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/app/store/authStore';

interface SalesNotification {
  notification_id: string;
  user_id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

interface UseSalesRealtimeOptions {
  enabled?: boolean;
  onNotification?: (notification: SalesNotification) => void;
}

export function useSalesRealtime(options: UseSalesRealtimeOptions = {}) {
  const { enabled = true, onNotification } = options;
  const [isConnected, setIsConnected] = useState(false);
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    if (!enabled || !token) return;

    const url = `/api/sales/notifications/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('✅ Sales notifications connected');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('📡 Sales SSE:', data.message);
          return;
        }

        // It's a sales notification
        const notification: SalesNotification = data;
        console.log('🔔 Sales notification:', notification);

        // Call callback
        onNotification?.(notification);

        // Show browser notification if permission granted
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: notification.entity_id,
            data: notification
          });
        }
      } catch (error) {
        console.error('Error parsing sales notification:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [enabled, onNotification, token]);

  return { isConnected };
}
