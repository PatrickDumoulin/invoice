
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'partner');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS on user_roles: only admins can manage roles, users can see their own
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Update invoices policies: partner can SELECT partnership invoices only
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
CREATE POLICY "Users can view their own invoices"
ON public.invoices FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    public.has_role(auth.uid(), 'partner')
    AND is_partnership = true
  )
);

-- Update partnership_reimbursements: partner can view
DROP POLICY IF EXISTS "Users can view their own reimbursements" ON public.partnership_reimbursements;
CREATE POLICY "Users can view reimbursements"
ON public.partnership_reimbursements FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'partner')
);
