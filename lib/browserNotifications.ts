// Browser notification utilities for real-time updates

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
}

export class BrowserNotificationService {
  private static instance: BrowserNotificationService;
  private permission: NotificationPermission = 'default';

  private constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  static getInstance(): BrowserNotificationService {
    if (!BrowserNotificationService.instance) {
      BrowserNotificationService.instance = new BrowserNotificationService();
    }
    return BrowserNotificationService.instance;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Browser notifications not supported');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  async show(options: BrowserNotificationOptions): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Browser notifications not supported');
      return;
    }

    // Request permission if not already granted
    if (this.permission !== 'granted') {
      this.permission = await this.requestPermission();
    }

    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/logo.png',
        badge: options.badge || '/logo.png',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
      });

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }

      // Handle click event
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        
        // Navigate to ticket if data contains ticket_id
        if (options.data?.ticket_id) {
          window.location.href = `/tickets/${options.data.ticket_id}`;
        } else if (options.data?.url) {
          window.location.href = options.data.url;
        }
        
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  getPermission(): NotificationPermission {
    return this.permission;
  }
}

// Export singleton instance
export const browserNotifications = BrowserNotificationService.getInstance();
