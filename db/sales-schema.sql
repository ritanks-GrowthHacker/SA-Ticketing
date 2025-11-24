-- Sales Database Schema
-- This is a separate Supabase database for Sales CRM module

CREATE TABLE public.sales_team_hierarchy (
  hierarchy_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  sales_role character varying NOT NULL CHECK (sales_role::text = ANY (ARRAY['sales_admin'::character varying, 'sales_manager'::character varying, 'sales_member'::character varying]::text[])),
  manager_id uuid,
  email character varying NOT NULL,
  full_name character varying NOT NULL,
  phone character varying,
  hire_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sales_team_hierarchy_pkey PRIMARY KEY (hierarchy_id)
);

CREATE TABLE public.clients (
  client_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  client_name character varying NOT NULL,
  contact_person character varying,
  contact_designation character varying,
  email character varying,
  phone character varying,
  address text,
  city character varying,
  state character varying,
  country character varying,
  postal_code character varying,
  industry character varying,
  client_type character varying CHECK (client_type::text = ANY (ARRAY['B2B'::character varying, 'B2C'::character varying, 'B2G'::character varying]::text[])),
  company_size character varying,
  annual_revenue_bracket character varying,
  tax_number character varying,
  gst_number character varying,
  payment_terms character varying,
  preferred_payment_method character varying,
  credit_limit numeric,
  registration_date date DEFAULT CURRENT_DATE,
  created_by_user_id uuid NOT NULL,
  assigned_sales_member_id uuid,
  client_source character varying,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'blacklisted'::character varying]::text[])),
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (client_id)
);

CREATE TABLE public.products (
  product_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  product_name character varying NOT NULL,
  product_code character varying UNIQUE,
  sku character varying UNIQUE,
  description text,
  product_category character varying,
  unit_price numeric NOT NULL,
  cost_price numeric,
  currency character varying DEFAULT 'INR'::character varying,
  subscription_type character varying CHECK (subscription_type::text = ANY (ARRAY['one-time'::character varying, 'monthly'::character varying, 'quarterly'::character varying, 'annual'::character varying, 'custom'::character varying]::text[])),
  billing_cycle_days integer,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (product_id)
);

CREATE TABLE public.transactions (
  transaction_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL,
  sales_member_id uuid NOT NULL,
  transaction_date date DEFAULT CURRENT_DATE,
  invoice_number character varying NOT NULL UNIQUE,
  subtotal_amount numeric NOT NULL,
  discount_percentage numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_percentage numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  total_amount numeric NOT NULL,
  currency character varying DEFAULT 'INR'::character varying,
  payment_status character varying DEFAULT 'pending'::character varying CHECK (payment_status::text = ANY (ARRAY['pending'::character varying, 'partial'::character varying, 'paid'::character varying, 'overdue'::character varying, 'cancelled'::character varying]::text[])),
  amount_paid numeric DEFAULT 0,
  amount_due numeric,
  payment_date date,
  payment_method character varying,
  payment_reference character varying,
  contract_start_date date,
  contract_end_date date,
  contract_duration_months integer,
  renewal_date date,
  is_renewed boolean DEFAULT false,
  commission_percentage numeric,
  commission_amount numeric,
  commission_paid boolean DEFAULT false,
  notes text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (transaction_id),
  CONSTRAINT transactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id)
);

CREATE TABLE public.transaction_line_items (
  line_item_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  transaction_id uuid NOT NULL,
  product_id uuid,
  product_name character varying NOT NULL,
  product_code character varying,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  cost_price numeric,
  discount_percentage numeric DEFAULT 0,
  line_total numeric NOT NULL,
  total_cost numeric,
  profit_margin numeric,
  profit_percentage numeric,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT transaction_line_items_pkey PRIMARY KEY (line_item_id),
  CONSTRAINT transaction_line_items_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(transaction_id),
  CONSTRAINT transaction_line_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id)
);

