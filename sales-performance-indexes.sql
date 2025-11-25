-- ========================================
-- SALES DATABASE PERFORMANCE INDEXES
-- Run this in your Sales Supabase database
-- ========================================

-- Quotes table indexes
CREATE INDEX IF NOT EXISTS idx_quotes_org_id ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_org_status ON quotes(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_org_created ON quotes(organization_id, created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_magic_link ON quotes(magic_link_token);

-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_sales ON clients(assigned_sales_member_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_assigned ON clients(organization_id, assigned_sales_member_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_org_id ON transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_sales_member ON transactions(sales_member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_org_sales ON transactions(organization_id, sales_member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org_status ON transactions(organization_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_number);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- Sales team hierarchy indexes (use correct column name: sales_role)
CREATE INDEX IF NOT EXISTS idx_sales_team_user_id ON sales_team_hierarchy(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_team_org_id ON sales_team_hierarchy(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_team_manager_id ON sales_team_hierarchy(manager_id);
CREATE INDEX IF NOT EXISTS idx_sales_team_sales_role ON sales_team_hierarchy(sales_role);
CREATE INDEX IF NOT EXISTS idx_sales_team_org_role ON sales_team_hierarchy(organization_id, sales_role);
CREATE INDEX IF NOT EXISTS idx_sales_team_email ON sales_team_hierarchy(email);
CREATE INDEX IF NOT EXISTS idx_sales_team_active ON sales_team_hierarchy(is_active);

-- Sales targets table indexes
CREATE INDEX IF NOT EXISTS idx_sales_targets_org_id ON sales_targets(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_user_id ON sales_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_year_month ON sales_targets(target_year, target_month);
CREATE INDEX IF NOT EXISTS idx_sales_targets_type ON sales_targets(target_type);

-- Client interactions table indexes
CREATE INDEX IF NOT EXISTS idx_client_interactions_org_id ON client_interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_client_id ON client_interactions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_sales_member ON client_interactions(sales_member_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_date ON client_interactions(interaction_date DESC);

-- Transaction line items indexes
CREATE INDEX IF NOT EXISTS idx_transaction_line_items_txn_id ON transaction_line_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_line_items_product_id ON transaction_line_items(product_id);

-- AI revenue forecasts indexes
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_org_id ON ai_revenue_forecasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_user_id ON ai_revenue_forecasts(scope_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_month ON ai_revenue_forecasts(forecast_month);
CREATE INDEX IF NOT EXISTS idx_ai_forecasts_type ON ai_revenue_forecasts(forecast_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_quotes_lookup ON quotes(organization_id, created_by_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_lookup ON transactions(organization_id, sales_member_id, payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_lookup ON clients(organization_id, assigned_sales_member_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_team_lookup ON sales_team_hierarchy(organization_id, sales_role, is_active);

-- Create sales_notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS sales_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for sales_notifications
CREATE INDEX IF NOT EXISTS idx_sales_notifications_user_id ON sales_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_is_read ON sales_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_created_at ON sales_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_user_unread ON sales_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_sales_notifications_user_created ON sales_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_notifications_org_id ON sales_notifications(organization_id);

-- Analyze tables to update statistics
ANALYZE quotes;
ANALYZE clients;
ANALYZE transactions;
ANALYZE sales_team_hierarchy;
ANALYZE sales_notifications;
ANALYZE products;
ANALYZE sales_targets;
ANALYZE client_interactions;
ANALYZE transaction_line_items;
ANALYZE ai_revenue_forecasts;

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('quotes', 'clients', 'transactions', 'sales_notifications', 'sales_team_hierarchy', 'products', 'sales_targets', 'client_interactions', 'transaction_line_items', 'ai_revenue_forecasts')
ORDER BY tablename, indexname;
