-- Xhibitly Instant Quote - Initial Database Schema
-- Base44 + Supabase Hybrid Architecture
-- Created: 2026-02-04

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLES
-- =============================================================================

-- Profiles (synced from Base44 auth)
-- Links Base44 users to Supabase database
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base44_user_id TEXT UNIQUE NOT NULL, -- Link to Base44 user ID
  email TEXT UNIQUE NOT NULL,
  company_name TEXT,
  contact_name TEXT,
  phone TEXT,
  user_type TEXT CHECK (user_type IN ('broker', 'sales_rep', 'admin')) DEFAULT 'broker',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles synced from Base44 authentication';
COMMENT ON COLUMN public.profiles.base44_user_id IS 'Links to Base44 user ID for authentication';
COMMENT ON COLUMN public.profiles.user_type IS 'broker: end user creating quotes, sales_rep: company sales representative, admin: system administrator';

-- Companies (for sales reps to work under)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  industry TEXT,
  website_url TEXT,
  billing_email TEXT,
  billing_address JSONB, -- {street, city, state, zip, country}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.companies IS 'Companies that sales reps work for';
COMMENT ON COLUMN public.companies.billing_address IS 'JSON object with street, city, state, zip, country fields';

-- Sales Reps (linked to companies)
CREATE TABLE public.sales_reps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rep_name TEXT NOT NULL,
  rep_email TEXT NOT NULL,
  rep_phone TEXT,
  territory TEXT,
  commission_rate NUMERIC(5, 2), -- e.g., 5.50 for 5.5%
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, company_id)
);

COMMENT ON TABLE public.sales_reps IS 'Sales representatives linked to companies';
COMMENT ON COLUMN public.sales_reps.commission_rate IS 'Commission percentage (e.g., 5.50 = 5.5%)';

-- Products (trade show booth components)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT, -- e.g., Display, Furniture, Lighting, Technology
  price_tier TEXT CHECK (price_tier IN ('Budget', 'Hybrid', 'Custom')),
  base_price NUMERIC(10, 2) NOT NULL,
  design_styles TEXT[], -- Array: [Modern, Industrial, Minimalist, Luxury, etc.]
  booth_sizes TEXT[], -- Array: ['10x10', '10x20', '20x20']
  features JSONB, -- Flexible product features
  is_active BOOLEAN DEFAULT true,
  image_url TEXT, -- Supabase Storage URL or external CDN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.products IS 'Trade show booth product catalog (displays, furniture, lighting, etc.)';
COMMENT ON COLUMN public.products.design_styles IS 'Compatible design styles: Modern, Industrial, Minimalist, Luxury, Tech, Organic, Bold, Classic, Creative';
COMMENT ON COLUMN public.products.booth_sizes IS 'Compatible booth sizes: 10x10, 10x20, 20x20';

-- Booth Designs (AI-generated booth experience designs)
CREATE TABLE public.booth_designs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booth_size TEXT NOT NULL, -- 10x10, 10x20, 20x20
  tier TEXT NOT NULL CHECK (tier IN ('Budget', 'Hybrid', 'Custom')),
  design_name TEXT NOT NULL,
  brand_identity JSONB NOT NULL, -- {primary_color, secondary_color, brand_personality, industry, target_audience, design_style[], brand_essence}
  experience_story TEXT, -- Narrative of the booth experience
  visitor_journey TEXT, -- Description of visitor flow
  key_moments TEXT[], -- Array of key experience moments
  product_skus TEXT[], -- Array of SKU references
  total_price NUMERIC(10, 2) NOT NULL,
  design_rationale TEXT, -- Why this design matches the brand
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.booth_designs IS 'AI-generated booth experience designs (3 tiers per quote)';
COMMENT ON COLUMN public.booth_designs.brand_identity IS 'AI-extracted brand analysis: colors, personality, industry, style';
COMMENT ON COLUMN public.booth_designs.product_skus IS 'Array of SKUs selected for this design';

-- Orders (quote requests and confirmed orders)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number TEXT UNIQUE NOT NULL,

  -- Broker/Dealer info
  dealer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dealer_email TEXT NOT NULL,
  dealer_company TEXT NOT NULL,
  dealer_name TEXT NOT NULL,
  dealer_phone TEXT NOT NULL,
  website_url TEXT NOT NULL,

  -- Booth details
  booth_size TEXT NOT NULL,
  show_date DATE NOT NULL,
  show_name TEXT,
  selected_booth_design_id UUID REFERENCES public.booth_designs(id) ON DELETE SET NULL,
  selected_tier TEXT NOT NULL,
  quoted_price NUMERIC(10, 2) NOT NULL,

  -- Company & Sales Rep (if applicable)
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  sales_rep_id UUID REFERENCES public.sales_reps(id) ON DELETE SET NULL,

  -- Status & payment
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Contacted', 'Quoted', 'Confirmed', 'Cancelled', 'Paid')),
  payment_status TEXT DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Deposit', 'Paid', 'Refunded')),
  deposit_amount NUMERIC(10, 2),
  final_amount NUMERIC(10, 2),

  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.orders IS 'Quote requests and confirmed orders for booth designs';
COMMENT ON COLUMN public.orders.status IS 'Order workflow: Pending → Contacted → Quoted → Confirmed → Paid';
COMMENT ON COLUMN public.orders.payment_status IS 'Payment tracking: Unpaid → Deposit → Paid';

-- =============================================================================
-- INDEXES (Performance optimization for 10,000+ concurrent users)
-- =============================================================================