CREATE TABLE public.sales_targets (
  target_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  sales_role character varying NOT NULL,
  target_type character varying CHECK (target_type::text = ANY (ARRAY['monthly'::character varying, 'quarterly'::character varying, 'yearly'::character varying]::text[])),
  target_year integer NOT NULL,
  target_month integer CHECK (target_month >= 1 AND target_month <= 12),
  target_quarter integer CHECK (target_quarter >= 1 AND target_quarter <= 4),
  target_revenue numeric NOT NULL,
  target_clients integer,
  target_transactions integer,
  achieved_revenue numeric DEFAULT 0,
  achieved_clients integer DEFAULT 0,
  achieved_transactions integer DEFAULT 0,
  revenue_achievement_percentage numeric DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sales_targets_pkey PRIMARY KEY (target_id)
);

CREATE TABLE public.client_interactions (
  interaction_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL,
  sales_member_id uuid NOT NULL,
  interaction_type character varying CHECK (interaction_type::text = ANY (ARRAY['call'::character varying, 'email'::character varying, 'meeting'::character varying, 'demo'::character varying, 'follow-up'::character varying, 'proposal'::character varying, 'other'::character varying]::text[])),
  interaction_date timestamp without time zone DEFAULT now(),
  subject character varying,
  notes text,
  outcome character varying,
  next_follow_up_date date,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT client_interactions_pkey PRIMARY KEY (interaction_id),
  CONSTRAINT client_interactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id)
);

CREATE TABLE public.member_assignment_audit (
  audit_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  old_manager_id uuid,
  new_manager_id uuid,
  assigned_by_admin_id uuid NOT NULL,
  assignment_date timestamp without time zone DEFAULT now(),
  reason text,
  CONSTRAINT member_assignment_audit_pkey PRIMARY KEY (audit_id)
);

CREATE TABLE public.ai_revenue_forecasts (
  forecast_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  forecast_type character varying CHECK (forecast_type::text = ANY (ARRAY['member'::character varying, 'manager'::character varying, 'team'::character varying, 'organization'::character varying]::text[])),
  scope_user_id uuid,
  client_id uuid,
  forecast_month date NOT NULL,
  forecast_quarter integer,
  forecast_year integer,
  predicted_revenue numeric NOT NULL,
  predicted_transactions integer,
  predicted_new_clients integer,
  confidence_score numeric CHECK (confidence_score >= 0::numeric AND confidence_score <= 100::numeric),
  lower_bound numeric,
  upper_bound numeric,
  seasonality_factor numeric,
  trend_factor numeric,
  historical_accuracy numeric,
  model_version character varying,
  training_data_months integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT ai_revenue_forecasts_pkey PRIMARY KEY (forecast_id),
  CONSTRAINT ai_revenue_forecasts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(client_id)
);

-- Materialized View for Revenue Analytics
CREATE MATERIALIZED VIEW public.mv_revenue_analytics AS
SELECT 
  t.organization_id,
  t.sales_member_id,
  sth.manager_id,
  c.client_id,
  c.client_name,
  c.industry,
  EXTRACT(YEAR FROM t.transaction_date) AS year,
  EXTRACT(MONTH FROM t.transaction_date) AS month,
  EXTRACT(QUARTER FROM t.transaction_date) AS quarter,
  COUNT(t.transaction_id) AS total_transactions,
  SUM(t.total_amount) AS total_revenue,
  SUM(t.amount_paid) AS total_paid,
  SUM(t.amount_due) AS total_due,
  SUM(CASE WHEN tli.profit_margin IS NOT NULL THEN tli.profit_margin ELSE 0 END) AS total_profit,
  AVG(t.total_amount) AS avg_transaction_value
FROM transactions t
LEFT JOIN clients c ON t.client_id = c.client_id
LEFT JOIN sales_team_hierarchy sth ON t.sales_member_id = sth.user_id
LEFT JOIN transaction_line_items tli ON t.transaction_id = tli.transaction_id
GROUP BY 
  t.organization_id, 
  t.sales_member_id, 
  sth.manager_id,
  c.client_id,
  c.client_name,
  c.industry,
  year, 
  month, 
  quarter;

-- Indexes for performance
CREATE INDEX idx_sales_team_org ON sales_team_hierarchy(organization_id);
CREATE INDEX idx_sales_team_manager ON sales_team_hierarchy(manager_id);
CREATE INDEX idx_clients_org ON clients(organization_id);
CREATE INDEX idx_clients_assigned_member ON clients(assigned_sales_member_id);
CREATE INDEX idx_transactions_org ON transactions(organization_id);
CREATE INDEX idx_transactions_member ON transactions(sales_member_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
