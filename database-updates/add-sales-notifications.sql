-- SALES NOTIFICATIONS SYSTEM
-- This creates notifications table in sales database for quote acceptance and payment notifications

-- Create notifications table in sales database
CREATE TABLE IF NOT EXISTS sales_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- User from main database who should receive notification
  organization_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'quote', 'transaction', 'payment'
  entity_id UUID NOT NULL, -- quote_id or transaction_id
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'quote_accepted', 'payment_received', 'invoice_generated'
  is_read BOOLEAN DEFAULT false,
  metadata JSONB, -- Additional data like amount, quote_number, invoice_number
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_notifications_user_id ON sales_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_org_id ON sales_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_is_read ON sales_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_created_at ON sales_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_type ON sales_notifications(type);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_entity ON sales_notifications(entity_type, entity_id);

-- Disable RLS for simplicity
ALTER TABLE sales_notifications DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE sales_notifications IS 'Notifications for sales events (quote acceptance, payments)';
COMMENT ON COLUMN sales_notifications.user_id IS 'User ID from main database (sales member who created quote/transaction)';
COMMENT ON COLUMN sales_notifications.metadata IS 'Additional info like {"amount": 50000, "quote_number": "QT-123", "client_name": "ABC Corp"}';
