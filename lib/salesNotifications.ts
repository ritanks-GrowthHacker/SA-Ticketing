import { supabaseAdminSales } from '@/app/db/connections';

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
    const { data, error } = await supabaseAdminSales
      .from('sales_notifications')
      .insert({
        user_id: params.userId,
        organization_id: params.organizationId,
        entity_type: params.entityType,
        entity_id: params.entityId,
        title: params.title,
        message: params.message,
        type: params.type,
        metadata: params.metadata || {},
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating sales notification:', error);
      return null;
    }

    console.log('✅ Sales notification created:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception creating sales notification:', error);
    return null;
  }
}

// Get unread notification count
export async function getUnreadSalesNotificationCount(userId: string) {
  try {
    const { count, error } = await supabaseAdminSales
      .from('sales_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching notification count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Exception fetching notification count:', error);
    return 0;
  }
}

// Mark notification as read
export async function markSalesNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabaseAdminSales
      .from('sales_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('notification_id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception marking notification as read:', error);
    return false;
  }
}
