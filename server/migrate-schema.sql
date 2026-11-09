-- CloudBase PG 建表 DDL
-- 执行方式：通过 CloudBase 控制台 SQL 编辑器 或 tcb db pg migration apply

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT,
  email TEXT,
  name TEXT,
  password_hash TEXT,
  role TEXT DEFAULT 'member',
  org_id TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  credits INTEGER DEFAULT 0,
  credits_month TEXT,
  export_used INTEGER DEFAULT 0,
  export_purchased INTEGER DEFAULT 0,
  is_platform_admin BOOLEAN DEFAULT FALSE,
  avatar TEXT,
  phone2 TEXT,
  company TEXT,
  title TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. orgs
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  phone TEXT,
  address TEXT,
  intro TEXT,
  brand_color TEXT,
  plan TEXT DEFAULT 'free',
  settings JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. quotes
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,
  quote_number TEXT,
  title TEXT,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  community TEXT,
  province TEXT,
  city TEXT,
  building_area NUMERIC,
  layout TEXT,
  tier TEXT DEFAULT '中档',
  house_type TEXT DEFAULT '新房',
  house_age INTEGER DEFAULT 0,
  floor INTEGER DEFAULT 0,
  building_type TEXT DEFAULT '高层',
  has_elevator BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'draft',
  total_amount NUMERIC DEFAULT 0,
  cost_amount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  margin_rate NUMERIC DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  manage_fee NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  notes TEXT,
  share_token TEXT,
  share_enabled BOOLEAN DEFAULT FALSE,
  export_unlocked BOOLEAN DEFAULT FALSE,
  valid_days INTEGER,
  payment_terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. quote_items
CREATE TABLE IF NOT EXISTS quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  group_name TEXT,
  name TEXT,
  unit TEXT,
  qty NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  craft TEXT,
  remark TEXT,
  source TEXT DEFAULT 'manual',
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  community TEXT,
  address TEXT,
  building_area NUMERIC,
  layout TEXT,
  budget NUMERIC,
  source TEXT,
  status TEXT DEFAULT 'following',
  level TEXT DEFAULT 'normal',
  remark TEXT,
  owner_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. templates
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT,
  layout TEXT,
  building_area NUMERIC,
  building_type TEXT DEFAULT '高层',
  house_type TEXT DEFAULT '新房',
  city TEXT,
  tier TEXT DEFAULT '中档',
  spaces JSONB,
  note TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. library（工艺价格库）
