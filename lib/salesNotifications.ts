import { db } from '@/db';
import { salesNotifications } from '@/db/sales-schema';
import { eq, and, count as drizzleCount } from 'drizzle-orm';

interface CreateNotificationParams {
  userId: string;
  organizationId: string;
  entityType: 'quote' | 'transaction' | 'payment';
  entityId: string;
  title: string;
  message: string;
  type: 'quote_accepted' | 'payment_received' | 'invoice_generated' | 'quote_sent';
  metadata?: Record<string, any>;
}

export async function createSalesNotification(params: CreateNotificationParams) {
  try {
    const result = await db
      .insert(salesNotifications)
      .values({
        userId: params.userId,
        organizationId: params.organizationId,
        entityType: params.entityType,
        entityId: params.entityId,
        title: params.title,
        message: params.message,
        type: params.type,
        metadata: params.metadata || {},
        isRead: false,
        createdAt: new Date()
      })
      .returning();

    if (!result || result.length === 0) {
      console.error('❌ Error creating sales notification: No data returned');
      return null;
    }

    console.log('✅ Sales notification created:', result[0]);
    return result[0];
  } catch (error) {
    console.error('❌ Exception creating sales notification:', error);
    return null;
  }
}

// Get unread notification count
export async function getUnreadSalesNotificationCount(userId: string) {
  try {
    const result = await db
      .select({ count: drizzleCount() })
      .from(salesNotifications)
      .where(and(
        eq(salesNotifications.userId, userId),
        eq(salesNotifications.isRead, false)
      ));

    return result[0]?.count || 0;
  } catch (error) {
    console.error('Exception fetching notification count:', error);
    return 0;
  }
}

// Mark notification as read
export async function markSalesNotificationAsRead(notificationId: string) {
  try {
    await db
      .update(salesNotifications)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(eq(salesNotifications.notificationId, notificationId));

    return true;
  } catch (error) {
    console.error('Exception marking notification as read:', error);
    return false;
  }
}