-- Profiles
CREATE INDEX idx_profiles_base44_user ON public.profiles(base44_user_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_user_type ON public.profiles(user_type);

-- Companies
CREATE INDEX idx_companies_active ON public.companies(is_active) WHERE is_active = true;
CREATE INDEX idx_companies_name ON public.companies(name);

-- Sales Reps
CREATE INDEX idx_sales_reps_company ON public.sales_reps(company_id);
CREATE INDEX idx_sales_reps_profile ON public.sales_reps(profile_id);
CREATE INDEX idx_sales_reps_active ON public.sales_reps(is_active) WHERE is_active = true;

-- Products
CREATE INDEX idx_products_active ON public.products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_booth_sizes ON public.products USING GIN(booth_sizes); -- Array index
CREATE INDEX idx_products_price_tier ON public.products(price_tier);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_sku ON public.products(sku);

-- Booth Designs
CREATE INDEX idx_booth_designs_dealer ON public.booth_designs(dealer_id);
CREATE INDEX idx_booth_designs_created ON public.booth_designs(created_at DESC);
CREATE INDEX idx_booth_designs_tier ON public.booth_designs(tier);

-- Orders
CREATE INDEX idx_orders_dealer ON public.orders(dealer_id);
CREATE INDEX idx_orders_company ON public.orders(company_id);
CREATE INDEX idx_orders_sales_rep ON public.orders(sales_rep_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_orders_created ON public.orders(created_date DESC);
CREATE INDEX idx_orders_reference ON public.orders(reference_number);
CREATE INDEX idx_orders_show_date ON public.orders(show_date);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - Multi-tenant access control
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read (for Base44 user lookup), service role manages
CREATE POLICY "Anyone can view profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Service role can create profiles" ON public.profiles
  FOR INSERT WITH CHECK (true); -- For Base44 sync

CREATE POLICY "Service role can update profiles" ON public.profiles
  FOR UPDATE USING (true); -- For Base44 sync

-- Companies: Anyone can view active companies
CREATE POLICY "Anyone can view active companies" ON public.companies
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage companies" ON public.companies
  FOR ALL USING (true); -- Admins manage via service role

-- Sales Reps: Can view own profile and associated company reps
CREATE POLICY "Sales reps can view own company reps" ON public.sales_reps
  FOR SELECT USING (
    profile_id IN (SELECT id FROM public.profiles WHERE base44_user_id = current_setting('request.jwt.claim.sub', true))
    OR company_id IN (
      SELECT company_id FROM public.sales_reps
      WHERE profile_id IN (SELECT id FROM public.profiles WHERE base44_user_id = current_setting('request.jwt.claim.sub', true))
    )
  );

CREATE POLICY "Service role can manage sales reps" ON public.sales_reps
  FOR ALL USING (true); -- Admins manage via service role

-- Products: Everyone can view active products (public catalog)
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage products" ON public.products
  FOR ALL USING (true); -- Admins manage via service role

-- Booth Designs: Users can view own designs
CREATE POLICY "Users can view own designs" ON public.booth_designs
  FOR SELECT USING (
    dealer_id IN (SELECT id FROM public.profiles WHERE base44_user_id = current_setting('request.jwt.claim.sub', true))
  );

CREATE POLICY "Anyone can create booth designs" ON public.booth_designs
  FOR INSERT WITH CHECK (true); -- Base44 creates designs during quote process

-- Orders: Users can view own orders, sales reps can view their company orders
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (
    dealer_id IN (SELECT id FROM public.profiles WHERE base44_user_id = current_setting('request.jwt.claim.sub', true))
    OR sales_rep_id IN (
      SELECT id FROM public.sales_reps
      WHERE profile_id IN (SELECT id FROM public.profiles WHERE base44_user_id = current_setting('request.jwt.claim.sub', true))
    )
  );

CREATE POLICY "Anyone can create orders" ON public.orders
  FOR INSERT WITH CHECK (true); -- Base44 creates orders during quote process

CREATE POLICY "Service role can manage orders" ON public.orders
  FOR ALL USING (true); -- Admins manage via service role

-- =============================================================================
-- TRIGGERS - Auto-update timestamps
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_reps_updated_at BEFORE UPDATE ON public.sales_reps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booth_designs_updated_at BEFORE UPDATE ON public.booth_designs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================================================

-- Uncomment to insert sample products
/*
INSERT INTO public.products (sku, name, category, price_tier, base_price, booth_sizes, design_styles, is_active) VALUES
  ('DISP-001', 'Premium Backlit Display Wall 10x10', 'Display', 'Custom', 4500.00, ARRAY['10x10', '10x20'], ARRAY['Modern', 'Luxury'], true),
  ('DISP-002', 'Budget Banner Stand Set', 'Display', 'Budget', 350.00, ARRAY['10x10'], ARRAY['Budget', 'Classic'], true),
  ('FURN-001', 'Modern Reception Counter', 'Furniture', 'Hybrid', 1200.00, ARRAY['10x10', '10x20'], ARRAY['Modern', 'Minimalist'], true),
  ('LIGHT-001', 'LED Accent Lighting Kit', 'Lighting', 'Hybrid', 600.00, ARRAY['10x10', '10x20', '20x20'], ARRAY['Modern', 'Tech'], true),
  ('TECH-001', 'Interactive Touchscreen Display 55"', 'Technology', 'Custom', 3500.00, ARRAY['10x20', '20x20'], ARRAY['Tech', 'Modern'], true);
*/
