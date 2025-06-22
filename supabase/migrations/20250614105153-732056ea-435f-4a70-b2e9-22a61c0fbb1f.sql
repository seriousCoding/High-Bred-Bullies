
-- Create breeders table to store breeder information
CREATE TABLE public.breeders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  delivery_areas TEXT[], -- Array of delivery area names/codes
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create litters table
CREATE TABLE public.litters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breeder_id UUID REFERENCES public.breeders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dam_name TEXT NOT NULL, -- Mother's name
  sire_name TEXT NOT NULL, -- Father's name
  breed TEXT NOT NULL,
  birth_date DATE NOT NULL,
  description TEXT,
  total_puppies INTEGER NOT NULL DEFAULT 0,
  available_puppies INTEGER NOT NULL DEFAULT 0,
  price_per_puppy INTEGER NOT NULL, -- Price in cents
  stripe_product_id TEXT, -- Stripe product ID
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold_out', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create puppies table
CREATE TABLE public.puppies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  litter_id UUID REFERENCES public.litters(id) ON DELETE CASCADE,
  name TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  color TEXT NOT NULL,
  markings TEXT,
  weight_at_birth DECIMAL(5,2), -- Weight in pounds
  current_weight DECIMAL(5,2),
  health_status TEXT DEFAULT 'healthy',
  is_available BOOLEAN DEFAULT true,
  stripe_price_id TEXT, -- Individual puppy price ID if different from litter
  reserved_by UUID REFERENCES auth.users(id),
  sold_to UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create orders table for puppy purchases
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  puppy_id UUID REFERENCES public.puppies(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('pickup', 'delivery')),
  delivery_address TEXT,
  delivery_cost INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user profiles table for extended user information
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  is_validated BOOLEAN DEFAULT false,
  validation_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.breeders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.litters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puppies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for breeders
CREATE POLICY "Breeders can view their own data" ON public.breeders
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for litters
CREATE POLICY "Breeders can manage their litters" ON public.litters
  FOR ALL USING (breeder_id IN (SELECT id FROM public.breeders WHERE user_id = auth.uid()));

CREATE POLICY "Public can view active litters" ON public.litters
  FOR SELECT USING (status = 'active');

-- RLS Policies for puppies
CREATE POLICY "Breeders can manage their puppies" ON public.puppies
  FOR ALL USING (litter_id IN (
    SELECT l.id FROM public.litters l
    JOIN public.breeders b ON l.breeder_id = b.id
    WHERE b.user_id = auth.uid()
  ));

CREATE POLICY "Public can view available puppies" ON public.puppies
  FOR SELECT USING (is_available = true AND litter_id IN (
    SELECT id FROM public.litters WHERE status = 'active'
  ));

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own orders" ON public.orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Breeders can view orders for their puppies" ON public.orders
  FOR SELECT USING (puppy_id IN (
    SELECT p.id FROM public.puppies p
    JOIN public.litters l ON p.litter_id = l.id
    JOIN public.breeders b ON l.breeder_id = b.id
    WHERE b.user_id = auth.uid()
  ));

-- RLS Policies for user profiles
CREATE POLICY "Users can manage their own profile" ON public.user_profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Breeders can view validated user profiles" ON public.user_profiles
  FOR SELECT USING (is_validated = true);

-- Create indexes for better performance
CREATE INDEX idx_litters_breeder_id ON public.litters(breeder_id);
CREATE INDEX idx_litters_status ON public.litters(status);
CREATE INDEX idx_puppies_litter_id ON public.puppies(litter_id);
CREATE INDEX idx_puppies_available ON public.puppies(is_available);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_puppy_id ON public.orders(puppy_id);
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Create function to automatically create breeder profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