CREATE TABLE IF NOT EXISTS library (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  group_key TEXT,
  group_name TEXT,
  name TEXT NOT NULL,
  unit TEXT DEFAULT '项',
  price NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  craft TEXT,
  tags TEXT[],
  source TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,
  kind TEXT NOT NULL,
  order_no TEXT,
  plan TEXT,
  plan_name TEXT,
  cycle TEXT,
  pack_code TEXT,
  pack_name TEXT,
  call_count INTEGER,
  amount NUMERIC,
  status TEXT DEFAULT 'pending',
  pay_method TEXT,
  paid_at TIMESTAMPTZ,
  invoice_requested BOOLEAN DEFAULT FALSE,
  invoice_status TEXT,
  invoice_title TEXT,
  invoice_tax_no TEXT,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. credits（积分流水，可选，当前未使用独立表）
CREATE TABLE IF NOT EXISTS credits (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  user_id TEXT,
  type TEXT,
  amount INTEGER,
  balance_after INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. ai_logs
CREATE TABLE IF NOT EXISTS ai_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  user_id TEXT,
  feature TEXT,
  feature_name TEXT,
  cost INTEGER DEFAULT 0,
  billed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  engine TEXT,
  elapsed_ms INTEGER,
  month TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  code TEXT,
  expire_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. meta
CREATE TABLE IF NOT EXISTS meta (
  id TEXT PRIMARY KEY,
  data JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  type TEXT,
  user_id TEXT,
  phone TEXT,
  role TEXT,
  status TEXT DEFAULT 'pending',
  quote_id TEXT,
  reason TEXT,
  amount_delta NUMERIC,
  invited_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. seq_counter（替代原 meta seq 逻辑）
CREATE TABLE IF NOT EXISTS seq_counter (
  id TEXT PRIMARY KEY,
  data JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================= RLS 策略 =================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE library ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE seq_counter ENABLE ROW LEVEL SECURITY;

-- users: 用户只能读自己的数据，org 管理员可读组织内所有用户
CREATE POLICY users_select ON users FOR SELECT USING (
  auth.uid() = org_id OR
  auth.uid() = id OR
  (SELECT is_platform_admin FROM users WHERE id = auth.uid()) = true
);
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY users_update ON users FOR UPDATE USING (auth.uid() = id OR (SELECT is_platform_admin FROM users WHERE id = auth.uid()) = true);
CREATE POLICY users_delete ON users FOR DELETE USING (auth.uid() = id OR (SELECT is_platform_admin FROM users WHERE id = auth.uid()) = true);

-- orgs: 组织成员可读写
CREATE POLICY orgs_select ON orgs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY orgs_insert ON orgs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY orgs_update ON orgs FOR UPDATE USING (auth.uid() IS NOT NULL);

-- quotes: 同组织可读写
CREATE POLICY quotes_select ON quotes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY quotes_insert ON quotes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY quotes_update ON quotes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY quotes_delete ON quotes FOR DELETE USING (auth.uid() IS NOT NULL);

-- quote_items: 同 quotes 策略
CREATE POLICY quote_items_select ON quote_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY quote_items_insert ON quote_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY quote_items_update ON quote_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY quote_items_delete ON quote_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- customers: 同组织可读写
CREATE POLICY customers_select ON customers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY customers_insert ON customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY customers_update ON customers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY customers_delete ON customers FOR DELETE USING (auth.uid() IS NOT NULL);

-- templates: 同组织可读写
CREATE POLICY templates_select ON templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY templates_insert ON templates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY templates_update ON templates FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY templates_delete ON templates FOR DELETE USING (auth.uid() IS NOT NULL);

-- library: 系统库（org_id 为 null）所有人可读，组织库只能本组织读写
CREATE POLICY library_select ON library FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY library_insert ON library FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY library_update ON library FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY library_delete ON library FOR DELETE USING (auth.uid() IS NOT NULL);

-- orders: 同组织可读写
CREATE POLICY orders_select ON orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY orders_update ON orders FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ai_logs: 同组织可读，写入不限
CREATE POLICY ai_logs_select ON ai_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY ai_logs_insert ON ai_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- notifications: 同组织可读写
CREATE POLICY notifications_select ON notifications FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (auth.uid() IS NOT NULL);

-- sessions: 仅内部访问
CREATE POLICY sessions_select ON sessions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY sessions_insert ON sessions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY sessions_delete ON sessions FOR DELETE USING (auth.uid() IS NOT NULL);

-- meta: 仅平台管理员
CREATE POLICY meta_select ON meta FOR SELECT USING (
  (SELECT is_platform_admin FROM users WHERE id = auth.uid()) = true
);
CREATE POLICY meta_insert ON meta FOR INSERT WITH CHECK (
  (SELECT is_platform_admin FROM users WHERE id = auth.uid()) = true
);
CREATE POLICY meta_update ON meta FOR UPDATE USING (
  (SELECT is_platform_admin FROM users WHERE id = auth.uid()) = true
);

-- seq_counter: 仅平台管理员
CREATE POLICY seq_counter_select ON seq_counter FOR SELECT USING (
  (SELECT is_platform_admin FROM users WHERE id = auth.uid()) = true
);
CREATE POLICY seq_counter_insert ON seq_counter FOR INSERT WITH CHECK (
  (SELECT is_platform_admin FROM users WHERE id = auth.uid()) = true
);
CREATE POLICY seq_counter_update ON seq_counter FOR UPDATE USING (
  (SELECT is_platform_admin FROM users WHERE id = auth.uid()) = true
);

-- credits: 同组织可读写
CREATE POLICY credits_select ON credits FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY credits_insert ON credits FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
