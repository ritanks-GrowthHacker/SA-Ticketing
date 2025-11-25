'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/app/store/authStore';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'resource_request';
  is_read: boolean;
  created_at: string;
  entity_type: string;
  entity_id: string;
}

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, token } = useAuthStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch initial notifications
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Setup SSE for real-time notifications
  useEffect(() => {
    if (!user || !token) return;

    const eventSource = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Ignore connection messages
      if (data.type === 'connected') return;
      
      const newNotification = data;
      
      // Check if notification already exists to prevent duplicates
      setNotifications((prev) => {
        const exists = prev.some(n => n.id === newNotification.id);
        if (exists) return prev;
        
        // Only increment count if notification is actually new
        setUnreadCount((count) => count + 1);
        return [newNotification, ...prev];
      });
      
      // Show browser notification only if this is a truly new notification
      if (Notification.permission === 'granted' && newNotification.title) {
        const notification = new Notification(newNotification.title, {
          body: newNotification.message,
          icon: '/favicon.ico',
          tag: newNotification.id, // Use notification ID to prevent duplicates
          requireInteraction: false,
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        // Handle click
        notification.onclick = () => {
          window.focus();
          if (newNotification.entity_type === 'ticket') {
            window.location.href = `/tickets/${newNotification.entity_id}`;
          } else if (newNotification.entity_type === 'quote') {
            window.location.href = `/sales/quotes`;
          }
          notification.close();
        };
      }
    };

    eventSource.onerror = (error) => {
      // SSE errors are normal when connection closes or reconnects
      // Only log if it's not a normal closure
      eventSource.close();
    };

    // Sales notifications stream
    const salesEventSource = new EventSource(`/api/sales/notifications/stream?token=${encodeURIComponent(token)}`);

    salesEventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Ignore connection messages
      if (data.type === 'connected') return;
      
      const newNotification = {
        ...data,
        id: data.notification_id || data.id
      };
      
      // Check if notification already exists to prevent duplicates
      setNotifications((prev) => {
        const exists = prev.some(n => n.id === newNotification.id);
        if (exists) return prev;
        
        // Only increment count if notification is actually new
        setUnreadCount((count) => count + 1);
        return [newNotification, ...prev];
      });
      
      // Show browser notification for sales notifications
      if (Notification.permission === 'granted' && newNotification.title) {
        const notification = new Notification(newNotification.title, {
          body: newNotification.message,
          icon: '/favicon.ico',
          tag: newNotification.id,
          requireInteraction: false,
        });

        setTimeout(() => notification.close(), 5000);

        notification.onclick = () => {
          window.focus();
          if (newNotification.entity_type === 'quote') {
            window.location.href = `/sales/quotes`;
          } else if (newNotification.entity_type === 'transaction') {
            window.location.href = `/sales/transactions`;
          }
          notification.close();
        };
      }
    };

    salesEventSource.onerror = () => {
      salesEventSource.close();
    };

    // Auto-request browser notification permission
    if (Notification.permission === 'default') {
      setTimeout(() => {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log('✅ Browser notifications enabled');
          }
        });
      }, 2000); // Wait 2 seconds after page load
    }

    return () => {
      eventSource.close();
      salesEventSource.close();
    };
  }, [user, token]);

  const fetchNotifications = async () => {
    try {
      if (!token) return;
      
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      if (!token) return;
      
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!token) return;
      
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200';
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200';
      case 'error':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200';
      case 'resource_request':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                  className={`
                    px-4 py-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer
                    hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                    ${!notification.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                  `}
                >
                  <div className="flex items-start space-x-3">
                    {/* Type Badge */}
                    <div className={`
                      shrink-0 w-2 h-2 rounded-full mt-2
                      ${!notification.is_read ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
                    `} />
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`
                        text-sm font-medium text-gray-900 dark:text-gray-100
                        ${!notification.is_read ? 'font-semibold' : ''}
                      `}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-center">
              <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
